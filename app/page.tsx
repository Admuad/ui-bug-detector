'use client';

import { useState, useTransition, useEffect } from "react";
import { scanWebsite, crawlWebsite, scanGitHubRepo, getRateLimitStatus, clearGitHubToken } from "./actions";
import { ScanResult, CrawlResult } from "@/lib/detector/types";
import { ScanResults } from "@/components/ScanResults";
import { ScanProgressIndicator } from "@/components/ScanProgress";
import ClientOnly from '@/components/ClientOnly';
import { ThemeToggle } from "@/components/ThemeToggle";
import { GitHubTokenModal } from "@/components/GitHubTokenModal";
import { ScanForm } from "@/components/ScanForm";
import { RateLimitBanner } from "@/components/RateLimitBanner";
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
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

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
                    if ((response as { rateLimited?: boolean }).rateLimited) {
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

    const handleClearToken = async () => {
        await clearGitHubToken();
        const newInfo = await getRateLimitStatus();
        setRateLimitInfo(newInfo);
    };

    const isRateLimited = inputMode === 'github' && Boolean(rateLimitInfo && !rateLimitInfo.allowed && !rateLimitInfo.hasToken);

    return (
        <main className="flex-1 flex flex-col items-center px-4 py-8 sm:p-20 font-[family-name:var(--font-inter)] min-h-screen bg-white dark:bg-[#09090b] transition-colors duration-500">
            <ClientOnly>
                <div className="fixed top-6 right-6 z-50">
                    <ThemeToggle />
                </div>

                <div className={`max-w-4xl w-full flex flex-col items-center transition-all duration-700 ${result ? 'mt-4 sm:mt-8' : 'mt-16 sm:mt-[20vh]'}`}>
                    <div className={`text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12 transition-all duration-700 px-4 ${result ? 'scale-90 opacity-80' : ''}`}>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase relative inline-block text-black dark:text-white">
                            UI Bug Detector
                            <span className="absolute -top-2 -right-8 sm:-top-4 sm:-right-12 rotate-12 bg-brand text-black text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 font-mono font-bold border border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">Beta</span>
                        </h1>
                        <p className="text-base sm:text-xl text-gray-500 dark:text-gray-400 font-medium max-w-lg mx-auto">
                            Automated bug detection for vibecoders. Scan live sites or GitHub repos.
                        </p>
                    </div>

                    {inputMode === 'github' && rateLimitInfo && (
                        <RateLimitBanner
                            rateLimitInfo={rateLimitInfo}
                            onAddToken={() => setShowTokenModal(true)}
                            onRemoveToken={handleClearToken}
                        />
                    )}

                    <ScanForm
                        inputMode={inputMode}
                        url={url}
                        repoUrl={repoUrl}
                        isDeepScan={isDeepScan}
                        isPending={isPending}
                        scanStatus={scanStatus}
                        isRateLimited={isRateLimited}
                        onInputModeChange={setInputMode}
                        onUrlChange={setUrl}
                        onRepoUrlChange={setRepoUrl}
                        onDeepScanChange={setIsDeepScan}
                        onSubmit={handleScan}
                    />

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 font-medium animate-in slide-in-from-top-2 w-full max-w-2xl px-4 sm:px-0">
                            {error}
                        </div>
                    )}

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

                    <div className="mt-16 w-full flex justify-center">
                        {result && <ScanResults result={result} />}
                    </div>
                </div>

                <GitHubTokenModal
                    isOpen={showTokenModal}
                    rateLimitInfo={rateLimitInfo}
                    onClose={() => setShowTokenModal(false)}
                    onTokenSaved={setRateLimitInfo}
                    onError={setError}
                />
            </ClientOnly>
        </main>
    );
}
