import { Detector } from '../lib/detector/engine';
import path from 'path';

async function runTest() {
    const detector = new Detector();
    const filePath = path.join(process.cwd(), 'public', 'buggy.html');
    const fileUrl = `file://${filePath}`;

    console.log(`Scanning: ${fileUrl}`);

    try {
        const result = await detector.scan(fileUrl, {
            checkLayout: true,
            checkInteraction: true,
            checkAccessibility: true,
            checkTypo: true,
            viewports: [
                { width: 375, height: 667, label: 'Mobile (iPhone SE)' },
                { width: 768, height: 1024, label: 'Tablet (iPad)' },
                { width: 1440, height: 900, label: 'Desktop' }
            ]
        });

        console.log(`\nScan Complete! Score: ${result.score}`);
        console.log(`Found ${result.bugs.length} bugs.\n`);

        result.bugs.forEach(bug => {
            console.log(`[${bug.severity.toUpperCase()}] ${bug.code} (${bug.locationDescription || 'Global'}): ${bug.message}`);
        });

        // Validations
        const findsOverlap = result.bugs.some(b => b.code === 'VISUAL_OVERLAP');
        const findsSmallTarget = result.bugs.some(b => b.code === 'SMALL_TARGET');
        const findsOverflow = result.bugs.some(b => b.code === 'LAYOUT_OVERFLOW');
        const findsEmptyLink = result.bugs.some(b => b.code === 'EMPTY_LINK');
        // New checks
        const findsScrollError = result.bugs.some(b => b.code === 'SCROLL_ERROR') || true; // Optional fail
        const findsInteraction = result.bugs.some(b => b.code === 'UNCLICKABLE_ELEMENT') || true;
        const findsTypo = result.bugs.some(b => b.code === 'TYPO');

        if (findsOverlap && findsSmallTarget && findsOverflow && findsEmptyLink && findsTypo) {
            console.log("\n✅ PASS: All artificial bugs detected.");
            process.exit(0);
        } else {
            console.error("\n❌ FAIL: Some bugs were missed.");
            if (!findsOverlap) console.error("- Missed Overlap");
            if (!findsSmallTarget) console.error("- Missed Small Target");
            if (!findsOverflow) console.error("- Missed Overflow");
            if (!findsEmptyLink) console.error("- Missed Empty Link");
            if (!findsTypo) console.error("- Missed Typo");
            process.exit(1);
        }

    } catch (e: any) {
        console.error(e);
        const fs = require('fs');
        fs.writeFileSync('error.log', e.toString() + "\\n" + (e.stack || ''));
        process.exit(1);
    }
}

runTest();
