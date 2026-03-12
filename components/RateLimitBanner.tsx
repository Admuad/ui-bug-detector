'use client';

import { Shield, Check, Clock, Key } from "lucide-react";

interface RateLimitInfo {
    allowed: boolean;
    hasToken: boolean;
    remainingTime?: number;
    message?: string;
}

interface RateLimitBannerProps {
    rateLimitInfo: RateLimitInfo;
    onAddToken: () => void;
    onRemoveToken: () => void;
}

function formatRemainingTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function RateLimitBanner({ rateLimitInfo, onAddToken, onRemoveToken }: RateLimitBannerProps) {
    const bannerColor = rateLimitInfo.hasToken
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
        : rateLimitInfo.allowed
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400';

    return (
        <div className="w-full max-w-2xl mb-4">
            <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${bannerColor}`}>
                <div className="flex items-center gap-2">
                    {rateLimitInfo.hasToken ? (
                        <>
                            <Shield size={16} />
                            <span>Token linked — unlimited scans</span>
                        </>
                    ) : rateLimitInfo.allowed ? (
                        <>
                            <Check size={16} />
                            <span>Free scan available</span>
                        </>
                    ) : (
                        <>
                            <Clock size={16} />
                            <span>Next free scan in {formatRemainingTime(rateLimitInfo.remainingTime || 0)}</span>
                        </>
                    )}
                </div>
                <button
                    onClick={rateLimitInfo.hasToken ? onRemoveToken : onAddToken}
                    className="flex items-center gap-1 text-xs font-bold uppercase underline-offset-2 hover:underline"
                >
                    <Key size={12} />
                    {rateLimitInfo.hasToken ? 'Remove Token' : 'Add Token'}
                </button>
            </div>
        </div>
    );
}
