export type Severity = 'critical' | 'major' | 'minor' | 'optimization';

export interface Bug {
    id: string;
    code: string;
    severity: Severity;
    message: string;
    selector?: string;
    elementHtml?: string;
    screenshotUrl?: string; // Data URL or path
    boundingBox?: { x: number; y: number; width: number; height: number };
    // Detailed reporting fields
    details?: string;
    expectedBehavior?: string;
    locationDescription?: string;
    pageUrl?: string;
    friendlyName?: string;
    // Priority scoring (calculated based on severity, visibility, frequency)
    priorityScore?: number;  // 0-100, higher = more urgent to fix
    // AI-Agent Enhancement Fields
    suggestedFix?: string;          // Actionable fix instruction for AI agents
    codeSnippet?: string;           // Relevant code context
    fileLocation?: {                // For repo scans - precise file location
        file: string;
        startLine?: number;
        endLine?: number;
    };
    wcagCriteria?: string;          // WCAG reference for accessibility issues
}

export interface BugCluster {
    code: string;
    friendlyName: string;
    severity: Severity;
    count: number;
    bugs: Bug[];
    pages: string[];
    description: string;
}

export interface PageScore {
    url: string;
    score: number;
    bugCount: {
        critical: number;
        major: number;
        minor: number;
        optimization: number;
    };
}

export interface ScanResult {
    url: string;
    score: number;
    timestamp: string;
    screenshot: string; // Full page screenshot
    bugs: Bug[];
    metrics: {
        loadTime: number;
        domSize: number;
        consoleErrors: number;
    };
    links?: string[]; // Discovered internal links
}

export interface CrawlResult {
    rootUrl: string;
    pagesScanned: number;
    totalPagesFound: number;
    results: ScanResult[];
    aggregatedScore: number;
    // New fields for enhanced reporting
    pageScores?: PageScore[];
    bugClusters?: BugCluster[];
    scanDuration?: number;  // in ms
}

export interface Viewport {
    width: number;
    height: number;
    label: string;
    isMobile?: boolean;
    deviceScaleFactor?: number;
}

export interface DetectorConfig {
    checkAccessibility: boolean;
    checkLayout: boolean;
    checkInteraction: boolean;
    checkTypo?: boolean;
    checkVisual?: boolean;
    checkCrossPage?: boolean;  // New: cross-page consistency
    viewports?: Viewport[];
    // New configuration options
    screenshotQuality?: number;     // 0-100
    maxBugsPerCategory?: number;    // Limit bugs per check type
    customWhitelist?: string[];     // Additional words for typo checker
}

// Progress callback for streaming updates
export type ScanProgressCallback = (progress: {
    phase: 'navigating' | 'scanning' | 'analyzing' | 'complete';
    viewport?: string;
    checkName?: string;
    bugsFound?: number;
}) => void;

// Export extended types for external use
export interface ExtendedScanOptions {
    config: DetectorConfig;
    onProgress?: ScanProgressCallback;
}
