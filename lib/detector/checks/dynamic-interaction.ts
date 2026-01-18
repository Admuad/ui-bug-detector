import { Page } from 'playwright';
import { Bug } from '../types';

export async function checkDynamicInteraction(page: Page): Promise<Bug[]> {
    const bugs: Bug[] = [];

    // 1. Scroll Check
    // Scroll to bottom to trigger lazy loading and check for errors or weird shifts
    try {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 50); // Fast scroll
            });
        });
        // Wait a bit for animations/lazy loads
        await page.waitForTimeout(500);

        // Check if we can scroll back up
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);

    } catch (e: any) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'SCROLL_ERROR',
            severity: 'minor',
            message: 'Error occurred during page scrolling.',
            details: 'The automated scroller encountered an exception. This might indicate broken scroll listeners or heavy main thread blocking.',
            expectedBehavior: 'The page should scroll smoothly from top to bottom without errors.',
            locationDescription: 'Global Page Interaction'
        });
    }

    // 2. Interactive Element Check (Clicking)
    // Find buttons and links and try to click them.
    // We have to be careful not to navigate away permanently.
    // We'll collect a sample of interactive elements.
    const interactives = await page.$$('button, a[href^="#"], a[href^="/"], input[type="submit"]');

    // Limit to first 10 to check to save time
    const samples = interactives.slice(0, 10);

    for (const handle of samples) {
        try {
            const isVisible = await handle.isVisible();
            if (!isVisible) continue;

            const isDisabled = await handle.isDisabled();
            if (isDisabled) continue;

            // Get element info for reporting
            const tagName = await handle.evaluate(el => el.tagName.toLowerCase());
            const text = await handle.evaluate(el => el.textContent?.slice(0, 30).trim() || '');
            const outerHTML = await handle.evaluate(el => el.outerHTML.slice(0, 100));

            // Attempt click
            // We use a try-catch block to catch "element not clickable" or JS errors
            await handle.click({ timeout: 1000, trial: true }); // Trial click to see if it's interactable without actually clicking

            // If we got here, Playwright thinks it's clickable.
            // Now let's try a real click but catch navigation
            // actually, for safety in this version, we will stick to "interaction checks" that don't weirdly navigate.
            // A safe check is validation that it doesn't have z-index issues blocking it (which trial: true does).

            // Let's do a "soft" real click? No, navigation is tricky.
            // Let's stick to the trial click as proof of physical accessibility.
            // And we can check for broken event listeners if we inject code.

        } catch (e: any) {
            const outerHTML = await handle.evaluate(el => el.outerHTML.slice(0, 100)).catch(() => '<unknown>');

            bugs.push({
                id: crypto.randomUUID(),
                code: 'UNCLICKABLE_ELEMENT',
                severity: 'major',
                message: `Interactive element (${await handle.evaluate(e => e.tagName)}) appears unclickable.`,
                details: `Playwright could not click this element. It might be covered by another element, have 0 size, or act weirdly. Error: ${e.message.slice(0, 100)}`,
                expectedBehavior: 'Interactive elements like buttons and links should be clickable by the user.',
                locationDescription: `Element: ${outerHTML}`,
                elementHtml: outerHTML
            });
        }
    }

    // 3. Check for Broken Internal Links (404s)
    // We can gather all hrefs and check them against the origin?
    // That might be slow. Let's do a quick scan of hrefs.
    const currentUrl = new URL(page.url());
    const origin = currentUrl.origin;

    const hrefs = await page.$$eval('a', (as) => as.map(a => a.href));
    const uniqueInternalHrefs = Array.from(new Set(hrefs.filter(h => h.startsWith(origin) && !h.includes('#'))));

    // We won't fetch them all now, that's heavy.
    // But we can check for obviously bad ones or use `fetch` inside the page context for a faster check?
    // Let's implement a quick head check for up to 5 links.
    const linksCheck = await page.evaluate(async (params) => {
        const results = [];
        const limit = 5;
        const links = Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(h => h.startsWith(window.location.origin) && !h.includes('#'))
            .slice(0, limit);

        for (const url of links) {
            try {
                const res = await fetch(url, { method: 'HEAD' });
                if (res.status >= 400) {
                    results.push({ url, status: res.status });
                }
            } catch (e) {
                results.push({ url, status: 'network_error' });
            }
        }
        return results;
    }, {});

    for (const badLink of linksCheck) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'BROKEN_LINK',
            severity: 'major',
            message: `Broken internal link found: ${badLink.url}`,
            details: `The server returned status ${badLink.status} when accessing this link.`,
            expectedBehavior: 'All internal links should lead to valid pages (Status 200).',
            locationDescription: `Link to ${badLink.url}`
        });
    }

    return bugs;
}
