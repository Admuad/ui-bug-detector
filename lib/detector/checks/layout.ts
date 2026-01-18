import { Page } from 'playwright';
import { Bug } from '../types';

export async function checkLayout(page: Page): Promise<Bug[]> {
  // We pass the function as a string to avoid 'tsx' injecting helpers like '__name' into the closure.
  // This is a known workaround for tsx/esbuild + playwright.
  const layoutIssues = await page.evaluate(`
    (function() {
      const issues = [];

      // Helper: is visible
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // IMPROVED: Check if element is purely decorative
      const isDecorativeElement = (el) => {
        const style = window.getComputedStyle(el);
        
        // Pointer events none = decorative overlay
        if (style.pointerEvents === 'none') return true;
        
        // Currently animating (floating particles, marquees)
        if (style.animationName !== 'none' && style.animationName !== '') return true;
        
        // Has animate- class (common pattern for decorative animations)
        if (el.className && typeof el.className === 'string' && el.className.includes('animate-')) return true;
        
        // Aria-hidden elements are decorative
        if (el.getAttribute('aria-hidden') === 'true') return true;
        
        // Role presentation/none = decorative
        const role = el.getAttribute('role');
        if (role === 'presentation' || role === 'none') return true;
        
        // Small absolutely positioned elements with single emoji/icon character are likely decorative
        if (style.position === 'absolute' || style.position === 'fixed') {
          const text = el.textContent?.trim() || '';
          // Emoji detection: single character with high unicode value, or 1-2 char text in small element
          const rect = el.getBoundingClientRect();
          if (text.length <= 2 && rect.width < 50 && rect.height < 50) {
            // Check if it's an emoji or special character
            const isEmoji = /[\\u{1F300}-\\u{1F9FF}]|[\\u{2600}-\\u{26FF}]|[\\u{2700}-\\u{27BF}]|[★☆❄🎄✨]/u.test(text);
            if (isEmoji) return true;
          }
        }
        
        return false;
      };

      // 1. Check for Horizontal Overflow
      if (document.documentElement.scrollWidth > window.innerWidth) {
        issues.push({
          code: 'LAYOUT_OVERFLOW',
          severity: 'major',
          message: \`Page content overflows horizontally (\${document.documentElement.scrollWidth}px > \${window.innerWidth}px).\`,
          details: \`The page content width (\${document.documentElement.scrollWidth}px) exceeds the viewport width (\${window.innerWidth}px). This causes unwanted horizontal scrolling on mobile devices.\`,
          expectedBehavior: 'Content should fit within the viewport width without horizontal scrolling (unless intended, e.g., carousel).',
          locationDescription: 'Global Page Layout',
          suggestedFix: 'Find elements with fixed widths wider than the viewport, or content that extends beyond its container. Check for elements with "overflow: visible" that contain wide children.'
        });
      }

      // 2. Check for Overlapping Text Elements (IMPROVED: Skip decorative elements)
      const textNodes = [];
      const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      
      while(treeWalker.nextNode()) {
        const el = treeWalker.currentNode;
        const hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim().length > 0);
        
        if (hasText && isVisible(el)) {
          // CRITICAL FIX: Skip decorative elements BEFORE adding to overlap check list
          if (isDecorativeElement(el)) continue;
          
          // Skip very small elements (likely icons or single characters)
          const rect = el.getBoundingClientRect();
          if (rect.width < 20 || rect.height < 12) continue;
          
          // Must have meaningful text (not just whitespace or single char)
          const textContent = el.textContent?.trim() || '';
          if (textContent.length < 3) continue;

          textNodes.push({
            node: el,
            rect: rect
          });
        }
      }

      const checkLimit = Math.min(textNodes.length, 300);
      const overlapIssues = [];
      
      for (let i = 0; i < checkLimit; i++) {
        for (let j = i + 1; j < checkLimit; j++) {
          const a = textNodes[i];
          const b = textNodes[j];
          
          // Skip if one contains the other (parent-child)
          if (a.node.contains(b.node) || b.node.contains(a.node)) continue;

          const x_overlap = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
          const y_overlap = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
          
          // Require significant overlap (at least 15px in each dimension)
          if (x_overlap > 15 && y_overlap > 15) {
             const aText = a.node.textContent?.trim().slice(0,30) || '';
             const bText = b.node.textContent?.trim().slice(0,30) || '';
             
             // Skip if the texts are very similar (likely same element captured twice)
             if (aText === bText) continue;
             
             overlapIssues.push({
               code: 'VISUAL_OVERLAP',
               severity: 'major',
               message: \`Overlapping text elements detected: "\${aText}..." and "\${bText}..."\`,
               details: \`Two text elements are occupying the same space (overlap area: \${Math.round(x_overlap * y_overlap)}px²). This makes text unreadable.\`,
               expectedBehavior: 'Text elements should have sufficient spacing and not overlap each other.',
               locationDescription: \`Between <\${a.node.tagName}> and <\${b.node.tagName}>\`,
               selector: a.node.tagName, 
               boundingBox: {
                 x: a.rect.left, y: a.rect.top, width: a.rect.width, height: a.rect.height
               },
               suggestedFix: 'Adjust element positions or z-index. Ensure text elements have proper spacing and do not overlap.'
             });
             
             // Limit overlap issues to prevent flooding
             if (overlapIssues.length >= 10) break;
          }
        }
        if (overlapIssues.length >= 10) break;
      }
      
      issues.push(...overlapIssues);

      // 3. Check for Clipped Content (Text cut off)
      const allElements = document.querySelectorAll('*');
      let clippedCount = 0;
      
      allElements.forEach(el => {
        if (clippedCount >= 5) return; // Limit reports
        
        const style = window.getComputedStyle(el);
        if (style.overflow !== 'hidden' && style.overflow !== 'auto' && style.overflow !== 'scroll') return;
        if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
        
        // Tolerance of 2px for sub-pixel rendering
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
           // Ensure it actually has text that might be clipped
           const textContent = el.textContent?.trim() || '';
           if (textContent.length > 10) {
              // Skip common intentional scroll containers
              if (el.className && typeof el.className === 'string') {
                if (el.className.includes('scroll') || el.className.includes('carousel') || el.className.includes('slider')) {
                  return;
                }
              }
              
              clippedCount++;
              issues.push({
                 code: 'LAYOUT_CLIPPED',
                 severity: 'major',
                 message: \`Content is clipped or scrollable within <\${el.tagName.toLowerCase()}>.\`,
                 details: \`The element content size (\${el.scrollWidth}x\${el.scrollHeight}) exceeds its visible container size (\${el.clientWidth}x\${el.clientHeight}) and is being clipped. Unless this is a scrollable area, it looks broken.\`,
                 expectedBehavior: 'Expand the container or wrap text to ensure all content is visible.',
                 locationDescription: \`Element: <\${el.tagName.toLowerCase()}>\` + (el.id ? \`#\${el.id}\` : '') + (el.getAttribute('class') ? \`.\${el.getAttribute('class').split(' ')[0]}\` : ''),
                 elementHtml: el.outerHTML.slice(0, 100),
                 suggestedFix: 'Increase the container width/height, add text wrapping (word-wrap: break-word), or ensure the content fits within its container.'
              });
           }
        }
      });

      // 4. Check for Cramped Text (Insufficient Padding) - REDUCED SENSITIVITY
      treeWalker.currentNode = document.body; // Reset walker
      const textNodeIter = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      
      let crampedChecked = 0;
      const crampedIssues = [];
      
      while(textNodeIter.nextNode() && crampedChecked < 200) {
         crampedChecked++;
         const node = textNodeIter.currentNode;
         if (!node.textContent || node.textContent.trim().length < 5) continue;
         
         const range = document.createRange();
         range.selectNodeContents(node);
         const rect = range.getBoundingClientRect();
         
         if (rect.width === 0 || rect.height === 0) continue;
         
         const parent = node.parentElement;
         if (!parent) continue;
         const parentRect = parent.getBoundingClientRect();
         const parentStyle = window.getComputedStyle(parent);
         
         // Only care if parent has a visual boundary (border or solid background)
         const hasBorder = parentStyle.borderWidth !== '0px' && parentStyle.borderStyle !== 'none';
         const background = parentStyle.backgroundColor;
         const hasBackground = background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent' && !background.includes('0, 0, 0, 0');
         
         if (!hasBorder && !hasBackground) continue;
         
         // Skip if parent is an inline element or very small
         if (parentStyle.display.includes('inline') && !hasBorder) continue;
         if (parentRect.width < 50 || parentRect.height < 20) continue;
         
         // Check distance to edges. < 3px is considered critically cramped
         const paddingLeft = rect.left - parentRect.left;
         const paddingRight = parentRect.right - rect.right;
         const paddingTop = rect.top - parentRect.top;
         const paddingBottom = parentRect.bottom - rect.bottom;
         
         if (paddingLeft < 3 || paddingRight < 3 || paddingTop < 3 || paddingBottom < 3) {
             const textPreview = node.textContent?.trim().slice(0, 40) + '...' || 'Text';

             crampedIssues.push({
                 code: 'LAYOUT_CRAMPED',
                 severity: 'minor',
                 message: \`Text is too close to the edge (Cramped UI).\`,
                 details: \`Text content has insufficient padding (<4px) from its container edges. It looks compressed and unprofessional. Found: L:\${Math.round(paddingLeft)}px, R:\${Math.round(paddingRight)}px, T:\${Math.round(paddingTop)}px, B:\${Math.round(paddingBottom)}px\`,
                 expectedBehavior: 'Increase padding to at least 8px-12px for better visual breathing room.',
                 locationDescription: \`Text: "\${textPreview}" (in <\${parent.tagName.toLowerCase()}>)\`,
                 elementHtml: parent.outerHTML.slice(0, 200),
                 suggestedFix: 'Add padding to the container element: padding: 8px 12px; or similar.'
             });
         }
      }
      
      // Limit cramped issues to prevent flooding
      issues.push(...crampedIssues.slice(0, 5));

      return issues;
    })()
  `);

  return (layoutIssues as any[]).map((issue: any) => ({
    id: crypto.randomUUID(),
    ...issue
  }));
}
