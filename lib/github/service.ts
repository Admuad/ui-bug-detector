/**
 * GitHub Repository Service
 * Downloads and scans GitHub repositories for UI bugs
 */

import { parseGitHubUrl, validateGitHubRepo, getRepoArchiveUrl, getRawFileUrl } from './parser';
import { checkRateLimit, recordScan, getStoredToken } from './rate-limiter';
import { Detector } from '../detector/engine';
import { ScanResult, CrawlResult, DetectorConfig } from '../detector/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface GitHubScanOptions {
    repoUrl: string;
    token?: string;
    maxFiles?: number;
    config: DetectorConfig;
}

export interface GitHubScanResult extends CrawlResult {
    repoUrl: string;
    projectType: 'static' | 'next' | 'vite' | 'react' | 'unknown';
    filesScanned: string[];
}

interface RepoInfo {
    owner: string;
    repo: string;
    branch: string;
    tempDir: string;
}

/**
 * Main GitHub Repository Scanner
 */
export class GitHubService {
    private detector: Detector;

    constructor() {
        this.detector = new Detector();
    }

    /**
     * Scan a GitHub repository for UI bugs
     */
    async scanRepository(options: GitHubScanOptions): Promise<GitHubScanResult> {
        // 1. Parse and validate URL
        const parsed = parseGitHubUrl(options.repoUrl);
        if (!parsed.isValid) {
            throw new Error(parsed.error || 'Invalid GitHub URL');
        }

        // 2. Check rate limit
        const token = options.token || await getStoredToken();
        const rateLimit = await checkRateLimit(token);
        if (!rateLimit.allowed) {
            throw new Error(rateLimit.message || 'Rate limit exceeded');
        }

        // 3. Validate repo exists
        const validation = await validateGitHubRepo(parsed.owner, parsed.repo);
        if (!validation.exists) {
            throw new Error(validation.error || 'Repository not found');
        }

        // 4. Download and extract repo
        const branch = parsed.branch || 'main';
        const repoInfo = await this.downloadRepo(parsed.owner, parsed.repo, branch, token);

        try {
            // 5. Detect project type and find HTML files
            const projectType = await this.detectProjectType(repoInfo.tempDir);
            const htmlFiles = await this.findHtmlFiles(repoInfo.tempDir, options.maxFiles || 20);

            if (htmlFiles.length === 0) {
                throw new Error('No HTML files found in repository. Make sure the repo contains static HTML or has a built output.');
            }

            // 6. Scan each HTML file
            const results: ScanResult[] = [];
            for (const htmlFile of htmlFiles) {
                try {
                    const fileUrl = `file://${htmlFile.replace(/\\/g, '/')}`;
                    const result = await this.detector.scan(fileUrl, options.config);

                    // Add file location context to bugs
                    const relativePath = path.relative(repoInfo.tempDir, htmlFile);
                    result.bugs = result.bugs.map(bug => ({
                        ...bug,
                        pageUrl: relativePath,
                        locationDescription: bug.locationDescription
                            ? `${relativePath} - ${bug.locationDescription}`
                            : relativePath
                    }));

                    result.url = relativePath;
                    results.push(result);
                } catch (e) {
                    console.error(`Failed to scan ${htmlFile}:`, e);
                }
            }

            // 7. Record the scan (for rate limiting)
            if (!token) {
                await recordScan();
            }

            // 8. Aggregate results
            const totalScore = results.reduce((acc, r) => acc + r.score, 0);
            const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

            return {
                rootUrl: options.repoUrl,
                repoUrl: options.repoUrl,
                pagesScanned: results.length,
                totalPagesFound: htmlFiles.length,
                aggregatedScore: avgScore,
                results,
                projectType,
                filesScanned: htmlFiles.map(f => path.relative(repoInfo.tempDir, f))
            };
        } finally {
            // Clean up temp directory
            await this.cleanup(repoInfo.tempDir);
        }
    }

