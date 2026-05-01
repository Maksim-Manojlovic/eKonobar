// eKonobar Design Tokens

export const colors = {
  primary: {
    50:  "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",  // brand orange
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },
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
  surface: {
    light: "#fafaf8",
    warm:  "#fef3e8",
    dark:  "#1c1209",
    darker: "#2a1a08",
  },
  redAlert: "#ef4444",
} as const;

export const fonts = {
  sans: "var(--font-lexend)",
} as const;

export const radius = {
  sm:   "0.25rem",
  md:   "0.5rem",
  lg:   "0.75rem",
  xl:   "1rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  "4xl": "2rem",
  full: "9999px",
} as const;

export const shadow = {
  card:     "0 2px 8px rgba(0,0,0,0.08)",
  modal:    "0 8px 32px rgba(0,0,0,0.16)",
  orange:   "0 4px 20px rgba(249,115,22,0.32)",
  "orange-lg": "0 8px 40px rgba(249,115,22,0.30)",
} as const;
