"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="w-14 h-8 bg-gray-200 rounded-full" /> // Placeholder to prevent layout shift
    }

    const isDark = resolvedTheme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`relative w-16 h-9 rounded-full px-1 transition-colors duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand
        ${isDark ? "bg-[#1a1a1a] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]" : "bg-gray-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"}
      `}
            aria-label="Toggle Dark Mode"
        >
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className={`flex items-center justify-center w-7 h-7 rounded-full shadow-md z-10
            ${isDark ? "bg-[#09090b] text-brand" : "bg-white text-yellow-500"}
        `}
                style={{
                    translateX: isDark ? 28 : 0 // 64px width - 4px padding - 28px circle = ~32px travel
                }}
            >
                <motion.div
                    initial={false}
                    animate={{ rotate: isDark ? 0 : 180, scale: isDark ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ position: 'absolute' }}
                >
                    <Moon size={16} fill="currentColor" />
                </motion.div>

                <motion.div
                    initial={false}
                    animate={{ rotate: isDark ? -180 : 0, scale: isDark ? 0 : 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ position: 'absolute' }}
                >
                    <Sun size={16} fill="currentColor" />
                </motion.div>
            </motion.div>
        </button>
    )
}
