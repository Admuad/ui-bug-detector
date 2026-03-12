import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameOrigin, shouldCrawl } from '../url-utils';

describe('normalizeUrl', () => {
    it('returns null for an invalid URL', () => {
        expect(normalizeUrl('not a url')).toBeNull();
    });

    it('normalises a simple URL', () => {
        const result = normalizeUrl('https://Example.COM/path/');
        expect(result).toBe('https://example.com/path');
    });

    it('removes trailing slash from non-root paths', () => {
        expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about');
    });

    it('preserves the root path slash', () => {
        expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('removes URL fragments', () => {
        expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('removes default http port 80', () => {
        expect(normalizeUrl('http://example.com:80/page')).toBe('http://example.com/page');
    });

    it('removes default https port 443', () => {
        expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page');
    });

    it('sorts query parameters', () => {
        const result = normalizeUrl('https://example.com/?z=1&a=2');
        expect(result).toBe('https://example.com/?a=2&z=1');
    });

    it('resolves relative URLs against a base origin', () => {
        const result = normalizeUrl('/about', 'https://example.com');
        expect(result).toBe('https://example.com/about');
    });

    it('lowercases the hostname', () => {
        expect(normalizeUrl('https://EXAMPLE.COM/')).toBe('https://example.com/');
    });
});

describe('isSameOrigin', () => {
    it('returns true for same-origin URLs', () => {
        expect(isSameOrigin('https://example.com/page', 'https://example.com')).toBe(true);
    });

    it('returns false for cross-origin URLs', () => {
        expect(isSameOrigin('https://other.com/page', 'https://example.com')).toBe(false);
    });

    it('returns false for cross-protocol absolute URLs (e.g. javascript:)', () => {
        // javascript: protocol has origin "null" so it won't match https://example.com
        expect(isSameOrigin('javascript:void(0)', 'https://example.com')).toBe(false);
    });

    it('treats different protocols as different origins', () => {
        expect(isSameOrigin('http://example.com/', 'https://example.com')).toBe(false);
    });
});

describe('shouldCrawl', () => {
    it('returns false for cross-origin URLs', () => {
        expect(shouldCrawl('https://other.com/', 'https://example.com')).toBe(false);
    });

    it('returns false for image URLs', () => {
        expect(shouldCrawl('https://example.com/photo.jpg', 'https://example.com')).toBe(false);
    });

    it('returns false for CSS files', () => {
        expect(shouldCrawl('https://example.com/styles.css', 'https://example.com')).toBe(false);
    });

    it('returns false for _next asset paths', () => {
        expect(shouldCrawl('https://example.com/_next/static/chunk.js', 'https://example.com')).toBe(false);
    });

    it('returns false for /api/ paths', () => {
        expect(shouldCrawl('https://example.com/api/users', 'https://example.com')).toBe(false);
    });

    it('returns true for a normal same-origin page', () => {
        expect(shouldCrawl('https://example.com/about', 'https://example.com')).toBe(true);
    });

    it('respects excludedPathPatterns', () => {
        const result = shouldCrawl('https://example.com/private', 'https://example.com', {
            excludedPathPatterns: [/\/private/]
        });
        expect(result).toBe(false);
    });

    it('respects allowedPathPatterns — blocks non-matching paths', () => {
        const result = shouldCrawl('https://example.com/blog/post', 'https://example.com', {
            allowedPathPatterns: [/^\/docs/]
        });
        expect(result).toBe(false);
    });

    it('respects allowedPathPatterns — allows matching paths', () => {
        const result = shouldCrawl('https://example.com/docs/intro', 'https://example.com', {
            allowedPathPatterns: [/^\/docs/]
        });
        expect(result).toBe(true);
    });
});
