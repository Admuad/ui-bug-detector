import { chromium, Browser, Page } from 'playwright';
import { ScanResult, Bug, DetectorConfig, Viewport, Severity } from './types';
import { checkLayout } from './checks/layout';
import { checkInteraction } from './checks/interaction';
import { checkAccessibility } from './checks/accessibility';
import { checkDynamicInteraction } from './checks/dynamic-interaction';
import { checkTypo } from './checks/typo';
import { checkVisual } from './checks/visual';
import { checkForms } from './checks/cross-page';
import { checkNavigation } from './checks/navigation';
import { normalizeUrl } from './url-utils';
import { semanticResolverScript } from './semantic-resolver';

const DEFAULT_VIEWPORTS: Viewport[] = [
    { width: 1440, height: 900, label: 'Desktop' },
    { width: 768, height: 1024, label: 'Tablet', isMobile: false }, // iPad equivalent
    { width: 390, height: 844, label: 'Mobile', isMobile: true } // iPhone 12/13/14 equivalent
];

// Maximum bugs per category to prevent report flooding
const MAX_BUGS_PER_CATEGORY = 10;

export class Detector {
    private browser: Browser | null = null;

    async scan(url: string, config: DetectorConfig): Promise<ScanResult> {
        try {
            this.browser = await chromium.launch({ headless: true });

            const viewports = config.viewports && config.viewports.length > 0 ? config.viewports : DEFAULT_VIEWPORTS;
            const allBugs: Bug[] = [];
            let screenshotBase64 = '';
            let totalLoadTime = 0;
            let consoleErrorsCount = 0;
            let discoveredLinks: string[] = [];
            let domSize = 0;

            for (const vp of viewports) {
                console.log(`[Detector] Scanning viewport: ${vp.label} (${vp.width}x${vp.height})`);

                // Configure context for mobile or desktop
                const contextOptions: any = {
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: vp.deviceScaleFactor || (vp.isMobile ? 3 : 1),
                    isMobile: vp.isMobile || false,
                    hasTouch: vp.isMobile || false,
                    userAgent: vp.isMobile
                        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
                        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                };

                const context = await this.browser.newContext(contextOptions);
                const page = await context.newPage();
                const consoleErrors: string[] = [];

                // 1. Setup Listeners
                page.on('console', msg => {
                    if (msg.type() === 'error') {
                        const text = msg.text();
                        // Filter out common non-actionable errors
                        if (!text.includes('Failed to load resource') &&
                            !text.includes('net::ERR_') &&
                            !text.includes('[violation]')) {
                            consoleErrors.push(text);
                        }
                    }
                });

                page.on('pageerror', exception => {
                    consoleErrors.push(exception.message);
                });

                // 2. Navigation with timeout handling
                const startTime = Date.now();
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    // Wait for network to settle (but don't fail if it doesn't)
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
                        console.log(`[Detector] Network still active, proceeding with scan`);
                    });
                } catch (navError: any) {
                    console.error(`[Detector] Navigation error:`, navError.message);
                    throw navError;
                }
                totalLoadTime += (Date.now() - startTime);

                // 2.5 Inject Semantic Resolver
                await page.addInitScript(semanticResolverScript);
                await page.evaluate(semanticResolverScript); // Also run it for the current page state

                // Get DOM size
                if (vp === viewports[0]) {
                    domSize = await page.evaluate(() => document.querySelectorAll('*').length);
                }

                // 3. Capture Screenshot (re-enabled with size limits)
                if (vp === viewports[0] && (config.screenshotQuality ?? 60) > 0) {
                    try {
                        const screenshot = await page.screenshot({
                            fullPage: true,
                            type: 'jpeg',
                            quality: config.screenshotQuality ?? 60
                        });
                        // Only include if under 500KB
                        if (screenshot.length < 500000) {
                            screenshotBase64 = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
                        } else {
                            console.log(`[Detector] Screenshot too large (${Math.round(screenshot.length / 1024)}KB), skipping`);
                        }
                    } catch (screenshotError) {
                        console.error('[Detector] Screenshot failed:', screenshotError);
                    }
                }

                // 4. Run Checks
                const currentUrl = page.url();
                const maxBugs = config.maxBugsPerCategory ?? MAX_BUGS_PER_CATEGORY;

