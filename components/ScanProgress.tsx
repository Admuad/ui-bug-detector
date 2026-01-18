'use client';

import { motion } from 'framer-motion';
import { Loader2, Globe, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface ScanProgress {
    status: 'idle' | 'initializing' | 'scanning' | 'analyzing' | 'complete' | 'error';
    message: string;
    currentPage?: string;
    pagesScanned?: number;
    totalPages?: number;
    currentCheck?: string;
}

const SCAN_PHASES = [
    { id: 'init', label: 'Initializing browser', icon: '🔧' },
    { id: 'navigate', label: 'Loading page', icon: '🌐' },
    { id: 'layout', label: 'Checking layout', icon: '📐' },
    { id: 'a11y', label: 'Accessibility audit', icon: '♿' },
    { id: 'visual', label: 'Visual inspection', icon: '👁️' },
    { id: 'typo', label: 'Spelling check', icon: '📝' },
    { id: 'nav', label: 'Navigation test', icon: '🔗' },
    { id: 'score', label: 'Calculating score', icon: '📊' },
];

export function ScanProgressIndicator({
    isScanning,
    isDeepScan,
    status
}: {
    isScanning: boolean;
    isDeepScan: boolean;
    status: string;
}) {
    const [currentPhase, setCurrentPhase] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Simulate phase progression during scan
    useEffect(() => {
        if (!isScanning) {
            setCurrentPhase(0);
            setElapsedTime(0);
            return;
        }

        // Timer for elapsed time
        const timer = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        // Phase progression (simulated - in production this would come from actual scan events)
        const phaseTimer = setInterval(() => {
            setCurrentPhase(prev => {
                if (prev >= SCAN_PHASES.length - 1) return prev;
                return prev + 1;
            });
        }, isDeepScan ? 4000 : 2500);

        return () => {
            clearInterval(timer);
            clearInterval(phaseTimer);
        };
    }, [isScanning, isDeepScan]);

    if (!isScanning) return null;

    const progress = ((currentPhase + 1) / SCAN_PHASES.length) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="bg-white dark:bg-[#18181b] border-2 border-black dark:border-zinc-700 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Loader2 className="w-6 h-6 animate-spin text-brand" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-black dark:text-white">
                                {isDeepScan ? 'Deep Scanning Website' : 'Scanning Page'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {status || 'Analyzing UI for issues...'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-black dark:text-white">
                            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Elapsed</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <motion.div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-brand to-brand-hover"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>

                {/* Phase Indicators */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {SCAN_PHASES.slice(0, 8).map((phase, i) => (
                        <div
                            key={phase.id}
                            className={`flex items-center gap-2 p-2 rounded-lg transition-all ${i < currentPhase
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                    : i === currentPhase
                                        ? 'bg-brand/10 dark:bg-brand/20 text-brand font-medium'
                                        : 'bg-gray-50 dark:bg-zinc-800/50 text-gray-400'
                                }`}
                        >
                            <span className="text-base">{phase.icon}</span>
                            <span className="text-xs truncate">{phase.label}</span>
                            {i < currentPhase && (
                                <CheckCircle className="w-3 h-3 ml-auto text-green-500" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Current Activity */}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                    <span>
                        {SCAN_PHASES[currentPhase]?.label || 'Processing...'}
                        {isDeepScan && currentPhase > 1 && ' (multi-page mode)'}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

// Priority Badge Component
export function PriorityBadge({ score }: { score: number }) {
    const getColor = () => {
        if (score >= 80) return 'bg-red-500 text-white';
        if (score >= 50) return 'bg-orange-500 text-white';
        if (score >= 30) return 'bg-yellow-500 text-black';
        return 'bg-gray-400 text-white';
    };

    const getLabel = () => {
        if (score >= 80) return 'Critical';
        if (score >= 50) return 'High';
        if (score >= 30) return 'Medium';
        return 'Low';
    };

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getColor()}`}>
            <span>P{score}</span>
            <span className="hidden sm:inline">• {getLabel()}</span>
        </div>
    );
}

// Suggested Fix Callout
export function SuggestedFixCallout({ fix, wcag }: { fix?: string; wcag?: string }) {
    if (!fix) return null;

    return (
        <div className="mt-3 p-3 bg-gradient-to-r from-brand/5 to-brand/10 dark:from-brand/10 dark:to-brand/20 border border-brand/20 rounded-lg">
            <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-brand mb-1">
                        Suggested Fix
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{fix}</p>
                    {wcag && (
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] font-mono bg-brand/20 text-brand px-1.5 py-0.5 rounded">
                                WCAG {wcag.split(' ')[0]}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
