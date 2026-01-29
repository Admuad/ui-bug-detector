import { Page } from 'playwright';
import { Bug } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// WCAG criterion mapping for common violations
const WCAG_MAPPING: Record<string, string> = {
    'region': '1.3.1 Info and Relationships (Level A)',
    'landmark-one-main': '1.3.1 Info and Relationships (Level A)',
    'color-contrast': '1.4.3 Contrast (Minimum) (Level AA)',
    'image-alt': '1.1.1 Non-text Content (Level A)',
    'link-name': '2.4.4 Link Purpose (Level A)',
    'button-name': '4.1.2 Name, Role, Value (Level A)',
    'label': '1.3.1 Info and Relationships (Level A)',
    'link-in-text-block': '1.4.1 Use of Color (Level A)',
    'heading-order': '1.3.1 Info and Relationships (Level A)',
    'duplicate-id': '4.1.1 Parsing (Level A)',
    'focus-visible': '2.4.7 Focus Visible (Level AA)',
    'tabindex': '2.4.3 Focus Order (Level A)'
};

// Suggested fixes for common violations
const FIX_SUGGESTIONS: Record<string, string> = {
    'region': 'Wrap page content in semantic landmarks: <header>, <main>, <nav>, <aside>, <footer>. Use role="main" for the primary content area.',
    'landmark-one-main': 'Add exactly one <main> element or an element with role="main" to wrap the primary page content.',
    'color-contrast': 'Increase the contrast ratio between text and background colors. Use a contrast checker tool to ensure at least 4.5:1 for normal text.',
    'image-alt': 'Add descriptive alt text to the image. Use alt="" for purely decorative images.',
    'link-name': 'Add text content, aria-label, or aria-labelledby to provide an accessible name for the link.',
    'button-name': 'Add text content, aria-label, or aria-labelledby to provide an accessible name for the button.',
    'label': 'Associate a <label> element with the form input using the for/id attributes, or wrap the input in a label.',
    'link-in-text-block': 'Ensure links are distinguishable by more than just color. Add an underline, bold weight, or other visual indicator.',
    'heading-order': 'Use headings in a logical order (h1 → h2 → h3). Do not skip heading levels.',
    'duplicate-id': 'Ensure all id attributes on the page are unique.',
    'focus-visible': 'Do not remove focus indicators (outline: none). Customize focus styles but keep them visible.',
    'tabindex': 'Avoid positive tabindex values. Use tabindex="0" to add elements to the natural tab order.'
};

export async function checkAccessibility(page: Page): Promise<Bug[]> {
    try {
        // Manually inject axe-core to avoid path resolution issues with axe-playwright in Next.js
        const axePath = path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
        if (fs.existsSync(axePath)) {
            const axeContent = fs.readFileSync(axePath, 'utf8');
            await page.evaluate(axeContent);
        } else {
            console.error(`[A11y] Axe-core not found at ${axePath}`);
            return [];
        }

        // Run axe analysis with improved filtering
        const results = await page.evaluate(`
          (async function() {
              const axeConfig = {
                  rules: {
                      'region': { enabled: true },
                      'landmark-complementary-is-top-level': { enabled: false },
                      'landmark-unique': { enabled: false }
                  }
              };
              
              const results = await window.axe.run(document, axeConfig);
              
              // Filter and ENRICH violations with semantic data
              results.violations = results.violations.map(violation => {
                  violation.nodes = violation.nodes.filter(node => {
                      try {
                          if (!node.target || node.target.length === 0) return true;
                          const selector = node.target[node.target.length - 1];
                          const el = document.querySelector(selector);
                          if (!el) return true;
                          
                          const style = window.getComputedStyle(el);
                          if (style.pointerEvents === 'none') return false;
                          if (style.animationName !== 'none' && style.animationName !== '') return false;
                          if (el.className && typeof el.className === 'string' && el.className.includes('animate-')) return false;
                          if (el.getAttribute('aria-hidden') === 'true') return false;
                          if (el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none') return false;
                          
                          const rect = el.getBoundingClientRect();
                          if (rect.width < 5 || rect.height < 5) return false;
                          
                          // Attach semantic info to node for enrichment
                          node.friendlyName = window.SemanticResolver.getFriendlyName(el);
                          node.locationDescription = window.SemanticResolver.getLocationDescription(el);
                          
                          return true;
                      } catch (e) {
                          return true;
                      }
                  });
                  return violation;
              }).filter(v => v.nodes.length > 0);
              
              return results;
          })()
        `);

        const bugs: Bug[] = [];
        const violationCounts: Map<string, number> = new Map();

        // Second pass: create bugs with enrichment
        for (const v of (results as any).violations) {
            const nodeCount = v.nodes.length;
            const ruleId = v.id;

            if (nodeCount > 3 && (ruleId === 'region' || ruleId === 'landmark-one-main' || ruleId === 'duplicate-id-aria')) {
                bugs.push({
                    id: crypto.randomUUID(),
                    code: `A11Y_${ruleId.toUpperCase().replace(/-/g, '_')}`,
                    severity: v.impact === 'critical' || v.impact === 'serious' ? 'major' : 'minor',
                    message: `${v.help} (${nodeCount} elements affected)`,
                    details: `${v.description}\n\n${nodeCount} elements on the page violate this rule.`,
                    expectedBehavior: `Fix the issue: ${v.help}`,
                    locationDescription: `Multiple locations across the page`,
                    wcagCriteria: WCAG_MAPPING[ruleId] || '',
                    suggestedFix: FIX_SUGGESTIONS[ruleId] || 'Review the elements and fix according to WCAG guidelines.',
                    friendlyName: v.help.split(' (')[0]
                });
            } else {
                const maxPerRule = 5;
                const nodesToReport = v.nodes.slice(0, maxPerRule);

                for (const node of nodesToReport) {
                    const name = node.friendlyName || v.help.split(' (')[0];
                    const loc = node.locationDescription || 'on the page';

                    bugs.push({
                        id: crypto.randomUUID(),
                        code: `A11Y_${ruleId.toUpperCase().replace(/-/g, '_')}`,
                        severity: v.impact === 'critical' || v.impact === 'serious' ? 'major' : 'minor',
                        message: `"${name}" fails ${v.help} check.`,
                        details: v.description,
                        expectedBehavior: `Fix the issue: ${v.help}`,
                        locationDescription: loc,
                        elementHtml: node.html,
                        selector: node.target[0],
                        wcagCriteria: WCAG_MAPPING[ruleId] || '',
                        suggestedFix: FIX_SUGGESTIONS[ruleId] || 'Review the element and fix according to WCAG guidelines.',
                        friendlyName: name
                    });
                }

                if (v.nodes.length > maxPerRule) {
                    bugs.push({
                        id: crypto.randomUUID(),
                        code: `A11Y_${ruleId.toUpperCase().replace(/-/g, '_')}`,
                        severity: 'minor',
                        message: `... and ${v.nodes.length - maxPerRule} more "${v.help}" violations`,
                        details: `Additional elements with the same violation were found but not listed individually.`,
                        expectedBehavior: `Review all elements matching this pattern.`,
                        locationDescription: 'Multiple locations',
                        friendlyName: v.help.split(' (')[0]
                    });
                }
            }
        }

        console.log(`[A11y] Found ${bugs.length} accessibility issues`);
        return bugs;

    } catch (e) {
        console.error("[A11y] Axe checks failed:", e);
        return [];
    }
}
