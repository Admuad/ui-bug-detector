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
             results.push({
                 code: 'VISUAL_MISALIGNMENT',
                 severity: 'minor',
                 message: \`Elements in flex row are slightly misaligned (\${Math.round(diff)}px offset).\`,
                 details: 'Items in a row with "align-items: center" are not visually centered. This often happens due to uneven padding, line-height issues, or mixed font sizes.',
                 expectedBehavior: 'Ensure all items share the same vertical center line. Check line-heights and margins.',
                 locationDescription: \`Container: <\${row.tagName.toLowerCase()}>\` + (row.getAttribute('class') ? \`.\${row.getAttribute('class').split(' ')[0]}\` : ''),
                 elementHtml: row.outerHTML.slice(0, 100),
                 suggestedFix: 'Ensure consistent line-height, padding, and font-size across flex children. Consider using align-items: baseline for text content.'
             });
         }
      });

      // 2. Inconsistent Spacing (Lists/Grids) - IMPROVED
      const containers = Array.from(document.querySelectorAll('*')).filter(el => el.children.length > 3 && isVisible(el));
      
      let spacingIssues = 0;
      containers.forEach(container => {
          if (spacingIssues >= 3) return;
          
          const children = Array.from(container.children).filter(c => isVisible(c) && !isDecorativeElement(c));
          if (children.length < 4) return;
          
          // Only check if children look "similar" (same tag)
          const tag = children[0].tagName;
          if (!children.every(c => c.tagName === tag)) return;

          // Measure gaps
          const gaps = [];
          for(let i=1; i<children.length; i++) {
              const prev = children[i-1].getBoundingClientRect();
              const curr = children[i].getBoundingClientRect();
              
              // Determine if horizontal or vertical layout
              let gap;
              if (Math.abs(curr.top - prev.top) < 10) {
                  // Horizontal layout
                  gap = curr.left - prev.right;
              } else {
                  // Vertical layout
                  gap = curr.top - prev.bottom;
              }
              if (gap > 0 && gap < 200) gaps.push(gap);
          }

          if (gaps.length < 3) return;

          const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
          const distinctGaps = gaps.filter(g => Math.abs(g - avg) > 4); // >4px deviation
          
          if (distinctGaps.length > 0 && distinctGaps.length < gaps.length - 1) {
              spacingIssues++;
              results.push({
                  code: 'VISUAL_INCONSISTENT_SPACING',
                  severity: 'minor',
                  message: 'Inconsistent spacing between repeated elements.',
                  details: \`Sibling elements have varying gaps (avg: \${Math.round(avg)}px, but some are \${Math.round(distinctGaps[0])}px). Professional UI should have consistent rhythm.\`,
                  expectedBehavior: 'Standardize margins/gap to be consistent (e.g. using a "gap" property or consistent margins).',
                  locationDescription: \`Container: <\${container.tagName.toLowerCase()}>\` + (container.getAttribute('class') ? \`.\${container.getAttribute('class').split(' ')[0]}\` : ''),
                  elementHtml: container.outerHTML.slice(0, 100),
                  suggestedFix: 'Use CSS gap property, or ensure all children have identical margins.'
              });
          }
      });

      // 3. Line Length (Typography) - IMPROVED
      const paragraphs = document.querySelectorAll('p, .prose, article p');
      let lineLengthIssues = 0;
      
      paragraphs.forEach(p => {
          if (lineLengthIssues >= 2) return;
          if (!isVisible(p)) return;
          const text = p.textContent || '';
          if (text.length < 150) return; // Only check substantial paragraphs

          const rect = p.getBoundingClientRect();
          const fontSize = parseFloat(window.getComputedStyle(p).fontSize);
          
          // Estimate characters per line
          // rough heuristic: width / (fontSize * 0.6) gives CPL
          const estimatedCPL = rect.width / (fontSize * 0.55);
          
          if (estimatedCPL > 90) {
              lineLengthIssues++;
              const preview = text.trim().slice(0, 50) + '...';
              results.push({
                  code: 'VISUAL_LONG_LINES',
                  severity: 'minor',
                  message: \`Text line length is too wide (~\${Math.round(estimatedCPL)} characters per line).\`,
                  details: \`Reading lines wider than 75-80 characters causes eye fatigue. This paragraph appears to have ~\${Math.round(estimatedCPL)} CPL.\`,
                  expectedBehavior: 'Constrain text width (max-width) to approx 60-80ch (approx 600-700px) for better readability.',
                  locationDescription: \`Paragraph: "\${preview}"\`,
                  elementHtml: p.outerHTML.slice(0, 200),
                  suggestedFix: 'Add max-width: 70ch; or max-width: 680px; to the text container.'
              });
          }
      });
      
      // 4. Broken Images - IMPROVED (handles lazy loading)
      const images = document.querySelectorAll('img');
      let brokenImageCount = 0;
      
      images.forEach(img => {
          if (brokenImageCount >= 5) return;
          
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (!src) return;
          
          // Check if image failed to load
          // naturalWidth === 0 means failed OR still loading
          if (img.naturalWidth === 0 && img.complete) {
              brokenImageCount++;
              results.push({
                  code: 'MEDIA_BROKEN',
                  severity: 'major',
                  message: 'Image failed to load.',
                  details: \`Image source "\${src.slice(0, 80)}" could not be loaded.\`,
                  expectedBehavior: 'Fix the broken image link or provide a fallback.',
                  locationDescription: \`Image: \${img.alt ? '"'+img.alt+'"' : src.slice(0, 50)}\`,
                  elementHtml: img.outerHTML.slice(0, 100),
                  suggestedFix: 'Verify the image URL is correct and accessible. Consider adding a fallback src or error handler.'
              });
          }
      });

      // 5. Z-Index Stacking Conflicts (NEW)
      const positionedElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return (style.position === 'absolute' || style.position === 'fixed' || style.position === 'sticky') 
                 && style.zIndex !== 'auto' 
                 && isVisible(el)
                 && !isDecorativeElement(el);
      });

      // Check for potential z-index conflicts (interactive elements hidden by others)
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
      let zIndexIssues = 0;
      
      interactiveElements.forEach(el => {
          if (zIndexIssues >= 3) return;
          if (!isVisible(el)) return;
          
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Check what element is at the center point
          const elementAtPoint = document.elementFromPoint(centerX, centerY);
          
          if (elementAtPoint && elementAtPoint !== el && !el.contains(elementAtPoint) && !elementAtPoint.contains(el)) {
              // Something is covering this interactive element
              const coveringStyle = window.getComputedStyle(elementAtPoint);
              
              // Only report if the covering element is positioned with z-index
              if (coveringStyle.position !== 'static' && coveringStyle.zIndex !== 'auto') {
                  zIndexIssues++;
                  results.push({
                      code: 'Z_INDEX_CONFLICT',
                      severity: 'major',
                      message: \`Interactive element may be covered by another element.\`,
                      details: \`A <\${el.tagName.toLowerCase()}> element appears to be obscured by a <\${elementAtPoint.tagName.toLowerCase()}> with z-index. This could make the element unclickable.\`,
                      expectedBehavior: 'Interactive elements should not be covered by other elements.',
                      locationDescription: \`Covered element: <\${el.tagName.toLowerCase()}> at (\${Math.round(centerX)}, \${Math.round(centerY)})\`,
                      elementHtml: el.outerHTML.slice(0, 100),
                      suggestedFix: 'Adjust z-index values to ensure interactive elements are above overlays, or set pointer-events: none on decorative overlays.'
                  });
              }
          }
      });

      // 6. Font Loading Detection (FOUT/FOIT) - Check for system font fallbacks
      const textElements = document.querySelectorAll('h1, h2, h3, p, span, a, button');
      const fontFamilies = new Set();
      
      textElements.forEach(el => {
          if (!isVisible(el)) return;
          const style = window.getComputedStyle(el);
          const font = style.fontFamily;
          if (font) fontFamilies.add(font);
      });
      
      // Check if any fonts are still loading (document.fonts API)
      if (document.fonts && document.fonts.status === 'loading') {
          results.push({
              code: 'FONT_LOADING',
              severity: 'minor',
              message: 'Web fonts still loading after page load.',
              details: 'Some web fonts have not finished loading. This may cause a flash of unstyled text (FOUT) or invisible text (FOIT).',
              expectedBehavior: 'Fonts should be loaded before or immediately after page render.',
              locationDescription: 'Document Fonts',
              suggestedFix: 'Use font-display: swap in @font-face, preload critical fonts, or use a font loading strategy.'
          });
      }

      return results;
    })()
  `);

    return (issues as any[]).map((i: any) => ({ id: crypto.randomUUID(), ...i }));
}
