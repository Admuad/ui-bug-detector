/**
 * GitHub URL Parser
 * Extracts owner, repo, branch from various GitHub URL formats
 */

export interface ParsedGitHubUrl {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
    isValid: boolean;
    error?: string;
}

const GITHUB_URL_PATTERNS = [
    // Standard: https://github.com/owner/repo
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/\#\?]+)\/?$/,
    // With branch: https://github.com/owner/repo/tree/branch
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/\#\?]+)\/?(.*)$/,
    // With blob (file): https://github.com/owner/repo/blob/branch/path
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/,
    // Short format: owner/repo
    /^([^\/\s]+)\/([^\/\s]+)$/
];

/**
 * Parse a GitHub URL into its components
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl {
    const trimmed = input.trim();

    if (!trimmed) {
        return { owner: '', repo: '', isValid: false, error: 'Empty input' };
    }

    // Try standard URL patterns
    // Pattern 1: https://github.com/owner/repo
    const match1 = trimmed.match(GITHUB_URL_PATTERNS[0]);
    if (match1) {
        return {
            owner: match1[1],
            repo: cleanRepoName(match1[2]),
            isValid: true
        };
    }

    // Pattern 2: https://github.com/owner/repo/tree/branch[/path]
    const match2 = trimmed.match(GITHUB_URL_PATTERNS[1]);
    if (match2) {
        return {
            owner: match2[1],
            repo: cleanRepoName(match2[2]),
            branch: match2[3],
            path: match2[4] || undefined,
            isValid: true
        };
    }

    // Pattern 3: https://github.com/owner/repo/blob/branch/path
    const match3 = trimmed.match(GITHUB_URL_PATTERNS[2]);
    if (match3) {
        return {
            owner: match3[1],
            repo: cleanRepoName(match3[2]),
            branch: match3[3],
            path: match3[4],
            isValid: true
        };
    }

    // Pattern 4: Short format owner/repo
    const match4 = trimmed.match(GITHUB_URL_PATTERNS[3]);
    if (match4 && !trimmed.includes('://')) {
        return {
            owner: match4[1],
            repo: cleanRepoName(match4[2]),
            isValid: true
        };
    }

    return {
        owner: '',
        repo: '',
        isValid: false,
        error: 'Invalid GitHub URL format. Use: https://github.com/owner/repo or owner/repo'
    };
}

/**
 * Clean repo name (remove .git suffix, etc.)
 */
function cleanRepoName(name: string): string {
    return name.replace(/\.git$/, '').trim();
}

/**
 * Validate if a GitHub repo exists (lightweight check)
 */
export async function validateGitHubRepo(owner: string, repo: string): Promise<{ exists: boolean; error?: string }> {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            method: 'HEAD',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'UI-Bug-Detector/1.0'
            }
        });

        if (response.ok) {
            return { exists: true };
        } else if (response.status === 404) {
            return { exists: false, error: 'Repository not found. Check the URL or ensure it is public.' };
        } else if (response.status === 403) {
            return { exists: false, error: 'Rate limited. Please try again later or add your GitHub token.' };
        }
        return { exists: false, error: `GitHub API error: ${response.status}` };
    } catch (error: any) {
        return { exists: false, error: `Network error: ${error.message}` };
    }
}

/**
 * Get the download URL for a repo archive
 */
export function getRepoArchiveUrl(owner: string, repo: string, branch: string = 'main'): string {
    return `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
}

/**
 * Get the raw content URL for a file
 */
export function getRawFileUrl(owner: string, repo: string, branch: string, filePath: string): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}
