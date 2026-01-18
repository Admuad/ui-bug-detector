import { Page } from 'playwright';
import { Bug } from '../types';

/**
 * Check navigation links on the page to verify they work correctly
 * Tests internal links with HEAD requests and detects common navigation issues
 */
export async function checkNavigation(page: Page): Promise<Bug[]> {
    const bugs: Bug[] = [];
    const pageUrl = page.url();
    const origin = new URL(pageUrl).origin;

    // Extract all navigation-related links
    const navData = await page.evaluate((baseOrigin) => {
        const links: { href: string; text: string; isNav: boolean; selector: string }[] = [];

        // Get links from navigation elements
        const navElements = document.querySelectorAll('nav a, [role="navigation"] a, .nav a, .navbar a, header a');
        navElements.forEach(a => {
            const anchor = a as HTMLAnchorElement;
            if (anchor.href && anchor.href.startsWith(baseOrigin)) {
                links.push({
                    href: anchor.href,
                    text: anchor.textContent?.trim().slice(0, 50) || '',
                    isNav: true,
                    selector: `nav a[href="${anchor.getAttribute('href')}"]`
                });
            }
        });

        // Get other internal links (limit to first 20)
        const otherLinks = document.querySelectorAll('a[href]');
        let count = 0;
        otherLinks.forEach(a => {
            if (count >= 20) return;
            const anchor = a as HTMLAnchorElement;
            if (anchor.href && anchor.href.startsWith(baseOrigin)) {
                const existing = links.find(l => l.href === anchor.href);
                if (!existing) {
                    links.push({
                        href: anchor.href,
                        text: anchor.textContent?.trim().slice(0, 50) || '',
                        isNav: false,
                        selector: `a[href="${anchor.getAttribute('href')}"]`
                    });
                    count++;
                }
            }
        });

        return links;
    }, origin);

    // Check for duplicate navigation links (same text, different URLs)
    const navLinks = navData.filter(l => l.isNav);
    const textToUrls = new Map<string, string[]>();

    for (const link of navLinks) {
        if (link.text) {
            const existing = textToUrls.get(link.text.toLowerCase()) || [];
            existing.push(link.href);
            textToUrls.set(link.text.toLowerCase(), existing);
        }
    }

    for (const [text, urls] of textToUrls) {
        const uniqueUrls = [...new Set(urls)];
        if (uniqueUrls.length > 1) {
            bugs.push({
                id: crypto.randomUUID(),
                code: 'NAV_DUPLICATE_TEXT',
                severity: 'minor',
                message: `Multiple navigation links with same text "${text}" point to different URLs.`,
                details: `Found ${uniqueUrls.length} different URLs for links labeled "${text}". This can confuse users.`,
                expectedBehavior: 'Navigation links with the same text should point to the same destination.',
                locationDescription: 'Navigation menu',
                suggestedFix: 'Ensure each navigation link has unique, descriptive text.',
                friendlyName: 'Duplicate Navigation Text'
            });
        }
    }

    // Test a sample of internal links with HEAD requests
    const linksToTest = navData.slice(0, 10);

    for (const link of linksToTest) {
        try {
            const response = await page.request.head(link.href, { timeout: 5000 });

            if (response.status() === 404) {
                bugs.push({
                    id: crypto.randomUUID(),
                    code: 'NAV_BROKEN_LINK',
                    severity: 'major',
                    message: `Broken link detected: "${link.text || link.href}"`,
                    details: `The link to ${link.href} returns a 404 Not Found error.`,
                    expectedBehavior: 'All navigation links should point to valid, accessible pages.',
                    locationDescription: `Link: "${link.text}" (${link.href})`,
                    suggestedFix: 'Fix or remove the broken link. Check if the target page exists.',
                    friendlyName: 'Broken Link'
                });
            } else if (response.status() >= 500) {
                bugs.push({
                    id: crypto.randomUUID(),
                    code: 'NAV_SERVER_ERROR',
                    severity: 'critical',
                    message: `Server error on linked page: "${link.text || link.href}"`,
                    details: `The link to ${link.href} returns a ${response.status()} server error.`,
                    expectedBehavior: 'Linked pages should not have server errors.',
                    locationDescription: `Link: "${link.text}" (${link.href})`,
                    suggestedFix: 'Investigate the server error on the linked page.',
                    friendlyName: 'Server Error'
                });
            }
        } catch (error: any) {
            // Timeout or network error - skip silently
            console.log(`[Navigation] Could not test ${link.href}: ${error.message}`);
        }
    }

    // Check for anchor links that don't have targets
    const anchorIssues = await page.evaluate(() => {
        const issues: { href: string; text: string }[] = [];
        const anchorLinks = document.querySelectorAll('a[href^="#"]');

        anchorLinks.forEach(a => {
            const anchor = a as HTMLAnchorElement;
            const targetId = anchor.getAttribute('href')?.slice(1);

            if (targetId && targetId !== '' && !document.getElementById(targetId)) {
                issues.push({
                    href: anchor.getAttribute('href') || '',
                    text: anchor.textContent?.trim().slice(0, 50) || ''
                });
            }
        });

        return issues.slice(0, 5);
    });

    for (const issue of anchorIssues) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'NAV_MISSING_ANCHOR',
            severity: 'minor',
            message: `Anchor link "${issue.text || issue.href}" points to non-existent element.`,
            details: `The anchor link ${issue.href} doesn't have a corresponding element with that ID on the page.`,
            expectedBehavior: 'Anchor links should point to existing elements on the page.',
            locationDescription: `Anchor: ${issue.href}`,
            suggestedFix: `Add an element with id="${issue.href.slice(1)}" or remove/fix the anchor link.`,
            friendlyName: 'Missing Anchor Target'
        });
    }

    return bugs;
}
