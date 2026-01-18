#!/usr/bin/env npx tsx

/**
 * UI Bug Detector CLI
 * Scan websites for UI bugs from the command line
 * 
 * Usage:
 *   npx tsx scripts/cli.ts scan https://example.com
 *   npx tsx scripts/cli.ts crawl https://example.com --depth=3 --pages=20
 *   npx tsx scripts/cli.ts scan https://example.com --output=report.json
 */

import { Detector } from '../lib/detector/engine';
import { Crawler, CrawlProgress } from '../lib/detector/crawler';
import { ScanResult, CrawlResult, Bug } from '../lib/detector/types';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
    command: 'scan' | 'crawl' | 'help';
    url: string;
    depth: number;
    pages: number;
    output?: string;
    format: 'json' | 'markdown' | 'both';
    noMobile: boolean;
    verbose: boolean;
}

function parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
        command: 'help',
        url: '',
        depth: 3,
        pages: 20,
        format: 'both',
        noMobile: false,
        verbose: false
    };

    if (args.length < 2) return options;

    const command = args[0]?.toLowerCase();
    if (command === 'scan' || command === 'crawl') {
        options.command = command;
    }

    options.url = args[1] || '';

    for (let i = 2; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--depth=')) {
            options.depth = parseInt(arg.split('=')[1], 10) || 3;
        } else if (arg.startsWith('--pages=')) {
            options.pages = parseInt(arg.split('=')[1], 10) || 20;
        } else if (arg.startsWith('--output=')) {
            options.output = arg.split('=')[1];
        } else if (arg.startsWith('--format=')) {
            const fmt = arg.split('=')[1]?.toLowerCase();
            if (fmt === 'json' || fmt === 'markdown' || fmt === 'both') {
                options.format = fmt;
            }
        } else if (arg === '--no-mobile') {
            options.noMobile = true;
        } else if (arg === '-v' || arg === '--verbose') {
            options.verbose = true;
        }
    }

    return options;
}

