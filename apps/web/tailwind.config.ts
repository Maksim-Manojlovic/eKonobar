import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand — orange
        orange: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Warm neutrals
        neutral: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },
        // Surfaces
        cream: {
          50:  "#fafaf8",
          100: "#f5f4f0",
          200: "#ebe9dd",
        },
        // Dark section bg
        dark: {
          900: "#1c1209",
          800: "#2a1a08",
          700: "#2d1a06",
        },
        // Legacy — keep for existing components
        terracotta: {
          50:  "#fdf4f0",
          400: "#e07a5f",
          500: "#c9604a",
          600: "#a84a36",
        },
        "red-alert": "#ef4444",
      },
      fontFamily: {
        sans:   ["var(--font-lexend)", "system-ui", "sans-serif"],
        lexend: ["var(--font-lexend)", "system-ui", "sans-serif"],
        // legacy
        display: ["var(--font-lexend)", "system-ui", "sans-serif"],
        body:    ["var(--font-lexend)", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card:    "0 2px 8px rgba(0,0,0,0.08)",
        modal:   "0 8px 32px rgba(0,0,0,0.16)",
        orange:  "0 4px 20px rgba(249,115,22,0.32)",
        "orange-lg": "0 8px 40px rgba(249,115,22,0.30)",
      },
      animation: {
        "float":      "float 4s ease-in-out infinite",
        "blink":      "blink 1.5s ease-in-out infinite",
        "ping-slow":  "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "marker-in":  "markerIn 0.3s cubic-bezier(.34,1.56,.64,1) both",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-7px)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.3" },
        },
        markerIn: {
          from: { transform: "scale(0.5)", opacity: "0" },
          to:   { transform: "scale(1)",   opacity: "1" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
