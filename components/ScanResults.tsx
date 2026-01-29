'use client';

import { Bug, ScanResult, CrawlResult } from "@/lib/detector/types";
import { AlertTriangle, CheckCircle, XCircle, Info, Download, ChevronDown, ChevronRight, Globe, Layers, Type, Lightbulb } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { PriorityBadge, SuggestedFixCallout } from "./ScanProgress";

function isCrawlResult(res: ScanResult | CrawlResult): res is CrawlResult {
    return (res as CrawlResult).results !== undefined;
}

export function ScanResults({ result }: { result: ScanResult | CrawlResult }) {
    const isCrawl = isCrawlResult(result);
    const results = isCrawl ? result.results : [result];
    const score = isCrawl ? result.aggregatedScore : result.score;

    // Aggregate bugs
    const allBugs = results.flatMap(r => r.bugs);
    const [selectedBugIds, setSelectedBugIds] = useState<Set<string>>(new Set(allBugs.map(b => b.id)));

    const criticals = allBugs.filter(b => b.severity === 'critical');
    const majors = allBugs.filter(b => b.severity === 'major');
    const minors = allBugs.filter(b => b.severity === 'minor');

    const toggleBugSelection = (id: string) => {
        const next = new Set(selectedBugIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedBugIds(next);
    };

    const toggleCategorySelection = (bugIds: string[], select: boolean) => {
        const next = new Set(selectedBugIds);
        bugIds.forEach(id => {
            if (select) next.add(id);
            else next.delete(id);
        });
        setSelectedBugIds(next);
    };

    const selectAll = () => setSelectedBugIds(new Set(allBugs.map(b => b.id)));
    const selectNone = () => setSelectedBugIds(new Set());

    const generateAIFriendlyReport = (format: 'markdown' | 'json' = 'markdown') => {
        const selectedBugs = allBugs.filter(b => selectedBugIds.has(b.id));
        const selectedCriticals = selectedBugs.filter(b => b.severity === 'critical');
        const selectedMajors = selectedBugs.filter(b => b.severity === 'major');
        const selectedMinors = selectedBugs.filter(b => b.severity === 'minor');

        const reportData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                tool: 'UI Bug Detector',
                version: '1.0.0',
                overallScore: score,
                pagesScanned: results.length,
                totalBugsInResults: allBugs.length,
                bugsInReport: selectedBugs.length,
                critical: selectedCriticals.length,
                major: selectedMajors.length,
                minor: selectedMinors.length
            },
            instructions: 'This report is optimized for AI coding agents. Each bug includes actionable fix suggestions. Process bugs by severity (critical first).',
            bugs: selectedBugs.map((b, i) => ({
                id: i + 1,
                code: b.code,
                name: b.friendlyName || b.code,
                severity: b.severity,
                page: b.pageUrl || results[0]?.url || 'unknown',
                location: b.locationDescription || 'Unknown',
                message: b.message,
                expectedBehavior: b.expectedBehavior || 'N/A',
                suggestedFix: b.suggestedFix || getSuggestedFix(b),
                wcag: b.wcagCriteria || getWcagCriteria(b.code),
                elementHtml: b.elementHtml?.slice(0, 200),
                selector: b.selector
            }))
        };

        if (format === 'json') {
            return JSON.stringify(reportData, null, 2);
        }

        // Generate markdown
        let md = `# UI Bug Report\n\n`;
        md += `> **Generated:** ${reportData.metadata.generatedAt}\n`;
        md += `> **Score:** ${score}/100\n`;
        md += `> **Pages Scanned:** ${results.length}\n`;
        md += `> **Bugs Exported:** ${selectedBugs.length} / ${allBugs.length}\n\n`;
        md += `---\n\n`;
        md += `## Summary\n\n`;
        md += `| Severity | Count |\n|----------|-------|\n`;
        md += `| 🔴 Critical | ${selectedCriticals.length} |\n`;
        md += `| 🟠 Major | ${selectedMajors.length} |\n`;
        md += `| 🟡 Minor | ${selectedMinors.length} |\n\n`;
        md += `---\n\n`;
        md += `## AI Agent Instructions\n\n`;
        md += `Process the bugs below in order of severity. Each bug includes a suggested fix.\n`;
        md += `**Note for Agent:** Repetitive issues have been consolidated. Check the "Affected Elements" count.\n\n`;
        md += `---\n\n`;

        // Group by severity
        const severityOrder = ['critical', 'major', 'minor'];
        let bugCounter = 1;

        for (const sev of severityOrder) {
            const bugs = selectedBugs.filter(b => b.severity === sev);
            if (bugs.length === 0) continue;

            const icon = sev === 'critical' ? '🔴' : sev === 'major' ? '🟠' : '🟡';
            md += `## ${icon} ${sev.charAt(0).toUpperCase() + sev.slice(1)} Issues\n\n`;

            const groupedByCode = bugs.reduce((acc, bug) => {
                if (!acc[bug.code]) acc[bug.code] = [];
                acc[bug.code].push(bug);
                return acc;
            }, {} as Record<string, Bug[]>);

            Object.entries(groupedByCode).forEach(([code, codeBugs]) => {
                if (codeBugs.length > 5) {
                    const sample = codeBugs[0];
                    md += `### ${bugCounter++}. ${sample.friendlyName || sample.code} (x${codeBugs.length})\n\n`;
                    md += `- **Code:** \`${sample.code}\`\n`;
                    md += `- **Impact:** Affected ${codeBugs.length} elements across the page.\n`;
                    md += `- **Message:** ${sample.message}\n`;
                    if (sample.expectedBehavior) md += `- **Expected:** ${sample.expectedBehavior}\n`;
                    const wcag = sample.wcagCriteria || getWcagCriteria(sample.code);
                    if (wcag) md += `- **WCAG:** ${wcag}\n`;
                    md += `- **Fix:** ${sample.suggestedFix || getSuggestedFix(sample)}\n`;
                    md += `- **Example Location:** ${sample.locationDescription || 'Unknown'}\n`;
                    md += `\n`;
                } else {
                    codeBugs.forEach(b => {
                        md += `### ${bugCounter++}. ${b.friendlyName || b.code}\n\n`;
                        md += `- **Code:** \`${b.code}\`\n`;
                        md += `- **Page:** \`${b.pageUrl || 'N/A'}\`\n`;
                        md += `- **Location:** ${b.locationDescription || 'Unknown'}\n`;
                        md += `- **Message:** ${b.message}\n`;
                        if (b.expectedBehavior) md += `- **Expected:** ${b.expectedBehavior}\n`;
                        const wcag = b.wcagCriteria || getWcagCriteria(b.code);
                        if (wcag) md += `- **WCAG:** ${wcag}\n`;
                        md += `- **Fix:** ${b.suggestedFix || getSuggestedFix(b)}\n`;
                        if (b.elementHtml) md += `- **Element:** \`${b.elementHtml.slice(0, 100)}...\`\n`;
                        md += `\n`;
                    });
                }
            });
        }

        return md;
    };

    const handleDownloadReport = (format: 'markdown' | 'json' = 'markdown') => {
        if (selectedBugIds.size === 0) {
            toast.error("No bugs selected for export");
            return;
        }
        const content = generateAIFriendlyReport(format);
        const mimeType = format === 'json' ? 'application/json' : 'text/markdown';
        const ext = format === 'json' ? 'json' : 'md';

        let domain = 'scan-report';
        try {
            const urlObj = new URL(results[0]?.url || '');
            domain = urlObj.hostname.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        } catch (e) {
            domain = (results[0]?.url || 'scan-report').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        }

        const date = new Date().toISOString().slice(0, 10);
        const filename = `${domain}-${date}.${ext}`;

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} report downloaded (${selectedBugIds.size} bugs)`);
    };

    return (
        <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Score Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#18181b] border-2 border-black dark:border-zinc-700 p-6 flex flex-col items-center justify-center text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                    <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-2">Overall Score</div>
                    <div className={`text-6xl font-black ${getScoreColor(score)}`}>{score}</div>
                </div>

                <div className="bg-white dark:bg-[#18181b] border-2 border-black dark:border-zinc-700 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] col-span-2 flex flex-col justify-center relative">
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button
                            onClick={() => handleDownloadReport('markdown')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors flex items-center gap-1 text-xs font-bold text-black dark:text-white"
                            title="Export Markdown Report"
                        >
                            <Download size={16} /> MD
                        </button>
                        <button
                            onClick={() => handleDownloadReport('json')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors flex items-center gap-1 text-xs font-bold text-black dark:text-white"
                            title="Export JSON Report"
                        >
                            <Download size={16} /> JSON
                        </button>
                    </div>
                    <h3 className="font-bold text-xl mb-4 text-black dark:text-white">Summary {isCrawl && `(${results.length} Pages)`}</h3>
                    <div className="flex gap-4">
                        <Badge count={criticals.length} label="Critical" color="bg-red-500 text-white" />
                        <Badge count={majors.length} label="Major" color="bg-orange-500 text-white" />
                        <Badge count={minors.length} label="Minor" color="bg-yellow-400 text-black" />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                            Found {allBugs.length} issues. **{selectedBugIds.size} selected for export.**
                        </p>
                        <div className="flex gap-3">
                            <button onClick={selectAll} className="text-[10px] uppercase font-bold text-brand hover:underline">Select All</button>
                            <button onClick={selectNone} className="text-[10px] uppercase font-bold text-gray-500 hover:underline">Deselect All</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Grouped by Page */}
            <div className="space-y-6">
                {results.map((pageResult, i) => (
                    <PageResultGroup
                        key={i}
                        result={pageResult}
                        isDefaultOpen={i === 0}
                        selectedBugIds={selectedBugIds}
                        onToggleBug={toggleBugSelection}
                        onToggleCategory={toggleCategorySelection}
                    />
                ))}
            </div>
        </div>
    );
}

function PageResultGroup({ result, isDefaultOpen, selectedBugIds, onToggleBug, onToggleCategory }: {
    result: ScanResult,
    isDefaultOpen: boolean,
    selectedBugIds: Set<string>,
    onToggleBug: (id: string) => void,
    onToggleCategory: (ids: string[], select: boolean) => void
}) {
    const [isOpen, setIsOpen] = useState(isDefaultOpen);
    const criticalCount = result.bugs.filter(b => b.severity === 'critical').length;
    const majorCount = result.bugs.filter(b => b.severity === 'major').length;

    // Group bugs by friendly category (derived from code)
    const groupedBugs = result.bugs.reduce((acc, bug) => {
        const category = getCategory(bug.code);
        if (!acc[category]) acc[category] = [];
        acc[category].push(bug);
        return acc;
    }, {} as Record<string, Bug[]>);

    const getPathname = (urlStr: string) => {
        try {
            return new URL(urlStr).pathname;
        } catch {
            return urlStr;
        }
    };

    return (
        <div className="bg-white dark:bg-[#18181b] border-2 border-black dark:border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 bg-gray-50 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full border-2 border-black dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white`}>
                        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <Globe size={16} className="text-gray-500" />
                            <h4 className="font-bold text-lg truncate max-w-[300px] sm:max-w-md" title={result.url}>{getPathname(result.url)}</h4>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{result.url}</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {(criticalCount > 0 || majorCount > 0) && (
                        <div className="flex gap-1">
                            {criticalCount > 0 && <span className="w-3 h-3 rounded-full bg-red-500" title={`${criticalCount} Critical`} />}
                            {majorCount > 0 && <span className="w-3 h-3 rounded-full bg-orange-500" title={`${majorCount} Major`} />}
                        </div>
                    )}
                    <span className={`font-bold text-2xl ${getScoreColor(result.score)}`}>{result.score}</span>
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-white dark:bg-[#18181b]"
                    >
                        <div className="p-6 pt-2 space-y-4 border-t-2 border-dashed border-gray-200 dark:border-zinc-700">
                            {result.bugs.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <CheckCircle className="mx-auto mb-2 text-green-500" />
                                    No issues found on this page.
                                </div>
                            ) : (
                                Object.entries(groupedBugs).map(([category, bugs]) => (
                                    <CategoryGroup
                                        key={category}
                                        category={category}
                                        bugs={bugs}
                                        selectedBugIds={selectedBugIds}
                                        onToggleBug={onToggleBug}
                                        onToggleCategory={onToggleCategory}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function CategoryGroup({ category, bugs, selectedBugIds, onToggleBug, onToggleCategory }: {
    category: string,
    bugs: Bug[],
    selectedBugIds: Set<string>,
    onToggleBug: (id: string) => void,
    onToggleCategory: (ids: string[], select: boolean) => void
}) {
    const [isOpen, setIsOpen] = useState(true);
    const selectedInCategory = bugs.filter(b => selectedBugIds.has(b.id)).length;
    const allSelected = selectedInCategory === bugs.length;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors py-2"
                >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {category} ({bugs.length})
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{selectedInCategory} / {bugs.length} Selected</span>
                    <button
                        onClick={() => onToggleCategory(bugs.map(b => b.id), !allSelected)}
                        className={`text-[10px] font-bold uppercase py-0.5 px-2 rounded border ${allSelected ? 'bg-zinc-100 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700' : 'bg-brand/10 text-brand border-brand/20'}`}
                    >
                        {allSelected ? 'Deselect Type' : 'Select Type'}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 pl-2 sm:pl-4 overflow-hidden"
                    >
                        {bugs.map(bug => (
                            <BugCard
                                key={bug.id}
                                bug={bug}
                                isSelected={selectedBugIds.has(bug.id)}
                                onToggle={() => onToggleBug(bug.id)}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BugCard({ bug, isSelected, onToggle }: { bug: Bug, isSelected: boolean, onToggle: () => void }) {
    const [expanded, setExpanded] = React.useState(false);
    const icon = bug.severity === 'critical' ? <XCircle /> : bug.severity === 'major' ? <AlertTriangle /> : <Info />;
    const borderClass = bug.severity === 'critical' ? 'border-l-[6px] border-l-red-500' : bug.severity === 'major' ? 'border-l-[6px] border-l-orange-500' : 'border-l-[6px] border-l-yellow-400';

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const report = `
Detailed Bug Report
-------------------
Code: ${bug.code}
Name: ${bug.friendlyName || bug.code}
Severity: ${bug.severity.toUpperCase()}
Priority: ${bug.priorityScore || 'N/A'}
Page: ${bug.pageUrl || 'Unknown'}
Location: ${bug.locationDescription || 'Unknown'}
Message: ${bug.message}
Expected Behavior: ${bug.expectedBehavior || 'N/A'}
Suggested Fix: ${bug.suggestedFix || getSuggestedFix(bug)}
Details: ${bug.details || 'N/A'}
        `.trim();
        navigator.clipboard.writeText(report);
        toast.success('Bug report copied');
    };

    return (
        <motion.div
            layout
            className={`bg-white dark:bg-[#27272a] border ${isSelected ? 'border-brand dark:border-brand/40 ring-1 ring-brand/20' : 'border-gray-200 dark:border-zinc-700'} rounded-sm p-4 shadow-sm flex gap-4 ${borderClass} cursor-pointer hover:shadow-md transition-all relative group`}
            onClick={() => setExpanded(!expanded)}
        >
            <div
                className="flex flex-col items-center gap-3 pt-1"
                onClick={(e) => e.stopPropagation()}
            >
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggle}
                    className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand accent-brand cursor-pointer"
                />
                <div className={`shrink-0 ${bug.severity === 'critical' ? 'text-red-500' : bug.severity === 'major' ? 'text-orange-500' : 'text-yellow-400'}`}>{icon}</div>
            </div>

            <div className="overflow-hidden w-full">
                <div className="flex items-center gap-2 mb-1 justify-between">
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-black dark:text-white">{bug.friendlyName || bug.code}</span>
                            <span className="font-mono text-[10px] font-bold uppercase bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">{bug.code}</span>
                            {bug.priorityScore && <PriorityBadge score={bug.priorityScore} />}
                        </div>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="text-[10px] font-bold uppercase border border-gray-300 dark:border-zinc-600 px-2 py-1 rounded hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors text-gray-600 dark:text-gray-400"
                    >
                        Copy
                    </button>
                </div>
                <p className="font-medium text-sm text-gray-800 dark:text-gray-200 leading-snug mt-1">{bug.message}</p>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 space-y-2 text-xs border-t border-gray-100 dark:border-zinc-700 pt-3 text-gray-600 dark:text-gray-400">
                                {bug.locationDescription && (
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">Location:</span>
                                        <span className="font-mono">{bug.locationDescription}</span>
                                    </div>
                                )}
                                {bug.expectedBehavior && (
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">Expected:</span>
                                        <span>{bug.expectedBehavior}</span>
                                    </div>
                                )}
                                {bug.details && (
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">Details:</span>
                                        <span className="whitespace-pre-wrap">{bug.details}</span>
                                    </div>
                                )}
                                {bug.wcagCriteria && (
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">WCAG:</span>
                                        <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-1 rounded inline-block">{bug.wcagCriteria}</span>
                                    </div>
                                )}
                            </div>

                            {/* Prominent Suggested Fix */}
                            <SuggestedFixCallout
                                fix={bug.suggestedFix || getSuggestedFix(bug)}
                                wcag={bug.wcagCriteria || getWcagCriteria(bug.code) || undefined}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

function Badge({ count, label, color }: { count: number, label: string, color: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="font-bold">{count}</span>
            <span className="text-gray-500">{label}</span>
        </div>
    );
}

function getScoreColor(score: number) {
    if (score >= 90) return "text-brand";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
}

function getCategory(code: string): string {
    if (code.startsWith('A11Y')) return 'Accessibility';
    if (code === 'TYPO') return 'Content & Spelling';
    if (['SMALL_TARGET', 'EMPTY_LINK', 'UNCLICKABLE_ELEMENT'].includes(code)) return 'Interaction & UX';
    if (['LAYOUT_OVERFLOW', 'VISUAL_OVERLAP'].includes(code)) return 'Visual Layout';
    if (code === 'CONSOLE_ERROR') return 'Technical Health';
    if (code === 'BROKEN_LINK') return 'Navigation';
    return 'Other Issues';
}

function getSuggestedFix(bug: Bug): string {
    const fixMap: Record<string, string> = {
        'LAYOUT_OVERFLOW': 'Add overflow-x: hidden to the body or fix the element causing overflow. Check for fixed-width elements that exceed viewport.',
        'VISUAL_OVERLAP': 'Adjust element positions or z-index. Ensure text elements have proper spacing and do not overlap.',
        'SMALL_TARGET': 'Increase clickable area to at least 44x44 pixels for touch accessibility. Add padding or increase font size.',
        'EMPTY_LINK': 'Add an href value to the link or remove it if not needed. Empty links confuse screen readers.',
        'A11Y_IMG_ALT': 'Add descriptive alt text to the image: alt="description of what the image shows"',
        'A11Y_COLOR_CONTRAST': 'Increase color contrast ratio to at least 4.5:1 for normal text, 3:1 for large text.',
        'A11Y_REGION': 'Add landmark regions using semantic HTML: <header>, <main>, <nav>, <footer>, or ARIA roles.',
        'TYPO': 'Fix the spelling error in the text content.',
        'LAYOUT_CLIPPED': 'Expand the container size or add scrollable overflow. Ensure all content is visible.',
        'LAYOUT_CRAMPED': 'Add padding of at least 8-12px to give content breathing room inside its container.',
        'VISUAL_MISALIGNMENT': 'Align elements properly using flexbox or grid. Ensure consistent spacing.',
        'VISUAL_INCONSISTENT_SPACING': 'Standardize spacing using CSS custom properties or a spacing scale (4px, 8px, 16px, etc.)',
        'VISUAL_LONG_LINES': 'Limit line length to 60-80 characters using max-width on text containers.',
        'MEDIA_BROKEN': 'Check the image/video source path. Ensure the file exists and is accessible.',
        'SCROLL_ERROR': 'Fix scroll-related JavaScript errors. Check for infinite scroll loops or missing scroll containers.',
        'UNCLICKABLE_ELEMENT': 'Ensure the element is not covered by another element. Check z-index and pointer-events CSS.',
        'BROKEN_LINK': 'Update the link href to a valid destination or remove the broken link.',
        'CONSOLE_ERROR': 'Debug the JavaScript error in browser DevTools. Check for null references, missing modules, or API failures.'
    };
    return fixMap[bug.code] || 'Review the element and fix according to the error description.';
}

function getWcagCriteria(code: string): string | null {
    const wcagMap: Record<string, string> = {
        'A11Y_IMG_ALT': '1.1.1 Non-text Content (Level A)',
        'A11Y_COLOR_CONTRAST': '1.4.3 Contrast (Minimum) (Level AA)',
        'A11Y_REGION': '1.3.1 Info and Relationships (Level A)',
        'SMALL_TARGET': '2.5.5 Target Size (Level AAA) / 2.5.8 Target Size (Minimum) (Level AA)',
        'EMPTY_LINK': '2.4.4 Link Purpose (In Context) (Level A)',
        'VISUAL_LONG_LINES': '1.4.8 Visual Presentation (Level AAA)'
    };
    return wcagMap[code] || null;
}