function printHelp(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    UI BUG DETECTOR CLI                       ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx scripts/cli.ts <command> <url> [options]

COMMANDS:
  scan <url>     Scan a single page for UI bugs
  crawl <url>    Crawl and scan multiple pages on a website
  help           Show this help message

OPTIONS:
  --depth=N      Maximum crawl depth (default: 3)
  --pages=N      Maximum pages to scan (default: 20)
  --output=FILE  Output file path (auto-detects format from extension)
  --format=FMT   Output format: json, markdown, or both (default: both)
  --no-mobile    Skip mobile viewport scanning
  -v, --verbose  Verbose output

EXAMPLES:
  npx tsx scripts/cli.ts scan https://example.com
  npx tsx scripts/cli.ts crawl https://example.com --depth=2 --pages=10
  npx tsx scripts/cli.ts scan https://example.com --output=report.json
  npx tsx scripts/cli.ts crawl https://mysite.com --format=markdown -v
`);
}

function formatBugForConsole(bug: Bug, index: number): string {
    const severityIcon = {
        critical: '🔴',
        major: '🟠',
        minor: '🟡',
        optimization: '🔵'
    }[bug.severity];

    return `
  ${severityIcon} ${index + 1}. ${bug.friendlyName || bug.code}
     ${bug.message}
     📍 ${bug.locationDescription || 'Unknown location'}
     💡 ${bug.suggestedFix || 'Review and fix manually'}`;
}

function generateMarkdownReport(result: ScanResult | CrawlResult): string {
    const isCrawl = 'pagesScanned' in result;
    const timestamp = isCrawl ? new Date().toISOString() : (result as ScanResult).timestamp;

    let md = `# UI Bug Report

> **Generated:** ${timestamp}
> **URL:** ${isCrawl ? (result as CrawlResult).rootUrl : (result as ScanResult).url}
`;

    if (isCrawl) {
        const crawl = result as CrawlResult;
        md += `> **Pages Scanned:** ${crawl.pagesScanned} of ${crawl.totalPagesFound} discovered
> **Aggregated Score:** ${crawl.aggregatedScore}/100

---

## Summary by Page

| Page | Score | Bugs |
|------|-------|------|
`;
        for (const pageResult of crawl.results) {
            const path = new URL(pageResult.url).pathname;
            md += `| ${path} | ${pageResult.score}/100 | ${pageResult.bugs.length} |\n`;
        }

        md += `\n---\n\n`;

        // Aggregate all bugs
        const allBugs = crawl.results.flatMap(r => r.bugs);
        md += generateBugSection(allBugs);
    } else {
        const scan = result as ScanResult;
        md += `> **Score:** ${scan.score}/100

---

`;
        md += generateBugSection(scan.bugs);
    }

    return md;
}

function generateBugSection(bugs: Bug[]): string {
    const critical = bugs.filter(b => b.severity === 'critical');
    const major = bugs.filter(b => b.severity === 'major');
    const minor = bugs.filter(b => b.severity === 'minor');
    const optimization = bugs.filter(b => b.severity === 'optimization');

    let md = `## Bug Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${critical.length} |
| 🟠 Major | ${major.length} |
| 🟡 Minor | ${minor.length} |
| 🔵 Optimization | ${optimization.length} |

---

`;

    const addBugList = (title: string, bugs: Bug[]): string => {
        if (bugs.length === 0) return '';

        let section = `## ${title} (${bugs.length})\n\n`;
        bugs.forEach((bug, i) => {
            section += `### ${i + 1}. ${bug.friendlyName || bug.code}

- **Code:** \`${bug.code}\`
- **Page:** \`${bug.pageUrl || 'N/A'}\`
- **Location:** ${bug.locationDescription || 'N/A'}
- **Message:** ${bug.message}
- **Expected:** ${bug.expectedBehavior || 'N/A'}
- **Fix:** ${bug.suggestedFix || 'Review the element and fix according to the error description.'}
${bug.elementHtml ? `- **Element:** \`${bug.elementHtml.slice(0, 100)}...\`\n` : ''}
`;
        });
        return section;
    };

    md += addBugList('🔴 Critical Issues', critical);
    md += addBugList('🟠 Major Issues', major);
    md += addBugList('🟡 Minor Issues', minor);
    md += addBugList('🔵 Optimization Suggestions', optimization);

    return md;
}

async function runScan(options: CLIOptions): Promise<void> {
    console.log(`\n🔍 Scanning: ${options.url}`);
    console.log(`   Viewports: ${options.noMobile ? 'Desktop only' : 'Desktop + Mobile'}\n`);

    const detector = new Detector();

    const viewports = options.noMobile
        ? [{ width: 1440, height: 900, label: 'Desktop' }]
        : [
            { width: 1440, height: 900, label: 'Desktop' },
            { width: 390, height: 844, label: 'Mobile', isMobile: true }
        ];

    const result = await detector.scan(options.url, {
        checkLayout: true,
        checkInteraction: true,
        checkAccessibility: true,
        checkTypo: true,
        checkVisual: true,
        viewports
    });

    printResults(result, options);
}

async function runCrawl(options: CLIOptions): Promise<void> {
    console.log(`\n🕷️  Crawling: ${options.url}`);
    console.log(`   Max Depth: ${options.depth}`);
    console.log(`   Max Pages: ${options.pages}`);
    console.log(`   Viewports: ${options.noMobile ? 'Desktop only' : 'Desktop + Mobile'}\n`);

    const onProgress = (progress: CrawlProgress) => {
        if (options.verbose) {
            console.log(`   [${progress.status}] ${progress.pagesScanned}/${progress.totalPagesQueued} - ${progress.currentPage}`);
        } else {
            process.stdout.write(`\r   Scanning: ${progress.pagesScanned} pages...`);
        }
    };

    const crawler = new Crawler(onProgress);

    const viewports = options.noMobile
        ? [{ width: 1440, height: 900, label: 'Desktop' }]
        : [
            { width: 1440, height: 900, label: 'Desktop' },
            { width: 390, height: 844, label: 'Mobile', isMobile: true }
        ];

    const result = await crawler.crawl(
        options.url,
        {
            checkLayout: true,
            checkInteraction: true,
            checkAccessibility: true,
            checkTypo: true,
            checkVisual: true,
            viewports
        },
        options.pages,
        options.depth
    );

    console.log('\n');
    printCrawlResults(result, options);
}

function printResults(result: ScanResult, options: CLIOptions): void {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  SCAN RESULTS: ${result.url}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n  📊 Score: ${result.score}/100`);
    console.log(`  🐛 Bugs Found: ${result.bugs.length}`);
    console.log(`  ⏱️  Load Time: ${result.metrics.loadTime}ms`);

    if (result.bugs.length > 0) {
        console.log(`\n  TOP ISSUES:`);
        const topBugs = result.bugs.slice(0, 10);
        topBugs.forEach((bug, i) => {
            console.log(formatBugForConsole(bug, i));
        });

        if (result.bugs.length > 10) {
            console.log(`\n  ... and ${result.bugs.length - 10} more issues`);
        }
    } else {
        console.log(`\n  ✅ No bugs found! Great job!`);
    }

    saveOutput(result, options);

    // Exit with code based on severity
    const hasCritical = result.bugs.some(b => b.severity === 'critical');
    const hasMajor = result.bugs.some(b => b.severity === 'major');

    if (hasCritical) {
        console.log(`\n  ❌ CI/CD: FAIL (critical issues found)`);
        process.exitCode = 2;
    } else if (hasMajor) {
        console.log(`\n  ⚠️  CI/CD: WARN (major issues found)`);
        process.exitCode = 1;
    } else {
        console.log(`\n  ✅ CI/CD: PASS`);
        process.exitCode = 0;
    }
}

