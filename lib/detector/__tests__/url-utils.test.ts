import { describe, it, expect } from 'vitest';
import {
    normalizeUrl,
    isSameOrigin,
    shouldCrawl,
    getDisplayDomain,
    getRelativePath,
} from '../url-utils';

describe('normalizeUrl', () => {
    it('returns null for invalid URLs', () => {
        expect(normalizeUrl('not-a-url')).toBeNull();
    });

    it('lowercases the hostname', () => {
        expect(normalizeUrl('https://EXAMPLE.COM/path')).toBe('https://example.com/path');
    });

    it('removes trailing slash from non-root paths', () => {
        expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about');
    });

    it('preserves trailing slash for root path', () => {
        const result = normalizeUrl('https://example.com/');
        expect(result).toBe('https://example.com/');
    });

    it('removes URL fragments', () => {
        expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('removes default http port 80', () => {
        expect(normalizeUrl('http://example.com:80/path')).toBe('http://example.com/path');
    });

    it('removes default https port 443', () => {
        expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path');
    });

    it('sorts query parameters for consistent comparison', () => {
        const a = normalizeUrl('https://example.com/?b=2&a=1');
        const b = normalizeUrl('https://example.com/?a=1&b=2');
        expect(a).toBe(b);
    });

    it('resolves relative URLs against a base origin', () => {
        const result = normalizeUrl('/about', 'https://example.com');
        expect(result).toBe('https://example.com/about');
    });
});

describe('isSameOrigin', () => {
    it('returns true for same-origin URLs', () => {
        expect(isSameOrigin('https://example.com/page', 'https://example.com')).toBe(true);
    });

    it('returns false for cross-origin URLs', () => {
        expect(isSameOrigin('https://other.com/page', 'https://example.com')).toBe(false);
    });

    it('returns false for invalid base origin', () => {
        expect(isSameOrigin('https://example.com/page', 'not-a-url')).toBe(false);
    });
});

describe('shouldCrawl', () => {
    const base = 'https://example.com';

    it('returns true for a crawlable page', () => {
        expect(shouldCrawl('https://example.com/about', base)).toBe(true);
    });

    it('returns false for cross-origin URLs', () => {
        expect(shouldCrawl('https://other.com/page', base)).toBe(false);
    });

    it('returns false for image files', () => {
        expect(shouldCrawl('https://example.com/image.png', base)).toBe(false);
    });

    it('returns false for JS files', () => {
        expect(shouldCrawl('https://example.com/bundle.js', base)).toBe(false);
    });

    it('returns false for API paths', () => {
        expect(shouldCrawl('https://example.com/api/users', base)).toBe(false);
    });

    it('returns false for _next paths', () => {
        expect(shouldCrawl('https://example.com/_next/static/chunk.js', base)).toBe(false);
    });
});

describe('getDisplayDomain', () => {
    it('strips www prefix', () => {
        expect(getDisplayDomain('https://www.example.com/page')).toBe('example.com');
    });

    it('returns hostname for non-www domains', () => {
        expect(getDisplayDomain('https://example.com/page')).toBe('example.com');
    });

    it('returns original string for invalid URLs', () => {
        expect(getDisplayDomain('not-a-url')).toBe('not-a-url');
    });
});

describe('getRelativePath', () => {
    it('returns pathname + search', () => {
        expect(getRelativePath('https://example.com/about?ref=nav')).toBe('/about?ref=nav');
    });

    it('returns just pathname when no query string', () => {
        expect(getRelativePath('https://example.com/about')).toBe('/about');
    });

    it('returns original string for invalid URLs', () => {
        expect(getRelativePath('not-a-url')).toBe('not-a-url');
    });
});