                if (config.checkLayout) {
                    try {
                        const layoutBugs = await checkLayout(page);
                        allBugs.push(...this.limitAndTagBugs(layoutBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) {
                        console.error("[Detector] Layout check failed:", e);
                    }
                }

                if (config.checkInteraction) {
                    try {
                        const interactionBugs = await checkInteraction(page);
                        allBugs.push(...this.limitAndTagBugs(interactionBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Interaction check failed:", e); }

                    try {
                        const dynamicBugs = await checkDynamicInteraction(page);
                        allBugs.push(...this.limitAndTagBugs(dynamicBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Dynamic Interaction check failed:", e); }

                    // Form validation checks (only on desktop)
                    if (vp === viewports[0]) {
                        try {
                            const formBugs = await checkForms(page);
                            allBugs.push(...this.limitAndTagBugs(formBugs, vp.label, currentUrl, maxBugs));
                        } catch (e) { console.error("[Detector] Form check failed:", e); }
                    }
                }

                if (config.checkTypo) {
                    try {
                        const typoBugs = await checkTypo(page, config.customWhitelist);
                        allBugs.push(...this.limitAndTagBugs(typoBugs, vp.label, currentUrl, maxBugs));
                    } catch (e: any) {
                        console.error("[Detector] Typo check failed:", e);
                    }
                }

                if (config.checkVisual) {
                    try {
                        const visualBugs = await checkVisual(page);
                        allBugs.push(...this.limitAndTagBugs(visualBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Visual check failed:", e); }
                }

                if (config.checkAccessibility && vp === viewports[0]) {
                    try {
                        const a11yBugs = await checkAccessibility(page);
                        // Group and limit a11y bugs to prevent flooding
                        const groupedA11y = this.groupAccessibilityBugs(a11yBugs);
                        allBugs.push(...groupedA11y.slice(0, maxBugs * 2));
                    } catch (e) {
                        console.error("[Detector] A11y check failed:", e);
                    }

                    // Navigation flow testing (only on desktop/first viewport)
                    try {
                        const navBugs = await checkNavigation(page);
                        allBugs.push(...this.limitAndTagBugs(navBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) {
                        console.error("[Detector] Navigation check failed:", e);
                    }
                }

                // Add Console Errors as bugs (limited)
                consoleErrors.slice(0, 5).forEach(err => {
                    allBugs.push({
                        id: crypto.randomUUID(),
                        code: 'CONSOLE_ERROR',
                        severity: 'major', // Downgraded from critical
                        message: `[${vp.label}] Console Error: ${err.slice(0, 80)}...`,
                        details: err,
                        expectedBehavior: 'The console should be free of errors.',
                        locationDescription: `Console Log (${vp.label})`,
                        pageUrl: currentUrl,
                        friendlyName: getFriendlyName('CONSOLE_ERROR'),
                        suggestedFix: 'Debug the JavaScript error in the browser console and fix the underlying issue.'
                    });
                });

                // 5. AI Enrichment Pass (window.ai)
                // This converts heuristic names/locations into natural human descriptions
                const enrichedBugs = await page.evaluate(`
                    (async function() {
                        if (typeof window.SemanticResolver === 'undefined') return [];
                        const bugsToEnrich = ${JSON.stringify(allBugs.filter(b => b.pageUrl === currentUrl))};
                        
                        const results = [];
                        for (const bug of bugsToEnrich) {
                            try {
                                const enriched = await window.SemanticResolver.enrichWithAI(bug);
                                results.push(enriched);
                            } catch (e) {
                                results.push(bug); // Fallback to original
                            }
                        }
                        return results;
                    })()
                `).catch(() => null);

                if (enrichedBugs && Array.isArray(enrichedBugs)) {
                    // Update the bugs in allBugs for this current URL
                    enrichedBugs.forEach(eb => {
                        const idx = allBugs.findIndex(b => b.id === eb.id);
                        if (idx !== -1) allBugs[idx] = eb;
                    });
                }

                await context.close();
            }

            // Ensure pageUrl is set for all bugs
            allBugs.forEach(b => { if (!b.pageUrl) b.pageUrl = url; });

            // Deduplicate bugs with improved logic
            const uniqueBugs = this.deduplicateBugs(allBugs);

            // Calculate score with improved algorithm
            const score = this.calculateScore(uniqueBugs);

            // Add priority scores to bugs
            const prioritizedBugs = this.addPriorityScores(uniqueBugs);

            // Sanitize response for Next.js Server Actions
            return JSON.parse(JSON.stringify({
                url,
                score,
                timestamp: new Date().toISOString(),
                screenshot: screenshotBase64,
                bugs: prioritizedBugs.sort((a: Bug, b: Bug) => (b.priorityScore || 0) - (a.priorityScore || 0)),
                metrics: {
                    loadTime: Math.round(totalLoadTime / viewports.length),
                    domSize,
                    consoleErrors: consoleErrorsCount
                },
                links: discoveredLinks
            }));

        } catch (error) {
            console.error("[Detector] Scan failed:", error);
            throw error;
        } finally {
            if (this.browser) await this.browser.close();
        }
    }

    /**
     * Limit bugs per check and add viewport/page tags
     */
    private limitAndTagBugs(bugs: Bug[], viewport: string, pageUrl: string, limit: number): Bug[] {
        return bugs.slice(0, limit).map(b => ({
            ...b,
            message: `[${viewport}] ${b.message}`,
            locationDescription: b.locationDescription
                ? `${b.locationDescription} (${viewport})`
                : `Viewport: ${viewport}`,
            pageUrl,
            friendlyName: getFriendlyName(b.code)
        }));
    }

    /**
     * Group accessibility bugs to reduce noise
     * Combines multiple A11Y_REGION violations into a single grouped bug
     */
    private groupAccessibilityBugs(bugs: Bug[]): Bug[] {
        const grouped: Map<string, Bug[]> = new Map();
        const standalone: Bug[] = [];

        for (const bug of bugs) {
            // Group certain repetitive violations
            if (bug.code === 'A11Y_REGION' || bug.code === 'A11Y_LANDMARK-ONE-MAIN') {
                const key = bug.code;
                if (!grouped.has(key)) {
                    grouped.set(key, []);
                }
                grouped.get(key)!.push(bug);
            } else {
                standalone.push(bug);
            }
        }

        // Convert groups to summary bugs
        const summaryBugs: Bug[] = [];
        for (const [code, groupBugs] of grouped) {
            if (groupBugs.length > 0) {
                const firstBug = groupBugs[0];
                summaryBugs.push({
                    ...firstBug,
                    message: `${firstBug.message} (${groupBugs.length} occurrences)`,
                    details: `${groupBugs.length} elements violate this rule. ${firstBug.details || ''}`,
                    friendlyName: getFriendlyName(code)
                });
            }
        }

        return [...summaryBugs, ...standalone];
    }

    /**
     * Extract links from the page for crawling
     */
    private async extractLinks(page: Page): Promise<string[]> {
        const origin = new URL(page.url()).origin;

        const links = await page.evaluate((baseOrigin) => {
            const allLinks: string[] = [];

            // Standard anchor tags
            document.querySelectorAll('a[href]').forEach(a => {
                const href = (a as HTMLAnchorElement).href;
                if (href) allLinks.push(href);
            });

            // Also check for links in buttons with onclick
            document.querySelectorAll('[onclick]').forEach(el => {
                const onclick = el.getAttribute('onclick') || '';
                const match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
                if (match) {
                    try {
                        allLinks.push(new URL(match[1], baseOrigin).href);
                    } catch { }
                }
            });

            return allLinks;
        }, origin);

        // Filter and normalize
        const normalized = new Set<string>();
        for (const link of links) {
            const norm = normalizeUrl(link, origin);
            if (norm && (link.startsWith(origin) || link.startsWith('/'))) {
                normalized.add(norm);
            }
        }

        // Remove the current page from the list
        normalized.delete(normalizeUrl(page.url(), origin) || '');

        return Array.from(normalized);
    }

    /**
     * Improved deduplication that considers:
     * - Code + message similarity
     * - Selector uniqueness
     * - Location description
     */
    private deduplicateBugs(bugs: Bug[]): Bug[] {
        const seen = new Map<string, Bug>();

        for (const bug of bugs) {
            // Create a more robust key
            const messageCore = bug.message.replace(/\[Desktop\]|\[Mobile\]/g, '').trim().slice(0, 50);
            const key = `${bug.code}|${messageCore}|${bug.selector || ''}`;

            if (!seen.has(key)) {
                seen.set(key, bug);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Calculate score with logarithmic penalties
     * First few bugs hurt more, additional bugs have diminishing impact
     */
    private calculateScore(bugs: Bug[]): number {
        if (bugs.length === 0) return 100;

        let totalPenalty = 0;
        const penaltyByCode: Map<string, number> = new Map();

        // Base penalties by severity
        const basePenalty: Record<Severity, number> = {
            critical: 12,
            major: 6,
            minor: 2,
            optimization: 1
        };

        // Max penalty per bug type (prevents one category from tanking the score)
        const maxPenaltyPerType: Record<Severity, number> = {
            critical: 30,
            major: 20,
            minor: 10,
            optimization: 5
        };

        for (const bug of bugs) {
            const code = bug.code;
            const currentCodePenalty = penaltyByCode.get(code) || 0;
            const maxForType = maxPenaltyPerType[bug.severity];

            // Apply diminishing returns within each code type
            if (currentCodePenalty < maxForType) {
                // Diminishing formula: each subsequent bug of same type penalizes less
                const count = penaltyByCode.has(code) ? 1 : 0;
                const diminishingFactor = 1 / (1 + count * 0.3);
                const penalty = basePenalty[bug.severity] * diminishingFactor;

                const actualPenalty = Math.min(penalty, maxForType - currentCodePenalty);
                penaltyByCode.set(code, currentCodePenalty + actualPenalty);
                totalPenalty += actualPenalty;
            }
        }

        // Apply global diminishing returns
        // Score = 100 - (penalty with global cap)
        const globalMaxPenalty = 70; // Never go below 30 just from many small issues
        const adjustedPenalty = Math.min(totalPenalty, globalMaxPenalty);

        return Math.max(0, Math.round(100 - adjustedPenalty));
    }

    /**
     * Add priority scores to bugs based on severity, visibility, and type
     * Higher score = more urgent to fix
     */
    private addPriorityScores(bugs: Bug[]): Bug[] {
        // Priority weights by severity
        const severityWeight: Record<Severity, number> = {
            critical: 40,
            major: 25,
            minor: 10,
            optimization: 5
        };

        // Visibility/impact multipliers by bug code
        const impactMultiplier: Record<string, number> = {
            'LAYOUT_OVERFLOW': 1.5,      // Affects all users
            'VISUAL_OVERLAP': 1.3,       // Very visible
            'A11Y_COLOR-CONTRAST': 1.4,  // Affects many users
            'UNCLICKABLE_ELEMENT': 1.8,  // Blocks functionality
            'NAV_BROKEN_LINK': 1.6,      // Breaks navigation
            'NAV_SERVER_ERROR': 2.0,     // Critical
            'CONSOLE_ERROR': 1.2,        // May indicate JS issues
            'MEDIA_BROKEN': 1.4,         // Very visible
            'FORM_MISSING_LABEL': 1.3,   // A11y issue
        };

        // Count occurrences of each bug code for frequency penalty
        const codeFrequency = new Map<string, number>();
        for (const bug of bugs) {
            codeFrequency.set(bug.code, (codeFrequency.get(bug.code) || 0) + 1);
        }

        return bugs.map(bug => {
            const baseScore = severityWeight[bug.severity];
            const multiplier = impactMultiplier[bug.code] || 1.0;
            const frequency = codeFrequency.get(bug.code) || 1;

            // More occurrences = slightly lower priority per bug (they share the urgency)
            const frequencyAdjustment = 1 / Math.sqrt(frequency);

            // Calculate priority score (0-100)
            const rawScore = baseScore * multiplier * frequencyAdjustment;
            const priorityScore = Math.min(100, Math.round(rawScore * 2));

            return { ...bug, priorityScore };
        });
    }
}

function getFriendlyName(code: string): string {
    const map: Record<string, string> = {
        'LAYOUT_OVERFLOW': 'Horizontal Scroll',
        'VISUAL_OVERLAP': 'Element Overlap',
        'SMALL_TARGET': 'Touch Target Too Small',
        'EMPTY_LINK': 'Broken or Empty Link',
        'A11Y_IMG_ALT': 'Missing Image Alt Text',
        'A11Y_COLOR-CONTRAST': 'Low Color Contrast',
        'A11Y_REGION': 'Missing Landmarks',
        'A11Y_LANDMARK-ONE-MAIN': 'Missing Main Landmark',
        'A11Y_LINK-IN-TEXT-BLOCK': 'Indistinguishable Link',
        'TYPO': 'Spelling Error',
        'LAYOUT_CLIPPED': 'Clipped Content',
        'LAYOUT_CRAMPED': 'Cramped UI (No Padding)',
        'VISUAL_MISALIGNMENT': 'Misaligned Elements',
        'VISUAL_INCONSISTENT_SPACING': 'Inconsistent Spacing',
        'VISUAL_LONG_LINES': 'Line Length Too Wide',
        'MEDIA_BROKEN': 'Broken Image/Media',
        'SCROLL_ERROR': 'Scroll Interaction Failed',
        'UNCLICKABLE_ELEMENT': 'Element Unclickable',
        'BROKEN_LINK': 'Broken Internal Link',
        'CONSOLE_ERROR': 'Browser Console Error',
        'Z_INDEX_CONFLICT': 'Z-Index Stacking Issue',
        'FONT_LOADING': 'Font Loading Issue'
    };
    return map[code] || code.replace(/_/g, ' ').replace(/A11Y /i, '');
}
