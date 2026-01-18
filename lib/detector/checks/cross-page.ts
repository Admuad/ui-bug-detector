import { Page } from 'playwright';
import { Bug } from '../types';

/**
 * Cross-page consistency check
 * Captures page structure for comparison across pages
 */
export interface PageStructure {
    url: string;
    headerContent: string | null;
    footerContent: string | null;
    navigationLinks: string[];
    primaryColor: string | null;
    fontFamily: string | null;
    hasLogo: boolean;
}

/**
 * Extract page structure elements for cross-page comparison
 */
export async function extractPageStructure(page: Page): Promise<PageStructure> {
    const structure = await page.evaluate(`
        (function() {
            // Helper to get text content safely
            const getText = (el) => el ? el.textContent?.trim().slice(0, 200) || null : null;
            
            // Find header
            const header = document.querySelector('header, [role="banner"], nav') || 
                           document.querySelector('.header, .navbar, .nav, #header, #navbar');
            
            // Find footer
            const footer = document.querySelector('footer, [role="contentinfo"]') ||
                           document.querySelector('.footer, #footer');
            
            // Extract navigation links
            const navElement = document.querySelector('nav, [role="navigation"], .nav, .navbar');
            const navLinks = navElement 
                ? Array.from(navElement.querySelectorAll('a')).map(a => a.textContent?.trim()).filter(Boolean)
                : [];
            
            // Get primary color (from buttons or links)
            let primaryColor = null;
            const button = document.querySelector('button:not([disabled]), .btn, [role="button"]');
            if (button) {
                const style = window.getComputedStyle(button);
                if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    primaryColor = style.backgroundColor;
                }
            }
            
            // Get font family
            const body = document.body;
            const fontFamily = window.getComputedStyle(body).fontFamily.split(',')[0].trim();
            
            // Check for logo
            const hasLogo = !!(
                document.querySelector('img[alt*="logo" i], img[class*="logo" i], .logo, #logo') ||
                document.querySelector('svg[class*="logo" i]')
            );
            
            return {
                url: window.location.href,
                headerContent: getText(header),
                footerContent: getText(footer),
                navigationLinks: navLinks.slice(0, 10),
                primaryColor,
                fontFamily,
                hasLogo
            };
        })()
    `);

    return structure as PageStructure;
}

/**
 * Compare two page structures and find inconsistencies
 */
export function comparePageStructures(
    baseline: PageStructure,
    current: PageStructure
): Bug[] {
    const bugs: Bug[] = [];

    // Check header consistency
    if (baseline.headerContent && current.headerContent) {
        // Calculate similarity (simple length-based heuristic)
        const lengthDiff = Math.abs(baseline.headerContent.length - current.headerContent.length);
        const avgLength = (baseline.headerContent.length + current.headerContent.length) / 2;

        if (lengthDiff > avgLength * 0.5) {
            bugs.push({
                id: crypto.randomUUID(),
                code: 'CROSS_PAGE_HEADER_MISMATCH',
                severity: 'minor',
                message: 'Header content differs significantly from other pages.',
                details: `The header on ${current.url} appears different from the baseline page. This may indicate inconsistent navigation or branding.`,
                expectedBehavior: 'Headers should be consistent across all pages for good UX.',
                locationDescription: `Page: ${current.url}`,
                suggestedFix: 'Ensure the header component is shared across all pages and rendered consistently.',
                friendlyName: 'Inconsistent Header'
            });
        }
    } else if (baseline.headerContent && !current.headerContent) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'CROSS_PAGE_MISSING_HEADER',
            severity: 'major',
            message: 'Page is missing a header/navigation.',
            details: `The page ${current.url} doesn't have a detectable header, while other pages do.`,
            expectedBehavior: 'All pages should have consistent navigation.',
            locationDescription: `Page: ${current.url}`,
            suggestedFix: 'Add a header or navigation element to this page.',
            friendlyName: 'Missing Header'
        });
    }

    // Check footer consistency
    if (baseline.footerContent && !current.footerContent) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'CROSS_PAGE_MISSING_FOOTER',
            severity: 'minor',
            message: 'Page is missing a footer.',
            details: `The page ${current.url} doesn't have a detectable footer, while other pages do.`,
            expectedBehavior: 'All pages should have consistent footer information.',
            locationDescription: `Page: ${current.url}`,
            suggestedFix: 'Add a footer element to this page with consistent content.',
            friendlyName: 'Missing Footer'
        });
    }

    // Check font consistency
    if (baseline.fontFamily && current.fontFamily && baseline.fontFamily !== current.fontFamily) {
        bugs.push({
            id: crypto.randomUUID(),
            code: 'CROSS_PAGE_FONT_MISMATCH',
            severity: 'minor',
            message: 'Different font family used on this page.',
            details: `This page uses "${current.fontFamily}" while others use "${baseline.fontFamily}".`,
            expectedBehavior: 'Font families should be consistent across all pages.',
            locationDescription: `Page: ${current.url}`,
            suggestedFix: 'Ensure global CSS applies the same font-family to all pages.',
            friendlyName: 'Inconsistent Font'
        });
    }

    // Check navigation links
    if (baseline.navigationLinks.length > 0 && current.navigationLinks.length > 0) {
        const baselineSet = new Set(baseline.navigationLinks);
        const currentSet = new Set(current.navigationLinks);

        // Check for significantly different nav
        const intersection = baseline.navigationLinks.filter(x => currentSet.has(x));
        const similarity = intersection.length / Math.max(baselineSet.size, currentSet.size);

        if (similarity < 0.5 && baselineSet.size > 2) {
            bugs.push({
                id: crypto.randomUUID(),
                code: 'CROSS_PAGE_NAV_MISMATCH',
                severity: 'minor',
                message: 'Navigation links differ significantly from other pages.',
                details: `Navigation on ${current.url} has only ${Math.round(similarity * 100)}% similarity with the baseline page.`,
                expectedBehavior: 'Primary navigation should be consistent across pages.',
                locationDescription: `Page: ${current.url}`,
                suggestedFix: 'Use a shared navigation component across all pages.',
                friendlyName: 'Inconsistent Navigation'
            });
        }
    }

    return bugs;
}

