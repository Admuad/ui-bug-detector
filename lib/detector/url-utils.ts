/**
 * URL Utilities for Crawler
 * Handles URL normalization, validation, and sitemap parsing
 */

export interface CrawlOptions {
    maxDepth: number;
    maxPages: number;
    respectRobotsTxt: boolean;
    includeSitemap: boolean;
    allowedPathPatterns?: RegExp[];
    excludedPathPatterns?: RegExp[];
    requestDelayMs: number;
    concurrency: number;
}

export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
    maxDepth: 3,
    maxPages: 50,
    respectRobotsTxt: true,
    includeSitemap: true,
    requestDelayMs: 500,
    concurrency: 2
};

/**
 * Normalize a URL to a canonical form for deduplication
 * - Removes trailing slashes (except for root)
 * - Removes fragments (#...)
 * - Sorts query parameters
 * - Lowercases hostname
 * - Removes default ports
 */
export function normalizeUrl(url: string, baseOrigin?: string): string | null {
    try {
        // Handle relative URLs
        const parsed = baseOrigin ? new URL(url, baseOrigin) : new URL(url);

        // Lowercase hostname
        parsed.hostname = parsed.hostname.toLowerCase();

        // Remove default ports
        if ((parsed.protocol === 'http:' && parsed.port === '80') ||
            (parsed.protocol === 'https:' && parsed.port === '443')) {
            parsed.port = '';
        }

        // Remove fragment
        parsed.hash = '';

        // Sort query parameters for consistent comparison
        if (parsed.search) {
            const params = new URLSearchParams(parsed.search);
            const sortedParams = new URLSearchParams([...params.entries()].sort());
            parsed.search = sortedParams.toString();
        }

        // Get the normalized URL
        let normalized = parsed.href;

        // Remove trailing slash (except for root path)
        if (parsed.pathname !== '/' && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        return normalized;
    } catch {
        return null;
    }
}

/**
 * Check if a URL is from the same origin
 */
export function isSameOrigin(url: string, baseOrigin: string): boolean {
    try {
        const parsedUrl = new URL(url, baseOrigin);
        const parsedBase = new URL(baseOrigin);
        return parsedUrl.origin === parsedBase.origin;
    } catch {
        return false;
    }
}

/**
 * Determine if a URL should be crawled based on options
 */
export function shouldCrawl(url: string, baseOrigin: string, options: Partial<CrawlOptions> = {}): boolean {
    // Must be same origin
    if (!isSameOrigin(url, baseOrigin)) {
        return false;
    }

    try {
        const parsed = new URL(url, baseOrigin);
        const pathname = parsed.pathname.toLowerCase();

        // Skip common non-page resources
        const skipExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
            '.pdf', '.zip', '.tar', '.gz',
            '.css', '.js', '.json', '.xml',
            '.mp3', '.mp4', '.wav', '.avi', '.mov',
            '.woff', '.woff2', '.ttf', '.eot',
            '.map'
        ];

        if (skipExtensions.some(ext => pathname.endsWith(ext))) {
            return false;
        }

        // Skip API and asset paths
        const skipPaths = ['/api/', '/_next/', '/static/', '/assets/', '/cdn-cgi/'];
        if (skipPaths.some(path => pathname.includes(path))) {
            return false;
        }

        // Check excluded patterns
        if (options.excludedPathPatterns) {
            if (options.excludedPathPatterns.some(pattern => pattern.test(pathname))) {
                return false;
            }
        }

        // Check allowed patterns (if specified, URL must match at least one)
        if (options.allowedPathPatterns && options.allowedPathPatterns.length > 0) {
            if (!options.allowedPathPatterns.some(pattern => pattern.test(pathname))) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Parse a sitemap.xml and extract all URLs
 * Handles both sitemap index files and regular sitemaps
 */
export async function parseSitemap(sitemapUrl: string): Promise<string[]> {
    const urls: string[] = [];

    try {
        const response = await fetch(sitemapUrl, {
            headers: {
                'User-Agent': 'UIBugDetector/1.0 (+https://github.com/ui-bug-detector)'
            }
        });

        if (!response.ok) {
            console.log(`[Sitemap] Could not fetch ${sitemapUrl}: ${response.status}`);
            return [];
        }

        const text = await response.text();

        // Check if it's a sitemap index (contains <sitemapindex>)
        if (text.includes('<sitemapindex')) {
            // Extract sitemap URLs from index
            const sitemapMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
            const nestedSitemaps: string[] = [];

            for (const match of sitemapMatches) {
                if (match[1]) {
                    nestedSitemaps.push(match[1].trim());
                }
            }

            // Recursively parse nested sitemaps (limit to first 5 to avoid infinite loops)
            for (const nestedUrl of nestedSitemaps.slice(0, 5)) {
                const nestedUrls = await parseSitemap(nestedUrl);
                urls.push(...nestedUrls);
            }
        } else {
            // Regular sitemap - extract all <loc> URLs
            const locMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);

            for (const match of locMatches) {
                if (match[1]) {
                    const url = match[1].trim();
                    // Skip image/video sitemaps
                    if (!url.includes('/image:') && !url.includes('/video:')) {
                        urls.push(url);
                    }
                }
            }
        }

        console.log(`[Sitemap] Found ${urls.length} URLs in ${sitemapUrl}`);
    } catch (error) {
        console.log(`[Sitemap] Error parsing ${sitemapUrl}:`, error);
    }

    return urls;
}

/**
 * Extract base domain from URL for display purposes
 */
export function getDisplayDomain(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

/**
 * Get a relative path from a full URL for display
 */
export function getRelativePath(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.pathname + parsed.search;
    } catch {
        return url;
    }
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
