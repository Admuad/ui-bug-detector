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
        // If it's very wide (e.g., full width button) but short, it might be okay, but <32 height is still hard.
        if (rect.width < 32 || rect.height < 32) {
          
          // Generate specific identifier
          let idText = el.id ? '#' + el.id : '';
          let classText = '';
          const cls = el.getAttribute('class');
          if (cls) {
             classText = '.' + cls.split(' ').filter(c => c).slice(0, 2).join('.');
          }
          let visibleText = el.textContent ? el.textContent.trim().slice(0, 20) : '';
          if (visibleText && visibleText.length < el.textContent?.trim().length) visibleText += '...';
          
          const identifier = \`\${el.tagName.toLowerCase()}\${idText}\${classText}\` + (visibleText ? \` "\${visibleText}"\` : '');

          results.push({
            code: 'SMALL_TARGET',
            severity: 'minor',
            message: \`Clickable element \${visibleText ? '"'+visibleText+'" ' : ''}is too small (\${Math.round(rect.width)}x\${Math.round(rect.height)}px). Hard to tap on mobile.\`,
            details: \`The interactive element is \${Math.round(rect.width)}x\${Math.round(rect.height)}px. Touch targets should be at least 44x44px (or 32x32px minimally) to avoid frustration. Inline links are exempt.\`,
            expectedBehavior: 'Increase functionality padding or size to meet minimum touch target guidelines.',
            locationDescription: \`Element: \${identifier}\`,
            elementHtml: el.outerHTML.slice(0, 100),
            boundingBox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
          });
        }
      });

      // 2. Broken Links (Basic check)
      const links = document.querySelectorAll('a');
      links.forEach(el => {
         const href = el.getAttribute('href');
         if (!href || href === '#' || href === '') {
            let idText = el.id ? '#' + el.id : '';
            let classText = '';
            const cls = el.getAttribute('class');
            if (cls) {
                classText = '.' + cls.split(' ').filter(c => c).slice(0, 2).join('.');
            }
            let visibleText = el.textContent ? el.textContent.trim().slice(0, 20) : '';
            if (visibleText && visibleText.length < el.textContent?.trim().length) visibleText += '...';
            const identifier = \`\${el.tagName.toLowerCase()}\${idText}\${classText}\` + (visibleText ? \` "\${visibleText}"\` : '');

            results.push({
               code: 'EMPTY_LINK',
               severity: 'minor',
               message: 'Link has empty or void href.',
               details: 'The <a> tag has no valid "href" attribute. It creates confusion for screen readers and users.',
               expectedBehavior: 'All links should point to a valid URL or be converted to <button> if they trigger actions.',
               locationDescription: \`Link: \${identifier}\`,
               elementHtml: el.outerHTML.slice(0, 100),
            });
         }
      });

      return results;
    })()
  `);

  return (issues as any[]).map((i: any) => ({ id: crypto.randomUUID(), ...i }));
}

