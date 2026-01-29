/**
 * SemanticResolver
 * 
 * Provides human-readable names and location context for DOM elements
 * without requiring external API calls. Uses local heuristics and 
 * optional browser-native AI (window.ai).
 */

export const semanticResolverScript = `
(function() {
    window.SemanticResolver = {
        /**
         * Get a "friendly" human-readable name for an element
         */
        getFriendlyName: function(el) {
            if (!el) return 'Unknown Element';

            // 1. Check for explicit labels
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.trim().length > 2) return ariaLabel.trim();

            const labelId = el.getAttribute('aria-labelledby');
            if (labelId) {
                const labelEl = document.getElementById(labelId);
                if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
            }

            // 2. Check for form labels
            if (el.id) {
                const label = document.querySelector(\`label[for="\${el.id}"]\`);
                if (label && label.textContent) return label.textContent.trim();
            }
            const parentLabel = el.closest('label');
            if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

            // 3. Check for obvious text content (for buttons/links)
            const textContent = el.textContent?.trim();
            if (textContent && textContent.length > 2 && textContent.length < 50) {
                return textContent;
            }

            // 4. Check for interactive attributes
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                const placeholder = el.getAttribute('placeholder');
                if (placeholder) return \`"\${placeholder}" field\`;
                
                const name = el.getAttribute('name');
                if (name) return \`\${name} field\`;
            }

            // 5. Image alt text
            if (el.tagName === 'IMG') {
                const alt = el.getAttribute('alt');
                if (alt) return \`Image: \${alt}\`;
                const src = el.getAttribute('src');
                if (src) return \`Image: \${src.split('/').pop()}\`;
            }

            // 6. Generic fallback based on role/tag
            const role = el.getAttribute('role');
            if (role) return role.charAt(0).toUpperCase() + role.slice(1);

            return el.tagName.charAt(0).toUpperCase() + el.tagName.slice(1).toLowerCase();
        },

        /**
         * Describe the contextual location of an element on the page
         */
        getLocationDescription: function(el) {
            if (!el) return 'Unknown location';

            const descriptions = [];

            // 1. Find nearest meaningful container (section, nav, footer, header)
            const container = el.closest('section, nav, footer, header, article, aside, main');
            if (container) {
                const containerName = container.tagName.toLowerCase();
                const containerId = container.id ? \` #\${container.id}\` : '';
                
                // Try to find a heading inside this container
                const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
                if (heading && heading.textContent) {
                    descriptions.push(\`in the "\${heading.textContent.trim()}" \${containerName}\`);
                } else {
                    descriptions.push(\`in the \${containerName}\${containerId}\`);
                }
            }

            // 2. Find nearest preceding heading (if not already in a container with a heading)
            if (descriptions.length === 0) {
                const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
                const precedingHeadings = allHeadings.filter(h => {
                    const comparison = h.compareDocumentPosition(el);
                    return comparison & Node.DOCUMENT_POSITION_FOLLOWING;
                });

                if (precedingHeadings.length > 0) {
                    const lastHeading = precedingHeadings[precedingHeadings.length - 1];
                    descriptions.push(\`below the "\${lastHeading.textContent.trim()}" section\`);
                }
            }

            // 3. Last fallback: Generic grid/list context
            if (descriptions.length === 0) {
                const parent = el.parentElement;
                if (parent) {
                    if (parent.tagName === 'LI') descriptions.push('inside a list item');
                    else if (parent.tagName === 'TD') descriptions.push('inside a table cell');
                }
            }

            return descriptions.length > 0 ? descriptions.join(', ') : 'on the page';
        },

        /**
         * Optional: Enrich results using window.ai if available (Gemini Nano)
         */
        enrichWithAI: async function(bug) {
            if (typeof window.ai === 'undefined' || !window.ai.canCreateTextSession) return bug;
            
            try {
                const status = await window.ai.canCreateTextSession();
                if (status !== 'readily') return bug;

                const session = await window.ai.createTextSession();
                const prompt = \`Enhance this UI bug report for clarity. 
                Element: \${bug.friendlyName}
                Current Message: \${bug.message}
                Location: \${bug.locationDescription}
                
                Return a JSON object with: 
                - friendlyName: A better name for the element
                - locationDescription: A natural description of where it is
                - message: A clearer bug description\`;

                const result = await session.prompt(prompt);
                // Basic check if result is JSON
                if (result.startsWith('{')) {
                    const enriched = JSON.parse(result);
                    return { ...bug, ...enriched };
                }
            } catch (e) {
                console.warn('AI Enrichment failed:', e);
            }
            return bug;
        }
    };
})();
`;
