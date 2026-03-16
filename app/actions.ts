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

export async function scanWebsite(prevState: unknown, formData: FormData) {
    const url = formData.get('url') as string;

    if (!url) {
        return { error: 'Please submit a valid URL.' };
    }

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

        return { success: true, data: result };

    } catch (error) {
        console.error('SERVER ACTION SCAN ERROR:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: `Scan failed: ${message}` };
    }
}

export async function crawlWebsite(prevState: unknown, formData: FormData) {
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
            viewports: [
                { width: 1440, height: 900, label: 'Desktop' },
                { width: 768, height: 1024, label: 'Tablet' }
            ]
        }, 15, 3);

        return { success: true, data: result };
    } catch (error) {
        console.error('Crawl Error:', error);
        const message = error instanceof Error ? error.message : 'Crawl failed. Please try again.';
        return { error: message };
    }
}

/**
 * Scan a GitHub repository for UI bugs
 */
export async function scanGitHubRepo(prevState: unknown, formData: FormData) {
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
    } catch (error) {
        console.error('GitHub Scan Error:', error);
        const message = error instanceof Error ? error.message : 'GitHub scan failed. Please try again.';
        return { error: message };
    }
}

/**
 * Save GitHub token securely
 */
export async function saveGitHubToken(prevState: unknown, formData: FormData) {
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
