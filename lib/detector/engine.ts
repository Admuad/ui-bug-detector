import { chromium, Browser, Page } from 'playwright';
import type { BrowserContextOptions } from 'playwright';
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
    { width: 768, height: 1024, label: 'Tablet', isMobile: false },
    { width: 390, height: 844, label: 'Mobile', isMobile: true }
];

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

                const contextOptions: BrowserContextOptions = {
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

                page.on('console', msg => {
                    if (msg.type() === 'error') {
                        const text = msg.text();
                        if (!text.includes('Failed to load resource') &&
                            !text.includes('net::ERR_') &&
                            !text.includes('[violation]')) {
                            consoleErrors.push(text);
                            consoleErrorsCount++;
                        }
                    }
                });

                page.on('pageerror', exception => {
                    consoleErrors.push(exception.message);
                    consoleErrorsCount++;
                });

                const startTime = Date.now();
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
                        console.log(`[Detector] Network still active, proceeding with scan`);
                    });
                } catch (navError) {
                    const message = navError instanceof Error ? navError.message : String(navError);
                    console.error(`[Detector] Navigation error:`, message);
                    throw navError;
                }
                totalLoadTime += (Date.now() - startTime);

                await page.addInitScript(semanticResolverScript);
                await page.evaluate(semanticResolverScript);

                if (vp === viewports[0]) {
                    domSize = await page.evaluate(() => document.querySelectorAll('*').length);
                    discoveredLinks = await extractLinks(page);
                }

                if (vp === viewports[0] && (config.screenshotQuality ?? 60) > 0) {
                    try {
                        const screenshot = await page.screenshot({
                            fullPage: true,
                            type: 'jpeg',
                            quality: config.screenshotQuality ?? 60
                        });
                        if (screenshot.length < 500000) {
                            screenshotBase64 = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
                        }
                    } catch (screenshotError) {
                        console.error('[Detector] Screenshot failed:', screenshotError);
                    }
                }

                const currentUrl = page.url();
                const maxBugs = config.maxBugsPerCategory ?? MAX_BUGS_PER_CATEGORY;

                if (config.checkLayout) {
                    try {
                        const layoutBugs = await checkLayout(page);
                        allBugs.push(...limitAndTagBugs(layoutBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) {
                        console.error("[Detector] Layout check failed:", e);
                    }
                }

                if (config.checkInteraction) {
                    try {
                        const interactionBugs = await checkInteraction(page);
                        allBugs.push(...limitAndTagBugs(interactionBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Interaction check failed:", e); }

                    try {
                        const dynamicBugs = await checkDynamicInteraction(page);
                        allBugs.push(...limitAndTagBugs(dynamicBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Dynamic Interaction check failed:", e); }

                    if (vp === viewports[0]) {
                        try {
                            const formBugs = await checkForms(page);
                            allBugs.push(...limitAndTagBugs(formBugs, vp.label, currentUrl, maxBugs));
                        } catch (e) { console.error("[Detector] Form check failed:", e); }
                    }
                }

                if (config.checkTypo) {
                    try {
                        const typoBugs = await checkTypo(page, config.customWhitelist);
                        allBugs.push(...limitAndTagBugs(typoBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) {
                        console.error("[Detector] Typo check failed:", e);
                    }
                }

                if (config.checkVisual) {
                    try {
                        const visualBugs = await checkVisual(page);
                        allBugs.push(...limitAndTagBugs(visualBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) { console.error("[Detector] Visual check failed:", e); }
                }

                if (config.checkAccessibility && vp === viewports[0]) {
                    try {
                        const a11yBugs = await checkAccessibility(page);
                        const groupedA11y = groupAccessibilityBugs(a11yBugs);
                        allBugs.push(...groupedA11y.slice(0, maxBugs * 2));
                    } catch (e) {
                        console.error("[Detector] A11y check failed:", e);
                    }

                    try {
                        const navBugs = await checkNavigation(page);
                        allBugs.push(...limitAndTagBugs(navBugs, vp.label, currentUrl, maxBugs));
                    } catch (e) {
                        console.error("[Detector] Navigation check failed:", e);
                    }
                }

                consoleErrors.slice(0, 5).forEach(err => {
                    allBugs.push({
                        id: crypto.randomUUID(),
                        code: 'CONSOLE_ERROR',
                        severity: 'major',
                        message: `[${vp.label}] Console Error: ${err.slice(0, 80)}...`,
                        details: err,
                        expectedBehavior: 'The console should be free of errors.',
                        locationDescription: `Console Log (${vp.label})`,
                        pageUrl: currentUrl,
                        friendlyName: getFriendlyName('CONSOLE_ERROR'),
                        suggestedFix: 'Debug the JavaScript error in the browser console and fix the underlying issue.'
                    });
                });

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
                    enrichedBugs.forEach(eb => {
                        const idx = allBugs.findIndex(b => b.id === eb.id);
                        if (idx !== -1) allBugs[idx] = eb;
                    });
                }

                await context.close();
            }

            allBugs.forEach(b => { if (!b.pageUrl) b.pageUrl = url; });

            const uniqueBugs = deduplicateBugs(allBugs);
            const score = calculateScore(uniqueBugs);
            const prioritizedBugs = addPriorityScores(uniqueBugs);
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

}

export function limitAndTagBugs(bugs: Bug[], viewport: string, pageUrl: string, limit: number): Bug[] {
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

export function groupAccessibilityBugs(bugs: Bug[]): Bug[] {
    const grouped: Map<string, Bug[]> = new Map();
    const standalone: Bug[] = [];

    for (const bug of bugs) {
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

export async function extractLinks(page: Page): Promise<string[]> {
    const origin = new URL(page.url()).origin;

    const links = await page.evaluate((baseOrigin) => {
        const allLinks: string[] = [];

        document.querySelectorAll('a[href]').forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (href) allLinks.push(href);
        });

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

    const normalized = new Set<string>();
    for (const link of links) {
        const norm = normalizeUrl(link, origin);
        if (norm && (link.startsWith(origin) || link.startsWith('/'))) {
            normalized.add(norm);
        }
    }

    normalized.delete(normalizeUrl(page.url(), origin) || '');

    return Array.from(normalized);
}

export function deduplicateBugs(bugs: Bug[]): Bug[] {
    const seen = new Map<string, Bug>();

    for (const bug of bugs) {
        const messageCore = bug.message.replace(/\[Desktop\]|\[Mobile\]/g, '').trim().slice(0, 50);
        const key = `${bug.code}|${messageCore}|${bug.selector || ''}`;

        if (!seen.has(key)) {
            seen.set(key, bug);
        }
    }

    return Array.from(seen.values());
}

export function calculateScore(bugs: Bug[]): number {
    if (bugs.length === 0) return 100;

    let totalPenalty = 0;
    const penaltyByCode: Map<string, number> = new Map();

    const basePenalty: Record<Severity, number> = {
        critical: 12,
        major: 6,
        minor: 2,
        optimization: 1
    };

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

        if (currentCodePenalty < maxForType) {
            // Diminishing returns: each subsequent bug of the same type penalizes less
            // to prevent one noisy check from dominating the score
            const count = penaltyByCode.has(code) ? 1 : 0;
            const diminishingFactor = 1 / (1 + count * 0.3);
            const penalty = basePenalty[bug.severity] * diminishingFactor;

            const actualPenalty = Math.min(penalty, maxForType - currentCodePenalty);
            penaltyByCode.set(code, currentCodePenalty + actualPenalty);
            totalPenalty += actualPenalty;
        }
    }

    const globalMaxPenalty = 70;
    const adjustedPenalty = Math.min(totalPenalty, globalMaxPenalty);

    return Math.max(0, Math.round(100 - adjustedPenalty));
}

export function addPriorityScores(bugs: Bug[]): Bug[] {
    const severityWeight: Record<Severity, number> = {
        critical: 40,
        major: 25,
        minor: 10,
        optimization: 5
    };

    const impactMultiplier: Record<string, number> = {
        'LAYOUT_OVERFLOW': 1.5,
        'VISUAL_OVERLAP': 1.3,
        'A11Y_COLOR-CONTRAST': 1.4,
        'UNCLICKABLE_ELEMENT': 1.8,
        'NAV_BROKEN_LINK': 1.6,
        'NAV_SERVER_ERROR': 2.0,
        'CONSOLE_ERROR': 1.2,
        'MEDIA_BROKEN': 1.4,
        'FORM_MISSING_LABEL': 1.3,
    };

    const codeFrequency = new Map<string, number>();
    for (const bug of bugs) {
        codeFrequency.set(bug.code, (codeFrequency.get(bug.code) || 0) + 1);
    }

    return bugs.map(bug => {
        const baseScore = severityWeight[bug.severity];
        const multiplier = impactMultiplier[bug.code] || 1.0;
        const frequency = codeFrequency.get(bug.code) || 1;
        const frequencyAdjustment = 1 / Math.sqrt(frequency);
        const rawScore = baseScore * multiplier * frequencyAdjustment;
        const priorityScore = Math.min(100, Math.round(rawScore * 2));

        return { ...bug, priorityScore };
    });
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
