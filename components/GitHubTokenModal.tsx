'use client';

import { Shield, Key, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SecurityInfo {
    title: string;
    points: string[];
    learnMoreUrl: string;
}

interface GitHubTokenModalProps {
    tokenInput: string;
    onTokenChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
    tokenSaving: boolean;
    securityInfo?: SecurityInfo;
}

export function GitHubTokenModal({
    tokenInput,
    onTokenChange,
    onSave,
    onClose,
    tokenSaving,
    securityInfo,
}: GitHubTokenModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
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
                    <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {securityInfo && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 font-bold text-green-700 dark:text-green-400 mb-2">
                            <Shield size={16} />
                            {securityInfo.title}
                        </div>
                        <ul className="text-sm text-green-600 dark:text-green-500 space-y-1">
                            {securityInfo.points.map((point, i) => (
                                <li key={i}>{point}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => onTokenChange(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full p-4 border-2 border-black dark:border-gray-700 rounded-lg font-mono text-sm bg-transparent text-black dark:text-white placeholder:text-gray-400 mb-4"
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 border-2 border-black dark:border-gray-700 rounded-lg font-bold uppercase text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={tokenSaving || !tokenInput.trim()}
                        className="flex-1 py-3 px-4 bg-brand border-2 border-black rounded-lg font-bold uppercase text-sm hover:bg-brand-hover transition-colors disabled:opacity-50"
                    >
                        {tokenSaving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save Token'}
                    </button>
                </div>

                <a
                    href={securityInfo?.learnMoreUrl || 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-gray-500 hover:text-brand mt-4 underline"
                >
                    How to create a GitHub token →
                </a>
            </motion.div>
        </motion.div>
    );
}
