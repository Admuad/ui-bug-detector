'use client';

import { Globe, Github, Search, ArrowRight, Loader2 } from "lucide-react";

type InputMode = 'url' | 'github';

interface ScanFormProps {
    inputMode: InputMode;
    url: string;
    repoUrl: string;
    isDeepScan: boolean;
    isPending: boolean;
    scanStatus: string;
    isRateLimited: boolean;
    onInputModeChange: (mode: InputMode) => void;
    onUrlChange: (value: string) => void;
    onRepoUrlChange: (value: string) => void;
    onDeepScanChange: (value: boolean) => void;
    onSubmit: (e?: React.FormEvent) => void;
}

export function ScanForm({
    inputMode,
    url,
    repoUrl,
    isDeepScan,
    isPending,
    scanStatus,
    isRateLimited,
    onInputModeChange,
    onUrlChange,
    onRepoUrlChange,
    onDeepScanChange,
    onSubmit,
}: ScanFormProps) {
    return (
        <>
            <div className="flex items-center gap-1 sm:gap-2 mb-4 sm:mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                    onClick={() => onInputModeChange('url')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm uppercase tracking-wider transition-all ${inputMode === 'url'
                        ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                        }`}
                >
                    <Globe size={14} className="sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Website</span> URL
                </button>
                <button
                    onClick={() => onInputModeChange('github')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm uppercase tracking-wider transition-all ${inputMode === 'github'
                        ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                        }`}
                >
                    <Github size={14} className="sm:w-4 sm:h-4" />
                    GitHub
                </button>
            </div>

            <div className="w-full max-w-2xl relative group z-10 px-4 sm:px-0">
                <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <form
                    onSubmit={onSubmit}
                    className="relative bg-white dark:bg-[#18181b] border-2 border-black dark:border-gray-700 rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(40,40,40,1)] sm:dark:shadow-[8px_8px_0px_0px_rgba(40,40,40,1)] transition-all duration-300"
                >
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
                                onChange={(e) => onUrlChange(e.target.value)}
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
                                onChange={(e) => onRepoUrlChange(e.target.value)}
                                placeholder="user/repo"
                                className="flex-1 min-w-0 p-4 sm:p-6 outline-none text-base sm:text-xl font-mono placeholder:text-gray-300 bg-transparent text-black dark:text-white"
                                required
                            />
                        )}
                    </div>

                    {inputMode === 'url' && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-gray-700">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className={`relative w-11 h-6 rounded-full transition-colors ${isDeepScan ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isDeepScan}
                                        onChange={(e) => onDeepScanChange(e.target.checked)}
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

                    <button
                        type="submit"
                        disabled={isPending || isRateLimited}
                        className="w-full bg-brand hover:bg-brand-hover text-black px-6 py-4 sm:py-5 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <><span>{scanStatus || 'Scanning'}</span> <Loader2 className="animate-spin" size={20} /></>
                        ) : (
                            <>Scan <ArrowRight size={20} /></>
                        )}
                    </button>
                </form>
            </div>
        </>
    );
}
