import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: {
        default: "UI Bug Detector | Automated UI Quality Assurance",
        template: "%s | UI Bug Detector"
    },
    description: "Detect UI bugs, accessibility issues, and visual defects across your entire website. Powered by Playwright and axe-core for comprehensive automated testing.",
    keywords: ["UI testing", "bug detection", "accessibility", "WCAG", "visual testing", "QA automation", "website scanner"],
    authors: [{ name: "UI Bug Detector Team" }],
    creator: "UI Bug Detector",
    publisher: "UI Bug Detector",
    robots: "index, follow",
    openGraph: {
        type: "website",
        locale: "en_US",
        siteName: "UI Bug Detector",
        title: "UI Bug Detector | Automated UI Quality Assurance",
        description: "Detect UI bugs, accessibility issues, and visual defects across your entire website.",
    },
    twitter: {
        card: "summary_large_image",
        title: "UI Bug Detector",
        description: "Detect UI bugs, accessibility issues, and visual defects across your entire website.",
    },
    icons: {
        icon: "/icon.svg",
        shortcut: "/icon.svg",
        apple: "/icon.svg",
    },
    manifest: "/manifest.json",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${inter.variable} antialiased min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-black dark:text-white transition-colors duration-300`}
                suppressHydrationWarning
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    {children}
                    <Toaster richColors position="top-center" />
                </ThemeProvider>
            </body>
        </html>
    );
}
