import { Page } from 'playwright';
import { Bug } from '../types';

export async function checkVisual(page: Page): Promise<Bug[]> {
    const issues = await page.evaluate(`
    (function() {
      const results = [];
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // Helper: Check if element is decorative
      const isDecorativeElement = (el) => {
        const style = window.getComputedStyle(el);
        if (style.pointerEvents === 'none') return true;
        if (style.animationName !== 'none' && style.animationName !== '') return true;
        if (el.className && typeof el.className === 'string' && el.className.includes('animate-')) return true;
        if (el.getAttribute('aria-hidden') === 'true') return true;
        return false;
      };

      // 1. Vertical Alignment Check (Flexbox rows)
      const flexRows = Array.from(document.querySelectorAll('*')).filter(el => {
         const s = window.getComputedStyle(el);
         return s.display === 'flex' && s.flexDirection === 'row' && s.alignItems === 'center' && isVisible(el);
      });

      let alignmentIssues = 0;
      flexRows.forEach(row => {
         if (alignmentIssues >= 3) return; // Limit reports
         
         const children = Array.from(row.children).filter(c => isVisible(c) && !isDecorativeElement(c));
         if (children.length < 2) return;

         const centers = children.map(c => {
             const r = c.getBoundingClientRect();
             return r.top + r.height / 2;
         });

         const minC = Math.min(...centers);
         const maxC = Math.max(...centers);
         const diff = maxC - minC;

         if (diff > 2 && diff < 8) {
             alignmentIssues++;
             const name = window.SemanticResolver.getFriendlyName(row);
             const location = window.SemanticResolver.getLocationDescription(row);

             results.push({
                 code: 'VISUAL_MISALIGNMENT',
                 severity: 'minor',
                 message: 'Items in \"' + name + '\" are slightly misaligned (' + Math.round(diff) + 'px offset).',
                 details: 'Items in a row with \"align-items: center\" are not visually centered. This often happens due to uneven padding, line-height issues, or mixed font sizes.',
                 expectedBehavior: 'Ensure all items share the same vertical center line. Check line-heights and margins.',
                 friendlyName: name,
                 locationDescription: location,
                 elementHtml: row.outerHTML.slice(0, 100),
                 suggestedFix: 'Ensure consistent line-height, padding, and font-size across flex children. Consider using align-items: baseline for text content.'
             });
         }
      });

      // 2. Inconsistent Spacing (Lists/Grids)
      const containers = Array.from(document.querySelectorAll('*')).filter(el => el.children.length > 3 && isVisible(el));
      
      let spacingIssues = 0;
      containers.forEach(container => {
          if (spacingIssues >= 3) return;
          
          const children = Array.from(container.children).filter(c => isVisible(c) && !isDecorativeElement(c));
          if (children.length < 4) return;
          
          const tag = children[0].tagName;
          if (!children.every(c => c.tagName === tag)) return;

          const gaps = [];
          for(let i=1; i<children.length; i++) {
              const prev = children[i-1].getBoundingClientRect();
              const curr = children[i].getBoundingClientRect();
              
              let gap;
              if (Math.abs(curr.top - prev.top) < 10) {
                  gap = curr.left - prev.right;
              } else {
                  gap = curr.top - prev.bottom;
              }
              if (gap > 0 && gap < 200) gaps.push(gap);
          }

          if (gaps.length < 3) return;

          const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
          const distinctGaps = gaps.filter(g => Math.abs(g - avg) > 4);
          
          if (distinctGaps.length > 0 && distinctGaps.length < gaps.length - 1) {
              spacingIssues++;
              const name = window.SemanticResolver.getFriendlyName(container);
              const location = window.SemanticResolver.getLocationDescription(container);

              results.push({
                  code: 'VISUAL_INCONSISTENT_SPACING',
                  severity: 'minor',
                  message: 'Inconsistent spacing within \"' + name + '\".',
                  details: 'Sibling elements have varying gaps (avg: ' + Math.round(avg) + 'px, but some are ' + Math.round(distinctGaps[0]) + 'px).',
                  expectedBehavior: 'Standardize margins/gap to be consistent (e.g. using a \"gap\" property or consistent margins).',
                  friendlyName: name,
                  locationDescription: location,
                  elementHtml: container.outerHTML.slice(0, 100),
                  suggestedFix: 'Use CSS gap property, or ensure all children have identical margins.'
              });
          }
      });

      // 3. Line Length (Typography)
      const paragraphs = document.querySelectorAll('p, .prose, article p');
      let lineLengthIssues = 0;
      
      paragraphs.forEach(p => {
          if (lineLengthIssues >= 2) return;
          if (!isVisible(p)) return;
          const text = p.textContent || '';
          if (text.length < 150) return;

          const rect = p.getBoundingClientRect();
          const fontSize = parseFloat(window.getComputedStyle(p).fontSize);
          const estimatedCPL = rect.width / (fontSize * 0.55);
          
          if (estimatedCPL > 90) {
              lineLengthIssues++;
              const name = window.SemanticResolver.getFriendlyName(p);
              const location = window.SemanticResolver.getLocationDescription(p);

              results.push({
                  code: 'VISUAL_LONG_LINES',
                  severity: 'minor',
                  message: 'Text lines in \"' + name + '\" are too wide (~\' + Math.round(estimatedCPL) + \' chars).',
                  details: 'Reading lines wider than 75-80 characters causes eye fatigue.',
                  expectedBehavior: 'Constrain text width (max-width) to approx 60-80ch.',
                  friendlyName: name,
                  locationDescription: location,
                  elementHtml: p.outerHTML.slice(0, 200),
                  suggestedFix: 'Add max-width: 70ch; to the text container.'
              });
          }
      });
      
      // 4. Broken Images
      const images = document.querySelectorAll('img');
      let brokenImageCount = 0;
      
      images.forEach(img => {
          if (brokenImageCount >= 5) return;
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (!src) return;
          
          if (img.naturalWidth === 0 && img.complete) {
              brokenImageCount++;
              const name = window.SemanticResolver.getFriendlyName(img);
              const location = window.SemanticResolver.getLocationDescription(img);

              results.push({
                  code: 'MEDIA_BROKEN',
                  severity: 'major',
                  message: 'Image \"' + name + '\" failed to load.',
                  details: 'Image source \"' + src.slice(0, 80) + '\" could not be loaded.',
                  expectedBehavior: 'Fix the broken image link or provide a fallback.',
                  friendlyName: name,
                  locationDescription: location,
                  elementHtml: img.outerHTML.slice(0, 100),
                  suggestedFix: 'Verify the image URL is correct and accessible.'
              });
          }
      });

      // 5. Z-Index Stacking Conflicts
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role=\"button\"]');
      let zIndexIssues = 0;
      
      interactiveElements.forEach(el => {
          if (zIndexIssues >= 3) return;
          if (!isVisible(el)) return;
          
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const elementAtPoint = document.elementFromPoint(centerX, centerY);
          
          if (elementAtPoint && elementAtPoint !== el && !el.contains(elementAtPoint) && !elementAtPoint.contains(el)) {
              const coveringStyle = window.getComputedStyle(elementAtPoint);
              if (coveringStyle.position !== 'static' && coveringStyle.zIndex !== 'auto') {
                  zIndexIssues++;
                  const elName = window.SemanticResolver.getFriendlyName(el);
                  const coverName = window.SemanticResolver.getFriendlyName(elementAtPoint);
                  const location = window.SemanticResolver.getLocationDescription(el);

                  results.push({
                      code: 'Z_INDEX_CONFLICT',
                      severity: 'major',
                      message: '\"' + elName + '\" is covered by \"' + coverName + '\".',
                      details: 'The interactive element is obscured by another element with z-index, potentially making it unclickable.',
                      expectedBehavior: 'Interactive elements should not be covered by other elements.',
                      friendlyName: elName,
                      locationDescription: location,
                      elementHtml: el.outerHTML.slice(0, 100),
                      suggestedFix: 'Adjust z-index values or set pointer-events: none on decorative overlays.'
                  });
              }
          }
      });

      return results;
    })()
  `);

    return (issues as any[]).map((i: any) => ({ id: crypto.randomUUID(), ...i }));
}
