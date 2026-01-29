import { Page } from 'playwright';
import { Bug } from '../types';
// @ts-ignore
import nspell from 'nspell';
import * as fs from 'fs';
import * as path from 'path';

export async function checkTypo(page: Page, customWhitelist?: string[]): Promise<Bug[]> {
    console.log("[TypoCheck] Starting typo check...");

    // 1. Load both US and British English dictionaries
    let spellUS: any, spellGB: any;

    try {
        // Load US English dictionary
        const dictPathUS = path.join(process.cwd(), 'node_modules', 'dictionary-en-us');
        const affUS = fs.readFileSync(path.join(dictPathUS, 'index.aff'));
        const dicUS = fs.readFileSync(path.join(dictPathUS, 'index.dic'));
        spellUS = nspell(affUS, dicUS);
        console.log("[TypoCheck] US English dictionary loaded");
    } catch (e: any) {
        console.error("[TypoCheck] Failed to load US dictionary:", e);
        return [];
    }

    try {
        // Load British English dictionary
        const dictPathGB = path.join(process.cwd(), 'node_modules', 'dictionary-en-gb');
        const affGB = fs.readFileSync(path.join(dictPathGB, 'index.aff'));
        const dicGB = fs.readFileSync(path.join(dictPathGB, 'index.dic'));
        spellGB = nspell(affGB, dicGB);
        console.log("[TypoCheck] British English dictionary loaded");
    } catch (e: any) {
        console.warn("[TypoCheck] British dictionary not found, using US only");
        spellGB = null;
    }

    // Combined spell check: word is correct if valid in either US or British English
    const isCorrectSpelling = (word: string): boolean => {
        if (spellUS.correct(word)) return true;
        if (spellGB && spellGB.correct(word)) return true;
        return false;
    };

    // Get suggestions from both dictionaries
    const getSuggestions = (word: string): string[] => {
        const suggestions = new Set<string>();
        spellUS.suggest(word).slice(0, 3).forEach((s: string) => suggestions.add(s));
        if (spellGB) {
            spellGB.suggest(word).slice(0, 2).forEach((s: string) => suggestions.add(s));
        }
        return Array.from(suggestions).slice(0, 3);
    };

    // Use spellUS for adding custom words (they'll be checked against both)
    const spell = spellUS;

    // Comprehensive Web/Tech/Startup whitelist - words that are valid but not in standard dictionaries
    const whitelist = [
        // Web3/Crypto/DeFi
        'crypto', 'blockchain', 'web3', 'ethereum', 'bitcoin', 'defi', 'nft', 'nfts', 'dao', 'daos',
        'tokenomics', 'smartcontract', 'wallet', 'wallets', 'dapp', 'dapps', 'fiat', 'altcoin', 'altcoins',
        'mining', 'staking', 'yield', 'airdrop', 'airdrops', 'minting', 'gwei', 'satoshi', 'hodl', 'hodler',
        'litecoin', 'solana', 'polygon', 'binance', 'coinbase', 'metamask', 'opensea', 'uniswap',
        'crosschain', 'multichain', 'omnichain', 'observability', 'depo', 'distro', 'rwa', 'rwas',
        'stablecoins', 'stablecoin', 'vms', 'evm', 'evms', 'concero', 'lanca', 'chainlink', 'ccip',

        // Tech/Dev terms
        'api', 'apis', 'sdk', 'sdks', 'ui', 'ux', 'frontend', 'backend', 'fullstack', 'devops',
        'saas', 'paas', 'iaas', 'baas', 'faas', 'cicd', 'devex', 'dx',
        'repo', 'repos', 'github', 'gitlab', 'bitbucket', 'webhook', 'webhooks',
        'localhost', 'env', 'config', 'configs', 'npm', 'yarn', 'pnpm', 'bun',
        'vite', 'webpack', 'esbuild', 'rollup', 'parcel', 'turbopack',

        // AI/ML
        'ai', 'ml', 'llm', 'llms', 'gpt', 'chatgpt', 'claude', 'gemini', 'openai', 'anthropic',
        'bot', 'bots', 'chatbot', 'algo', 'algos', 'analytics', 'dashboard', 'quantum',
        'copilot', 'autopilot', 'agentic', 'multimodal', 'embeddings', 'rag',

        // Programming languages/frameworks
        'javascript', 'typescript', 'python', 'golang', 'rust', 'kotlin', 'swift',
        'nextjs', 'reactjs', 'vuejs', 'svelte', 'nuxt', 'astro', 'remix', 'gatsby',
        'nodejs', 'deno', 'expressjs', 'fastapi', 'django', 'flask', 'rails',
        'tailwind', 'tailwindcss', 'postcss', 'scss', 'sass', 'css', 'html',
        'prisma', 'drizzle', 'supabase', 'firebase', 'mongodb', 'postgresql', 'mysql', 'redis',
        'graphql', 'trpc', 'grpc', 'restful', 'websocket', 'websockets',
        'vercel', 'netlify', 'cloudflare', 'aws', 'gcp', 'azure',
        'docker', 'kubernetes', 'k8s', 'nginx', 'caddy',

        // Startup/Business terms
        'startup', 'startups', 'saas', 'mvp', 'kpi', 'kpis', 'okr', 'okrs', 'roi',
        'fintech', 'edtech', 'healthtech', 'proptech', 'insurtech', 'regtech', 'legaltech',
        'b2b', 'b2c', 'd2c', 'gtm', 'arr', 'mrr', 'cac', 'ltv', 'churn',
        'fundraise', 'preseed', 'seedstage', 'vc', 'vcs', 'angel', 'accelerator',

        // Common tech abbreviations
        'auth', 'oauth', 'jwt', 'sso', 'mfa', 'totp', '2fa',
        'crud', 'orm', 'cms', 'cdn', 'dns', 'ssl', 'tls', 'http', 'https',
        'json', 'yaml', 'toml', 'xml', 'csv', 'svg', 'webp', 'avif',
        'async', 'await', 'callback', 'middleware', 'serverless', 'microservice', 'microservices',
        'monorepo', 'monolith', 'headless', 'jamstack', 'composable',

        // UI/Design terms
        'navbar', 'sidebar', 'dropdown', 'tooltip', 'popover', 'modal', 'carousel',
        'breadcrumb', 'breadcrumbs', 'pagination', 'skeleton', 'shimmer', 'placeholder',
        'responsive', 'breakpoint', 'breakpoints', 'viewport', 'viewports',
        'glassmorphism', 'neumorphism', 'darkmode', 'lightmode', 'theming',

        // Vibecoder specific + app terms
        'vibecoders', 'vibecoder', 'vibecoding', 'vibe', 'nocode', 'lowcode',
        'bugfix', 'bugfixes', 'hotfix', 'linting', 'linter', 'changelog', 'todo', 'todos',
        'codebase', 'refactor', 'refactoring', 'debugging', 'debugger',

        // Brand names commonly seen
        'google', 'facebook', 'meta', 'twitter', 'linkedin', 'instagram', 'tiktok',
        'slack', 'discord', 'notion', 'figma', 'canva', 'miro', 'jira', 'asana', 'trello',
        'stripe', 'paypal', 'shopify', 'hubspot', 'salesforce', 'zendesk', 'intercom',
        'concero', 'lanca', 'chainlink', 'ccip', 'blockchains', 'leaderboard',


        // Misc tech words
        'dropdown', 'checkbox', 'textfield', 'login', 'signup', 'signin', 'logout', 'logoff',
        'onboarding', 'offboarding', 'workflow', 'workflows', 'automation', 'automations',
        'plugin', 'plugins', 'addon', 'addons', 'extension', 'extensions',
        'realtime', 'offline', 'online', 'uptime', 'downtime', 'latency', 'throughput',
        'scalable', 'scalability', 'performant', 'optimized', 'optimizing'
    ];

    whitelist.forEach(w => spell.add(w));

    // Add custom whitelist if provided
    if (customWhitelist && customWhitelist.length > 0) {
        customWhitelist.forEach(w => spell.add(w.toLowerCase()));
        console.log(`[TypoCheck] Added ${customWhitelist.length} custom whitelist words`);
    }

    // 2. Extract visible text from the page
    const textNodesData: { text: string; selector: string; rect: any; name: string; location: string }[] = await page.evaluate(`
        (function() {
            var walker = document.createTreeWalker(
                document.body,
                4, // NodeFilter.SHOW_TEXT
                {
                    acceptNode: function(node) {
                        var parent = node.parentElement;
                        if (!parent) return 2; // NodeFilter.FILTER_REJECT
                        
                        var tag = parent.tagName.toLowerCase();
                        if (tag === 'script' || tag === 'style' || tag === 'code' || tag === 'pre' || tag === 'noscript') {
                            return 2;
                        }
                        
                        // Check visibility
                        var style = window.getComputedStyle(parent);
                        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                            return 2;
                        }
                        
                        return 1; // NodeFilter.FILTER_ACCEPT
                    }
                }
            );

            var nodes = [];
            while(walker.nextNode()) {
                var node = walker.currentNode;
                var text = node.textContent ? node.textContent.trim() : '';
                if (text && text.length > 2) { 
                     var parent = node.parentElement;
                     if (parent) {
                         var rect = parent.getBoundingClientRect();
                         nodes.push({
                             text: text,
                             name: window.SemanticResolver.getFriendlyName(parent),
                             location: window.SemanticResolver.getLocationDescription(parent),
                             selector: parent.tagName.toLowerCase(),
                             rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                         });
                     }
                }
            }
            return nodes;
        })()
    `);

    console.log(`[TypoCheck] Found ${textNodesData.length} text nodes`);

    const bugs: Bug[] = [];
    const seenTypos = new Set<string>();

    for (const item of textNodesData) {
        const words = item.text.split(/[\s,.!?;:()"\[\]{}/\\-]+/).filter(w => w.length > 2);

        for (const word of words) {
            if (/\d/.test(word)) continue;
            if (word.length > 20) continue;
            if (seenTypos.has(word.toLowerCase())) continue;

            const cleanWord = word.replace(/^['"]|['"]$/g, '');

            // Check against both US and British English dictionaries
            if (!isCorrectSpelling(cleanWord)) {
                const suggestions = getSuggestions(cleanWord).join(', ');

                bugs.push({
                    id: crypto.randomUUID(),
                    code: 'TYPO',
                    severity: 'minor',
                    message: `Possible typo detected in "${item.name}": "${cleanWord}".`,
                    details: `The word "${cleanWord}" was not found in the dictionary. Did you mean: ${suggestions || 'unknown'}?`,
                    expectedBehavior: 'Correct the spelling or add to custom dictionary if it is a brand name.',
                    friendlyName: item.name,
                    locationDescription: item.location,
                    boundingBox: item.rect
                });
                seenTypos.add(word.toLowerCase());

                if (bugs.length > 20) break;
            }
        }
        if (bugs.length > 20) break;
    }

    console.log(`[TypoCheck] Finished. Found ${bugs.length} typos.`);
    return bugs;
}
