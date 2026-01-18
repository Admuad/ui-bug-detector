'use server';

import { Detector } from '@/lib/detector/engine';
import { ScanResult, CrawlResult } from '@/lib/detector/types';
import { Crawler } from '@/lib/detector/crawler';
import {
    githubService,
    parseGitHubUrl,
    checkRateLimit,
    storeToken,
    clearToken,
    getStoredToken,
    TOKEN_SECURITY_INFO
} from '@/lib/github';
import type { GitHubScanResult } from '@/lib/github';

export async function scanWebsite(prevState: any, formData: FormData) {
    const url = formData.get('url') as string;

    if (!url) {
        return { error: 'Please submit a valid URL.' };
    }

    // Basic URL validation
    let targetUrl = url;
    if (!url.startsWith('http')) {
        targetUrl = `https://${url}`;
    }

    try {
        const detector = new Detector();
        const result: ScanResult = await detector.scan(targetUrl, {
            checkLayout: true,
            checkInteraction: true,
            checkAccessibility: true,
            checkTypo: true,
            checkVisual: true
        });

        // Serialization for client
        return { success: true, data: result };

    } catch (error: any) {
        console.error('SERVER ACTION SCAN ERROR:', error);
        return { error: `Scan failed: ${error?.message || 'Unknown error'}` };
    }
}

export async function crawlWebsite(prevState: any, formData: FormData) {
    const url = formData.get('url') as string;
    if (!url) return { error: 'Please submit a valid URL.' };

    let targetUrl = url;
    if (!url.startsWith('http')) targetUrl = `https://${url}`;

    try {
        const crawler = new Crawler();
        const result = await crawler.crawl(targetUrl, {
            checkLayout: true,
            checkInteraction: true,
            checkAccessibility: true,
            checkTypo: true,
            checkVisual: true,
            // Include tablet for responsive testing
            viewports: [
                { width: 1440, height: 900, label: 'Desktop' },
                { width: 768, height: 1024, label: 'Tablet' }
            ]
        }, 15, 3); // Web UI: 15 pages, depth 3 (increased from 5/2)

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Crawl Error:', error);
        return { error: error.message || 'Crawl failed. Please try again.' };
    }
}

/**
 * Scan a GitHub repository for UI bugs
 */
export async function scanGitHubRepo(prevState: any, formData: FormData) {
    const repoUrl = formData.get('repoUrl') as string;

    if (!repoUrl) {
        return { error: 'Please enter a GitHub repository URL.' };
    }

    // Validate URL format first
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed.isValid) {
        return { error: parsed.error || 'Invalid GitHub URL format.' };
    }

    // Normalize URL to https://github.com/owner/repo
    const normalizedUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;

    try {
        // Check rate limit before proceeding
        const token = await getStoredToken();
        const rateLimit = await checkRateLimit(token);

        if (!rateLimit.allowed) {
            return {
                error: rateLimit.message,
                rateLimited: true,
                remainingTime: rateLimit.remainingTime
            };
        }

        const result: GitHubScanResult = await githubService.scanRepository({
            repoUrl: normalizedUrl,
            token,
            maxFiles: 20,
            config: {
                checkLayout: true,
                checkInteraction: true,
                checkAccessibility: true,
                checkTypo: true,
                checkVisual: true,
                viewports: [{ width: 1440, height: 900, label: 'Desktop' }]
            }
        });

        return { success: true, data: result };
    } catch (error: any) {
        console.error('GitHub Scan Error:', error);
        return { error: error.message || 'GitHub scan failed. Please try again.' };
    }
}

/**
 * Save GitHub token securely
 */
export async function saveGitHubToken(prevState: any, formData: FormData) {
    const token = formData.get('token') as string;

    if (!token) {
        return { error: 'Please enter a GitHub token.' };
    }

    const result = await storeToken(token);

    if (result.success) {
        return { success: true, message: 'Token saved securely.' };
    }

    return { error: result.error };
}

/**
 * Get current rate limit status (for UI display)
 */
export async function getRateLimitStatus() {
    const token = await getStoredToken();
    const rateLimit = await checkRateLimit(token);

    return {
        ...rateLimit,
        securityInfo: TOKEN_SECURITY_INFO
    };
}

/**
 * Clear stored GitHub token
 */
export async function clearGitHubToken() {
    await clearToken();
    return { success: true };
}
