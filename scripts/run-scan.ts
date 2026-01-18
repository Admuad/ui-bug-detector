import { Crawler } from '../lib/detector/crawler';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    const targetUrl = process.argv[2] || 'https://quantum-assets.io/';
    console.log(`Starting advanced scan on: ${targetUrl}`);

    const crawler = new Crawler();
    const result = await crawler.crawl(targetUrl, {
        checkAccessibility: true,
        checkLayout: true,
        checkInteraction: true, // Includes dynamic interaction
        checkTypo: true,
        viewports: [{ width: 1440, height: 900, label: 'Desktop' }] // Just desktop for speed in deep crawl
    }, 10, 2); // Limit to 10 pages, depth 2

    console.log(`\nCrawl Complete.`);
    console.log(`Pages Scanned: ${result.pagesScanned}`);
    console.log(`Aggregated Score: ${result.aggregatedScore}`);

    // Generate Markdown Report
    let reportMd = `# Advanced Bug Report for ${targetUrl}\n\n`;
    reportMd += `**Date:** ${new Date().toLocaleString()}\n`;
    reportMd += `**Pages Scanned:** ${result.pagesScanned}\n`;
    reportMd += `**Overall Score:** ${result.aggregatedScore}/100\n\n`;

    reportMd += `## Scan Summary\n\n`;

    for (const scan of result.results) {
        reportMd += `### Page: [${scan.url}](${scan.url})\n`;
        reportMd += `**Score:** ${scan.score} | **Bugs:** ${scan.bugs.length}\n`;

        if (scan.bugs.length > 0) {
            reportMd += `| Severity | Code | Issue | Location |\n`;
            reportMd += `|---|---|---|---|\n`;
            for (const bug of scan.bugs) {
                const friendly = bug.friendlyName || bug.code;
                reportMd += `| **${bug.severity.toUpperCase()}** | ${friendly} | ${bug.message} | ${bug.locationDescription || 'N/A'} |\n`;
            }
        } else {
            reportMd += `*No bugs found.*\n`;
        }
        reportMd += `\n---\n\n`;
    }

    const reportPath = path.join(process.cwd(), 'scan_report.md');
    fs.writeFileSync(reportPath, reportMd);
    console.log(`Report exported to: ${reportPath}`);
    process.exit(0);
}

run().catch(console.error);
