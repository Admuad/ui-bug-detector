/**
 * GitHub Module Index
 * Re-exports all GitHub-related functionality
 */

export { parseGitHubUrl, validateGitHubRepo, getRepoArchiveUrl, getRawFileUrl } from './parser';
export type { ParsedGitHubUrl } from './parser';

export {
    checkRateLimit,
    recordScan,
    storeToken,
    getStoredToken,
    clearToken,
    isValidTokenFormat,
    TOKEN_SECURITY_INFO
} from './rate-limiter';
export type { RateLimitResult } from './rate-limiter';

export { GitHubService, githubService } from './service';
export type { GitHubScanOptions, GitHubScanResult } from './service';
