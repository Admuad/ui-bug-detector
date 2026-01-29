import { Page } from 'playwright';
import { Bug } from '../types';

export async function checkInteraction(page: Page): Promise<Bug[]> {
  const issues = await page.evaluate(`
    (function() {
      const results = [];
      
      // 1. Small Click Targets
      const clickableSelectors = 'a, button, [role="button"], input[type="submit"]';
      const clickables = document.querySelectorAll(clickableSelectors);
      
      clickables.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // Hidden
        
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.getAttribute('aria-hidden') === 'true') return;

        // Ignore inline text links (they flow with text)
        if (style.display === 'inline' && el.tagName === 'A') return;

        // Guidelines suggest 44x44 or 48x48. We'll be lenient with 32x32 for now.
        if (rect.width < 32 || rect.height < 32) {
          
          const name = window.SemanticResolver.getFriendlyName(el);
          const location = window.SemanticResolver.getLocationDescription(el);

          results.push({
            code: 'SMALL_TARGET',
            severity: 'minor',
            message: 'Clickable \"' + name + '\" is too small (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px).',
            details: 'The interactive element is ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px. Touch targets should be at least 44x44px minimally to avoid frustration for mobile users.',
            expectedBehavior: 'Increase padding or dimensions to meet minimum touch target guidelines.',
            friendlyName: name,
            locationDescription: location,
            elementHtml: el.outerHTML.slice(0, 100),
            boundingBox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
          });
        }
      });

      // 2. Empty/Broken Links
      const links = document.querySelectorAll('a');
      links.forEach(el => {
         const href = el.getAttribute('href');
         if (!href || href === '#' || href === '') {
            const name = window.SemanticResolver.getFriendlyName(el);
            const location = window.SemanticResolver.getLocationDescription(el);

            results.push({
               code: 'EMPTY_LINK',
               severity: 'minor',
               message: '\"' + name + '\" has a broken or empty link.',
               details: 'The <a> tag has no valid \"href\" attribute. It creates confusion for screen readers and users who expect navigation.',
               expectedBehavior: 'All links should point to a valid URL or be converted to a <button> for JS-triggered actions.',
               friendlyName: name,
               locationDescription: location,
               elementHtml: el.outerHTML.slice(0, 100),
            });
         }
      });

      return results;
    })()
  `);

  return (issues as any[]).map((i: any) => ({ id: crypto.randomUUID(), ...i }));
}
