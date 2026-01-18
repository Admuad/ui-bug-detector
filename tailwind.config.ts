import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                brand: {
                    DEFAULT: "#00C853", // Green
                    hover: "#00E676",
                },
                error: "#D50000",
                surface: "#F5F5F5",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
            },
        },
    },
    darkMode: "class",
    plugins: [require("tailwindcss-animate")],
};
export default config;