    /**
     * Download repository to temp directory
     */
    private async downloadRepo(owner: string, repo: string, branch: string, token?: string): Promise<RepoInfo> {
        const tempDir = path.join(os.tmpdir(), `ui-bug-detector-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Try main branch first, then master
        const branches = [branch, 'main', 'master'];
        let lastError: Error | null = null;

        for (const branchToTry of branches) {
            try {
                const archiveUrl = getRepoArchiveUrl(owner, repo, branchToTry);
                const headers: Record<string, string> = {
                    'User-Agent': 'UI-Bug-Detector/1.0'
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(archiveUrl, { headers });

                if (!response.ok) {
                    if (response.status === 404) {
                        continue; // Try next branch
                    }
                    throw new Error(`Failed to download: ${response.status}`);
                }

                // Download and extract ZIP
                const arrayBuffer = await response.arrayBuffer();
                const zipPath = path.join(tempDir, 'repo.zip');
                await fs.writeFile(zipPath, Buffer.from(arrayBuffer));

                // Extract using built-in unzip (cross-platform)
                await this.extractZip(zipPath, tempDir);
                await fs.unlink(zipPath);

                // Find the extracted directory (usually repo-branch/)
                const entries = await fs.readdir(tempDir);
                const extractedDir = entries.find(e => e.startsWith(`${repo}-`));

                if (extractedDir) {
                    const fullPath = path.join(tempDir, extractedDir);
                    return { owner, repo, branch: branchToTry, tempDir: fullPath };
                }

                return { owner, repo, branch: branchToTry, tempDir };
            } catch (e: any) {
                lastError = e;
            }
        }

        throw lastError || new Error('Failed to download repository');
    }

    /**
     * Extract ZIP file
     */
    private async extractZip(zipPath: string, destDir: string): Promise<void> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // Use PowerShell on Windows, unzip on Unix
        const isWindows = process.platform === 'win32';
        const command = isWindows
            ? `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`
            : `unzip -q -o "${zipPath}" -d "${destDir}"`;

        await execAsync(command);
    }

    /**
     * Detect project type by examining package.json and file structure
     */
    private async detectProjectType(dir: string): Promise<'static' | 'next' | 'vite' | 'react' | 'unknown'> {
        try {
            const packageJsonPath = path.join(dir, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['next']) return 'next';
            if (deps['vite']) return 'vite';
            if (deps['react'] || deps['react-dom']) return 'react';
            return 'unknown';
        } catch {
            // No package.json = likely static HTML
            return 'static';
        }
    }

    /**
     * Find all HTML files in the repository
     */
    private async findHtmlFiles(dir: string, maxFiles: number): Promise<string[]> {
        const htmlFiles: string[] = [];
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '__pycache__'];

        const scan = async (currentDir: string) => {
            if (htmlFiles.length >= maxFiles) return;

            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });

                for (const entry of entries) {
                    if (htmlFiles.length >= maxFiles) break;

                    const fullPath = path.join(currentDir, entry.name);

                    if (entry.isDirectory()) {
                        if (!ignoreDirs.includes(entry.name)) {
                            await scan(fullPath);
                        }
                    } else if (entry.isFile() && entry.name.endsWith('.html')) {
                        htmlFiles.push(fullPath);
                    }
                }
            } catch (e) {
                // Ignore permission errors
            }
        };

        // Prioritize common HTML locations
        const priorityDirs = ['public', 'dist', 'build', 'out', 'static', 'www', '.'];
        for (const pd of priorityDirs) {
            const priorityPath = path.join(dir, pd);
            try {
                await fs.access(priorityPath);
                await scan(priorityPath);
            } catch { /* dir doesn't exist */ }
        }

        // If not enough files found, scan root
        if (htmlFiles.length < maxFiles) {
            await scan(dir);
        }

        return [...new Set(htmlFiles)]; // Deduplicate
    }

    /**
     * Clean up temporary files
     */
    private async cleanup(dir: string): Promise<void> {
        try {
            await fs.rm(dir, { recursive: true, force: true });
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    }
}

// Export singleton for convenience
export const githubService = new GitHubService();
