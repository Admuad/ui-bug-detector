'use client';

import { useState, useTransition, useEffect } from "react";
import { ArrowRight, Search, Loader2, Github, Globe, Key, Shield, X, Check, Clock } from "lucide-react";
import { scanWebsite, crawlWebsite, scanGitHubRepo, saveGitHubToken, getRateLimitStatus, clearGitHubToken } from "./actions";
import { ScanResult, CrawlResult } from "@/lib/detector/types";
import { ScanResults } from "@/components/ScanResults";
import { ScanProgressIndicator } from "@/components/ScanProgress";
import ClientOnly from '@/components/ClientOnly';
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";

type InputMode = 'url' | 'github';

interface RateLimitInfo {
    allowed: boolean;
    hasToken: boolean;
    remainingTime?: number;
    message?: string;
    securityInfo?: {
        title: string;
        points: string[];
        learnMoreUrl: string;
    };
}

export default function Home() {
    const [inputMode, setInputMode] = useState<InputMode>('url');
    const [url, setUrl] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [isDeepScan, setIsDeepScan] = useState(false);
    const [result, setResult] = useState<ScanResult | CrawlResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [scanStatus, setScanStatus] = useState<string>("");

    // GitHub token state
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [tokenInput, setTokenInput] = useState("");
    const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
    const [tokenSaving, setTokenSaving] = useState(false);

    // Fetch rate limit status on mount and mode change
    useEffect(() => {
        if (inputMode === 'github') {
            getRateLimitStatus().then(setRateLimitInfo);
        }
    }, [inputMode]);

    const handleScan = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (inputMode === 'url' && !url) return;
        if (inputMode === 'github' && !repoUrl) return;

        setError(null);
        setResult(null);

        startTransition(async () => {
            const formData = new FormData();

            if (inputMode === 'github') {
                setScanStatus("Validating repository...");
                formData.append('repoUrl', repoUrl);

                setScanStatus("Downloading repository...");
                const response = await scanGitHubRepo(null, formData);

                if (response.error) {
                    setError(response.error);
                    if ((response as any).rateLimited) {
                        setShowTokenModal(true);
                    }
                } else if (response.data) {
                    setResult(response.data);
                }
                setScanStatus("");
            } else {
                formData.append('url', url);

                let response;
                if (isDeepScan) {
                    setScanStatus("Crawling website...");
                    response = await crawlWebsite(null, formData);
                } else {
                    setScanStatus("Scanning page...");
                    response = await scanWebsite(null, formData);
                }

                if (response.error) {
                    setError(response.error);
                } else if (response.data) {
                    setResult(response.data);
                }
                setScanStatus("");
            }
        });
    };

    const handleSaveToken = async () => {
        if (!tokenInput.trim()) return;
        setTokenSaving(true);

        const formData = new FormData();
        formData.append('token', tokenInput);

        const response = await saveGitHubToken(null, formData);

        if (response.success) {
            setShowTokenModal(false);
            setTokenInput("");
            // Refresh rate limit info
            const newInfo = await getRateLimitStatus();
            setRateLimitInfo(newInfo);
        } else {
            setError(response.error || 'Failed to save token');
        }
        setTokenSaving(false);
    };

    const handleClearToken = async () => {
        await clearGitHubToken();
        const newInfo = await getRateLimitStatus();
        setRateLimitInfo(newInfo);
    };

    const formatRemainingTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <main className="flex-1 flex flex-col items-center px-4 py-8 sm:p-20 font-[family-name:var(--font-inter)] min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-500">
            <ClientOnly>
                {/* Theme Toggle */}
                <div className="fixed top-6 right-6 z-50">
                    <ThemeToggle />
                </div>

                <div className={`max-w-4xl w-full flex flex-col items-center transition-all duration-700 ${result ? 'mt-4 sm:mt-8' : 'mt-16 sm:mt-[20vh]'}`}>
                    {/* Header Section */}
                    <div className={`text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12 transition-all duration-700 px-4 ${result ? 'scale-90 opacity-80' : ''}`}>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase relative inline-block text-black dark:text-white">
                            UI Bug Detector
                            <span className="absolute -top-2 -right-8 sm:-top-4 sm:-right-12 rotate-12 bg-brand text-black text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono font-bold border border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">Beta</span>
                        </h1>
                        <p className="text-base sm:text-xl text-gray-500 dark:text-gray-400 font-medium max-w-lg mx-auto">
                            Automated bug detection for vibecoders. Scan live sites or GitHub repos.
                        </p>
                    </div>

                    {/* Input Mode Toggle */}
                    <div className="flex items-center gap-1 sm:gap-2 mb-4 sm:mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <button
                            onClick={() => setInputMode('url')}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm uppercase tracking-wider transition-all ${inputMode === 'url'
                                ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                                }`}
                        >
                            <Globe size={14} className="sm:w-4 sm:h-4" />
                            <span className="hidden xs:inline">Website</span> URL
                        </button>
                        <button
                            onClick={() => setInputMode('github')}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm uppercase tracking-wider transition-all ${inputMode === 'github'
                                ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                                }`}
                        >
                            <Github size={14} className="sm:w-4 sm:h-4" />
                            GitHub
                        </button>
                    </div>

                    {/* GitHub Rate Limit Info */}
                    {inputMode === 'github' && rateLimitInfo && (
                        <div className="w-full max-w-2xl mb-4">
                            <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${rateLimitInfo.hasToken
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                : rateLimitInfo.allowed
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                }`}>
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
                                    onClick={() => rateLimitInfo.hasToken ? handleClearToken() : setShowTokenModal(true)}
                                    className="flex items-center gap-1 text-xs font-bold uppercase underline-offset-2 hover:underline"
                                >
                                    <Key size={12} />
                                    {rateLimitInfo.hasToken ? 'Remove Token' : 'Add Token'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Input Section */}
                    <div className="w-full max-w-2xl relative group z-10 px-4 sm:px-0">
                        <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <form
                            onSubmit={handleScan}
                            className="relative bg-white dark:bg-[#18181b] border-2 border-black dark:border-gray-700 rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(40,40,40,1)] sm:dark:shadow-[8px_8px_0px_0px_rgba(40,40,40,1)] transition-all duration-300"
                        >
                            {/* Input Row */}
                            <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
                                <div className="pl-4 sm:pl-6 text-gray-400 flex-shrink-0">
                                    {inputMode === 'github' ? <Github size={20} /> : <Search size={20} />}
                                </div>

                                {inputMode === 'url' ? (
                                    <input
                                        type="url"
                                        name="url"
                                        id="url-input"
                                        aria-label="Website URL to scan"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://example.com"
                                        className="flex-1 min-w-0 p-4 sm:p-6 outline-none text-base sm:text-xl font-mono placeholder:text-gray-300 bg-transparent text-black dark:text-white"
                                        required
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        name="repoUrl"
                                        id="repo-url-input"
                                        aria-label="GitHub repository URL to scan"
                                        value={repoUrl}
                                        onChange={(e) => setRepoUrl(e.target.value)}
                                        placeholder="user/repo"
                                        className="flex-1 min-w-0 p-4 sm:p-6 outline-none text-base sm:text-xl font-mono placeholder:text-gray-300 bg-transparent text-black dark:text-white"
                                        required
                                    />
                                )}
                            </div>

                            {/* Options Row (URL mode only) */}
                            {inputMode === 'url' && (
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <div className={`relative w-11 h-6 rounded-full transition-colors ${isDeepScan ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                            <input
                                                type="checkbox"
                                                checked={isDeepScan}
                                                onChange={(e) => setIsDeepScan(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDeepScan ? 'translate-x-5' : ''}`} />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                                            Deep Scan
                                        </span>
                                    </label>
                                    <span className="text-xs text-gray-400">
                                        {isDeepScan ? 'Multi-page crawl' : 'Single page'}
                                    </span>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isPending || Boolean(inputMode === 'github' && rateLimitInfo && !rateLimitInfo.allowed && !rateLimitInfo.hasToken)}
                                className="w-full bg-brand hover:bg-brand-hover text-black px-6 py-4 sm:py-5 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? (
                                    <><span>{scanStatus || 'Scanning'}</span> <Loader2 className="animate-spin" size={20} /></>
                                ) : (
                                    <>Scan <ArrowRight size={20} /></>
                                )}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 font-medium animate-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Progress Indicator during scan */}
                    <AnimatePresence mode="wait">
                        {isPending && !result && (
                            <motion.div
                                key="progress"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="mt-12 w-full flex justify-center"
                            >
                                <ScanProgressIndicator
                                    isScanning={isPending}
                                    isDeepScan={isDeepScan}
                                    status={scanStatus}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Results Section */}
                    <div className="mt-16 w-full flex justify-center">
                        {result && <ScanResults result={result} />}
                    </div>
                </div>

                {/* Token Modal */}
                <AnimatePresence>
                    {showTokenModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                            onClick={() => setShowTokenModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-gray-900 rounded-xl border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(40,40,40,1)] max-w-md w-full p-6"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
                                        <Key size={20} />
                                        Add GitHub Token
                                    </h2>
                                    <button onClick={() => setShowTokenModal(false)} className="text-gray-500 hover:text-black dark:hover:text-white">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Security Info */}
                                {rateLimitInfo?.securityInfo && (
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                                        <div className="flex items-center gap-2 font-bold text-green-700 dark:text-green-400 mb-2">
                                            <Shield size={16} />
                                            {rateLimitInfo.securityInfo.title}
                                        </div>
                                        <ul className="text-sm text-green-600 dark:text-green-500 space-y-1">
                                            {rateLimitInfo.securityInfo.points.map((point, i) => (
                                                <li key={i}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <input
                                    type="password"
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                    className="w-full p-4 border-2 border-black dark:border-gray-700 rounded-lg font-mono text-sm bg-transparent text-black dark:text-white placeholder:text-gray-400 mb-4"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowTokenModal(false)}
                                        className="flex-1 py-3 px-4 border-2 border-black dark:border-gray-700 rounded-lg font-bold uppercase text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveToken}
                                        disabled={tokenSaving || !tokenInput.trim()}
                                        className="flex-1 py-3 px-4 bg-brand border-2 border-black rounded-lg font-bold uppercase text-sm hover:bg-brand-hover transition-colors disabled:opacity-50"
                                    >
                                        {tokenSaving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save Token'}
                                    </button>
                                </div>

                                <a
                                    href={rateLimitInfo?.securityInfo?.learnMoreUrl || 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center text-sm text-gray-500 hover:text-brand mt-4 underline"
                                >
                                    How to create a GitHub token →
                                </a>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </ClientOnly>
        </main>
    );
}
