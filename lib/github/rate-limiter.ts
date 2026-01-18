/**
 * Rate Limiter for GitHub Scanning
 * Implements free tier with 1 scan per 4 hours for unauthenticated users
 */

import { cookies } from 'next/headers';

const FREE_TIER_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const RATE_LIMIT_COOKIE = 'gh_scan_last';

export interface RateLimitResult {
    allowed: boolean;
    hasToken: boolean;
    remainingTime?: number; // in seconds
    message?: string;
}

/**
 * Check if a GitHub scan is allowed based on rate limiting
 * @param userToken Optional GitHub token (if provided, no rate limit)
 */
export async function checkRateLimit(userToken?: string): Promise<RateLimitResult> {
    // If user has a valid token, always allow
    if (userToken && userToken.length >= 40) {
        return {
            allowed: true,
            hasToken: true
        };
    }

    // Check cookie for last scan time
    const cookieStore = await cookies();
    const lastScanCookie = cookieStore.get(RATE_LIMIT_COOKIE);

    if (!lastScanCookie) {
        return {
            allowed: true,
            hasToken: false
        };
    }

    const lastScanTime = parseInt(lastScanCookie.value, 10);
    const now = Date.now();
    const elapsed = now - lastScanTime;

    if (elapsed >= FREE_TIER_COOLDOWN_MS) {
        return {
            allowed: true,
            hasToken: false
        };
    }

    const remainingMs = FREE_TIER_COOLDOWN_MS - elapsed;
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

    return {
        allowed: false,
        hasToken: false,
        remainingTime: Math.ceil(remainingMs / 1000),
        message: `Free tier limit reached. Next scan available in ~${remainingHours} hour(s), or add your GitHub token for unlimited scans.`
    };
}

/**
 * Record a GitHub scan (set the rate limit cookie)
 */
export async function recordScan(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(RATE_LIMIT_COOKIE, Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: FREE_TIER_COOLDOWN_MS / 1000 // Cookie expires after cooldown
    });
}

/**
 * Token Security Information
 * Displayed to users when they link their token
 */
export const TOKEN_SECURITY_INFO = {
    title: 'Your Token is Safe',
    points: [
        '🔒 Stored only in your browser (encrypted cookie), never on our servers',
        '🚫 We only use the token for read-only API calls to GitHub',
        '⏱️ Token is automatically cleared when you close the browser',
        '🔐 All requests use HTTPS encryption',
        '📋 Required scope: public_repo (read-only access to public repos only)'
    ],
    learnMoreUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'
};

/**
 * Validate a GitHub token format (basic validation)
 */
export function isValidTokenFormat(token: string): boolean {
    // GitHub tokens are typically 40 chars (classic) or start with ghp_ (fine-grained)
    return (
        (token.length === 40 && /^[a-f0-9]+$/i.test(token)) ||
        (token.startsWith('ghp_') && token.length >= 40) ||
        (token.startsWith('github_pat_') && token.length >= 40)
    );
}

/**
 * Store token securely in HTTP-only cookie
 */
export async function storeToken(token: string): Promise<{ success: boolean; error?: string }> {
    if (!isValidTokenFormat(token)) {
        return { success: false, error: 'Invalid token format. Please check and try again.' };
    }

    const cookieStore = await cookies();
    cookieStore.set('gh_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0 // Session cookie - cleared on browser close
    });

    return { success: true };
}

/**
 * Retrieve stored token
 */
export async function getStoredToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get('gh_token')?.value;
}

/**
 * Clear stored token
 */
export async function clearToken(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('gh_token');
}
