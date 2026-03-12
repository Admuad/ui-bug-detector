'use client';

import { Shield, Key, Check, Clock } from "lucide-react";

interface SecurityInfo {
    title: string;
    points: string[];
    learnMoreUrl: string;
}

interface RateLimitInfo {
    allowed: boolean;
    hasToken: boolean;
    remainingTime?: number;
    message?: string;
    securityInfo?: SecurityInfo;
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

function getBannerClassName(rateLimitInfo: RateLimitInfo): string {
    if (rateLimitInfo.hasToken) {
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
    }
    if (rateLimitInfo.allowed) {
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
    }
    return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400';
}

export function RateLimitBanner({ rateLimitInfo, onAddToken, onRemoveToken }: RateLimitBannerProps) {
    return (
        <div className="w-full max-w-2xl mb-4">
            <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${getBannerClassName(rateLimitInfo)}`}>
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
