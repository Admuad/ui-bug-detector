/**
 * Tests for server-action input validation.
 *
 * We only test pure validation logic that doesn't require an active browser or
 * network: missing URL → error, invalid GitHub URL → error.  The heavier
 * integration paths (actual scans) are covered by e2e / integration tests.
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks so we never hit real I/O
// ---------------------------------------------------------------------------
vi.mock('@/lib/detector/engine', () => {
    function MockDetector() { /* no-op */ }
    MockDetector.prototype.scan = vi.fn().mockResolvedValue({ bugs: [], score: 100 });
    return { Detector: MockDetector };
});

vi.mock('@/lib/detector/crawler', () => {
    function MockCrawler() { /* no-op */ }
    MockCrawler.prototype.crawl = vi.fn().mockResolvedValue({ results: [], aggregatedScore: 100 });
    return { Crawler: MockCrawler };
});

vi.mock('@/lib/github', () => ({
    githubService: {
        scanRepository: vi.fn().mockResolvedValue({ bugs: [], score: 100 }),
    },
    parseGitHubUrl: vi.fn((url: string) => {
        // Only accept exact github.com URLs: https://github.com/owner/repo
        const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/);
        if (match) return { isValid: true, owner: match[1], repo: match[2] };
        return { isValid: false, error: 'Invalid GitHub URL format.' };
    }),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, hasToken: false }),
    storeToken: vi.fn().mockResolvedValue({ success: true }),
    clearToken: vi.fn().mockResolvedValue(undefined),
    getStoredToken: vi.fn().mockResolvedValue(null),
    TOKEN_SECURITY_INFO: {
        title: 'Your token is safe',
        points: ['Stored server-side only'],
        learnMoreUrl: 'https://example.com',
    },
}));

// ---------------------------------------------------------------------------
// Import actions AFTER mocks are registered
// ---------------------------------------------------------------------------
const { scanWebsite, crawlWebsite, scanGitHubRepo, saveGitHubToken } = await import('@/app/actions');

// ---------------------------------------------------------------------------
// scanWebsite
// ---------------------------------------------------------------------------
describe('scanWebsite — input validation', () => {
    it('returns an error when URL is missing', async () => {
        const formData = new FormData();
        const result = await scanWebsite(undefined, formData);
        expect(result).toMatchObject({ error: expect.stringContaining('valid URL') });
    });

    it('resolves successfully when a URL is provided', async () => {
        const formData = new FormData();
        formData.append('url', 'https://example.com');
        const result = await scanWebsite(undefined, formData);
        expect(result).toMatchObject({ success: true });
    });
});

// ---------------------------------------------------------------------------
// crawlWebsite
// ---------------------------------------------------------------------------
describe('crawlWebsite — input validation', () => {
    it('returns an error when URL is missing', async () => {
        const formData = new FormData();
        const result = await crawlWebsite(undefined, formData);
        expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('resolves successfully when a URL is provided', async () => {
        const formData = new FormData();
        formData.append('url', 'https://example.com');
        const result = await crawlWebsite(undefined, formData);
        expect(result).toMatchObject({ success: true });
    });
});

// ---------------------------------------------------------------------------
// scanGitHubRepo
// ---------------------------------------------------------------------------
describe('scanGitHubRepo — input validation', () => {
    it('returns an error when repoUrl is missing', async () => {
        const formData = new FormData();
        const result = await scanGitHubRepo(undefined, formData);
        expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('returns an error for an invalid GitHub URL', async () => {
        const formData = new FormData();
        formData.append('repoUrl', 'https://notgithubdotcom.example.com/owner/repo');
        const result = await scanGitHubRepo(undefined, formData);
        expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('resolves successfully for a valid GitHub URL', async () => {
        const formData = new FormData();
        formData.append('repoUrl', 'https://github.com/owner/repo');
        const result = await scanGitHubRepo(undefined, formData);
        expect(result).toMatchObject({ success: true });
    });
});

// ---------------------------------------------------------------------------
// saveGitHubToken
// ---------------------------------------------------------------------------
describe('saveGitHubToken — input validation', () => {
    it('returns an error when token is missing', async () => {
        const formData = new FormData();
        const result = await saveGitHubToken(undefined, formData);
        expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('resolves successfully when a token is provided', async () => {
        const formData = new FormData();
        formData.append('token', 'ghp_testtoken');
        const result = await saveGitHubToken(undefined, formData);
        expect(result).toMatchObject({ success: true });
    });
});