function printCrawlResults(result: CrawlResult, options: CLIOptions): void {
    console.log(`${'═'.repeat(60)}`);
    console.log(`  CRAWL RESULTS: ${result.rootUrl}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n  📊 Aggregated Score: ${result.aggregatedScore}/100`);
    console.log(`  📄 Pages Scanned: ${result.pagesScanned} of ${result.totalPagesFound} discovered`);

    const allBugs = result.results.flatMap(r => r.bugs);
    console.log(`  🐛 Total Bugs: ${allBugs.length}`);

    console.log(`\n  PAGE BREAKDOWN:`);
    for (const page of result.results) {
        const pagePath = new URL(page.url).pathname;
        console.log(`     ${page.score >= 80 ? '✅' : page.score >= 50 ? '⚠️' : '❌'} ${pagePath} - ${page.score}/100 (${page.bugs.length} bugs)`);
    }

    if (allBugs.length > 0) {
        console.log(`\n  TOP ISSUES ACROSS SITE:`);
        const topBugs = allBugs.slice(0, 10);
        topBugs.forEach((bug, i) => {
            console.log(formatBugForConsole(bug, i));
        });
    }

    saveOutput(result, options);

    // Exit code
    const hasCritical = allBugs.some(b => b.severity === 'critical');
    const hasMajor = allBugs.some(b => b.severity === 'major');

    if (hasCritical) {
        process.exitCode = 2;
    } else if (hasMajor) {
        process.exitCode = 1;
    } else {
        process.exitCode = 0;
    }
}

function saveOutput(result: ScanResult | CrawlResult, options: CLIOptions): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseName = options.output || `bug-report-${timestamp}`;

    if (options.format === 'json' || options.format === 'both') {
        const jsonPath = baseName.endsWith('.json') ? baseName : `${baseName}.json`;
        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
        console.log(`\n  📁 JSON saved: ${path.resolve(jsonPath)}`);
    }

    if (options.format === 'markdown' || options.format === 'both') {
        const mdPath = baseName.endsWith('.md') ? baseName : `${baseName}.md`;
        fs.writeFileSync(mdPath, generateMarkdownReport(result));
        console.log(`  📁 Markdown saved: ${path.resolve(mdPath)}`);
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    if (options.command === 'help' || !options.url) {
        printHelp();
        return;
    }

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    UI BUG DETECTOR CLI                       ║
╚══════════════════════════════════════════════════════════════╝`);

    try {
        if (options.command === 'scan') {
            await runScan(options);
        } else if (options.command === 'crawl') {
            await runCrawl(options);
        }
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exitCode = 1;
    }
}

main();
