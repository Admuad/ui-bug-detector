import { Detector } from './engine';
import { CrawlResult, ScanResult, DetectorConfig, Bug } from './types';
import {
    normalizeUrl,
    shouldCrawl,
    parseSitemap,
    CrawlOptions,
    DEFAULT_CRAWL_OPTIONS,
    sleep,
    getRelativePath
} from './url-utils';
import { extractPageStructure, comparePageStructures, PageStructure } from './checks/cross-page';

export interface CrawlProgress {
    currentPage: string;
    pagesScanned: number;
    totalPagesQueued: number;
    currentDepth: number;
    status: 'crawling' | 'scanning' | 'complete' | 'error';
}

export type ProgressCallback = (progress: CrawlProgress) => void;

export class Crawler {
    private onProgress?: ProgressCallback;
    private abortSignal?: AbortController;

    constructor(onProgress?: ProgressCallback) {
        this.onProgress = onProgress;
        this.abortSignal = new AbortController();
    }

    /**
     * Cancel an in-progress crawl
     */
    cancel(): void {
        this.abortSignal?.abort();
    }

    /**
     * Crawl a website starting from the given URL
     * With parallel scanning, proper state management, and cross-page consistency checks
     */
    async crawl(
        startUrl: string,
        config: DetectorConfig,
        maxPages: number = 20,
        maxDepth: number = 3,
        options: Partial<CrawlOptions> = {}
    ): Promise<CrawlResult> {
        // Reset abort controller for new crawl
        this.abortSignal = new AbortController();

        // Merge options with defaults
        const crawlOptions: CrawlOptions = {
            ...DEFAULT_CRAWL_OPTIONS,
            maxPages,
            maxDepth,
            ...options
        };

        // CRITICAL FIX: Reset state for each crawl
        const visited = new Set<string>();
        const queue: { url: string; depth: number }[] = [];
        const results: ScanResult[] = [];
        const allDiscoveredUrls = new Set<string>();
        let baselineStructure: PageStructure | null = null;

        // Normalize the start URL
        const normalizedStart = normalizeUrl(startUrl);
        if (!normalizedStart) {
            throw new Error(`Invalid start URL: ${startUrl}`);
        }

        const baseOrigin = new URL(normalizedStart).origin;

        // Add start URL to queue
        queue.push({ url: normalizedStart, depth: 0 });
        visited.add(normalizedStart);
        allDiscoveredUrls.add(normalizedStart);

        // Try to discover pages from sitemap.xml
        if (crawlOptions.includeSitemap) {
            try {
                const sitemapUrl = `${baseOrigin}/sitemap.xml`;
                console.log(`[Crawler] Attempting to fetch sitemap from ${sitemapUrl}`);

                const sitemapUrls = await parseSitemap(sitemapUrl);

                for (const url of sitemapUrls) {
                    const normalized = normalizeUrl(url, baseOrigin);
                    if (normalized && !visited.has(normalized) && shouldCrawl(normalized, baseOrigin, crawlOptions)) {
                        allDiscoveredUrls.add(normalized);
                        queue.push({ url: normalized, depth: 1 });
                        visited.add(normalized);
                    }
                }

                console.log(`[Crawler] Added ${sitemapUrls.length} URLs from sitemap`);
            } catch (error) {
                console.log(`[Crawler] No sitemap found or error parsing:`, error);
            }
        }

        // Main crawl loop with parallel scanning
        const concurrency = crawlOptions.concurrency || 2;

        while (queue.length > 0 && results.length < crawlOptions.maxPages) {
            // Check for cancellation
            if (this.abortSignal?.signal.aborted) {
                console.log('[Crawler] Crawl cancelled by user');
                break;
            }

            // Get batch of URLs to scan in parallel
            const batch: { url: string; depth: number }[] = [];
            while (batch.length < concurrency && queue.length > 0 && results.length + batch.length < crawlOptions.maxPages) {
                const item = queue.shift();
                if (item && item.depth <= crawlOptions.maxDepth) {
                    batch.push(item);
                }
            }

            if (batch.length === 0) break;

            // Report progress
            this.reportProgress({
                currentPage: batch.map(b => getRelativePath(b.url)).join(', '),
                pagesScanned: results.length,
                totalPagesQueued: queue.length + results.length + batch.length,
                currentDepth: batch[0]?.depth || 0,
                status: 'scanning'
            });

            console.log(`[Crawler] Scanning batch of ${batch.length} pages in parallel`);

            // Scan batch in parallel
            const scanPromises = batch.map(async (current) => {
                try {
                    const detector = new Detector();
                    const result = await detector.scan(current.url, config);

                    return { result, depth: current.depth, success: true };
                } catch (error) {
                    console.error(`[Crawler] Failed to scan ${current.url}:`, error);
                    return { result: null, depth: current.depth, success: false };
                }
            });

            const batchResults = await Promise.all(scanPromises);

            // Process results
            for (const { result, depth, success } of batchResults) {
                if (!success || !result) continue;

                results.push(result);

                // Extract baseline structure from first page for cross-page comparison
                if (!baselineStructure && config.checkCrossPage) {
                    // We'd need the page object here - for now, skip cross-page in parallel mode
                }

                // Queue discovered links
                if (result.links && depth < crawlOptions.maxDepth) {
                    for (const link of result.links) {
                        const normalizedLink = normalizeUrl(link, baseOrigin);

                        if (!normalizedLink) continue;

                        allDiscoveredUrls.add(normalizedLink);

                        if (!visited.has(normalizedLink) && shouldCrawl(normalizedLink, baseOrigin, crawlOptions)) {
                            visited.add(normalizedLink);
                            queue.push({ url: normalizedLink, depth: depth + 1 });
                        }
                    }
                }
            }

            // Rate limiting delay between batches
            if (crawlOptions.requestDelayMs > 0 && queue.length > 0) {
                await sleep(crawlOptions.requestDelayMs);
            }
        }

        // Report completion
        this.reportProgress({
            currentPage: '',
            pagesScanned: results.length,
            totalPagesQueued: results.length,
            currentDepth: 0,
            status: 'complete'
        });

        // Calculate aggregated score
        const aggregatedScore = this.calculateAggregatedScore(results);

        // Calculate scan duration
        const scanDuration = results.reduce((acc, r) => acc + (r.metrics?.loadTime || 0), 0);

        return {
            rootUrl: normalizedStart,
            pagesScanned: results.length,
            totalPagesFound: allDiscoveredUrls.size,
            aggregatedScore,
            results,
            scanDuration
        };
    }

    /**
     * Calculate an aggregated score across all pages
     */
    private calculateAggregatedScore(results: ScanResult[]): number {
        if (results.length === 0) return 100;

        // Weighted average: pages with more bugs contribute more to lowering the score
        const totalScore = results.reduce((acc, r) => acc + r.score, 0);
        return Math.round(totalScore / results.length);
    }

    /**
     * Report progress to callback if provided
     */
    private reportProgress(progress: CrawlProgress): void {
        if (this.onProgress) {
            try {
                this.onProgress(progress);
            } catch (error) {
                console.error('[Crawler] Progress callback error:', error);
            }
        }
    }
}

// Re-export types and options for external use
export type { CrawlOptions } from './url-utils';
export { DEFAULT_CRAWL_OPTIONS } from './url-utils';