/**
 * Check forms on the page for proper validation attributes and accessibility
 */
export async function checkForms(page: Page): Promise<Bug[]> {
    const formIssues = await page.evaluate(`
        (function() {
            const issues = [];
            const forms = document.querySelectorAll('form');
            
            forms.forEach((form, formIndex) => {
                // Check for form action
                const action = form.getAttribute('action');
                if (!action && !form.hasAttribute('onsubmit') && !form.querySelector('[type="submit"]')) {
                    issues.push({
                        code: 'FORM_NO_SUBMIT',
                        severity: 'major',
                        message: 'Form has no submit mechanism.',
                        details: 'The form has no action attribute, onsubmit handler, or submit button.',
                        expectedBehavior: 'Forms should have a way to submit data.',
                        locationDescription: 'Form #' + (formIndex + 1)
                    });
                }
                
                // Check inputs
                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach((input, inputIndex) => {
                    const type = input.getAttribute('type') || 'text';
                    const name = input.getAttribute('name');
                    const id = input.getAttribute('id');
                    const label = id ? document.querySelector('label[for="' + id + '"]') : null;
                    const ariaLabel = input.getAttribute('aria-label');
                    const placeholder = input.getAttribute('placeholder');
                    
                    // Skip hidden and submit inputs
                    if (type === 'hidden' || type === 'submit' || type === 'button') return;
                    
                    // Check for label
                    if (!label && !ariaLabel && !input.closest('label')) {
                        issues.push({
                            code: 'FORM_MISSING_LABEL',
                            severity: 'major',
                            message: 'Form input is missing an accessible label.',
                            details: 'Input ' + (name || type) + ' has no <label>, aria-label, or is not wrapped in a label element.',
                            expectedBehavior: 'Every form input should have an associated label for accessibility.',
                            locationDescription: 'Form #' + (formIndex + 1) + ', Input: ' + (name || type),
                            elementHtml: input.outerHTML.slice(0, 100)
                        });
                    }
                    
                    // Check email inputs for validation
                    if (type === 'email' && !input.hasAttribute('required') && !input.hasAttribute('pattern')) {
                        // Just informational, not an error
                    }
                    
                    // Check required fields
                    if (input.hasAttribute('required')) {
                        // Check if there's visual indication
                        const labelText = label ? label.textContent : '';
                        if (labelText && !labelText.includes('*') && !input.getAttribute('aria-required')) {
                            issues.push({
                                code: 'FORM_REQUIRED_NO_INDICATOR',
                                severity: 'minor',
                                message: 'Required field has no visual indicator.',
                                details: 'The input is marked as required but there is no asterisk (*) or other visual indicator.',
                                expectedBehavior: 'Required fields should be visually marked (e.g., with asterisk).',
                                locationDescription: 'Form #' + (formIndex + 1) + ', Input: ' + (name || type)
                            });
                        }
                    }
                    
                    // Check password fields
                    if (type === 'password') {
                        // Check for autocomplete attribute
                        const autocomplete = input.getAttribute('autocomplete');
                        if (!autocomplete) {
                            issues.push({
                                code: 'FORM_PASSWORD_NO_AUTOCOMPLETE',
                                severity: 'minor',
                                message: 'Password field missing autocomplete attribute.',
                                details: 'Password inputs should have autocomplete="current-password" or "new-password" for better UX.',
                                expectedBehavior: 'Set autocomplete attribute for password managers.',
                                locationDescription: 'Form #' + (formIndex + 1)
                            });
                        }
                    }
                });
            });
            
            return issues;
        })()
    `);

    return (formIssues as any[]).map((issue: any) => ({
        id: crypto.randomUUID(),
        ...issue,
        friendlyName: getFriendlyName(issue.code)
    }));
}

function getFriendlyName(code: string): string {
    const map: Record<string, string> = {
        'FORM_NO_SUBMIT': 'Form Missing Submit',
        'FORM_MISSING_LABEL': 'Missing Form Label',
        'FORM_REQUIRED_NO_INDICATOR': 'Required Field Not Marked',
        'FORM_PASSWORD_NO_AUTOCOMPLETE': 'Password Autocomplete Missing',
        'CROSS_PAGE_HEADER_MISMATCH': 'Inconsistent Header',
        'CROSS_PAGE_MISSING_HEADER': 'Missing Header',
        'CROSS_PAGE_MISSING_FOOTER': 'Missing Footer',
        'CROSS_PAGE_FONT_MISMATCH': 'Inconsistent Font',
        'CROSS_PAGE_NAV_MISMATCH': 'Inconsistent Navigation'
    };
    return map[code] || code;
}
