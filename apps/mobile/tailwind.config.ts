import type { Config } from "tailwindcss";
// A .ts config on purpose: the palette is imported from @ekonobar/shared so the
// phone and the web dashboard cannot drift. A .js config could not require a
// TypeScript module, and hard-coding the hex values here would recreate exactly
// the duplication the shared package exists to prevent.
import { colors, radius } from "@ekonobar/shared/design-tokens";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      // `font-sans` is the regular face. Weights are re-pointed at their real
      // Lexend families in global.css — see the note there.
      fontFamily: {
        sans: ["Lexend_400Regular"],
      },
    },
  },
  plugins: [],
} satisfies Config;
