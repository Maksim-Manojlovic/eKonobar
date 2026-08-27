import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const DBRAW_REQUIRED_GLOBS = [
  "src/app/api/admin/**",
  "src/lib/scoring/sync.ts",
  "src/lib/core/rate-limit.ts",
];

// Server code only. A bare `} catch {` here discards an error nobody will ever
// see — there is no browser console on the server, so the information is simply
// gone. CQ-I and CQ-S both swept `.catch(() => {})` and left this form untouched,
// which is how WhatsApp/SMS provider failures stayed silent through two "fixed"
// audits. `no-empty` does not cover it: these blocks contain statements.
// Binding the error (`catch (err)`) also re-arms no-unused-vars, so it has to be
// used. Deliberate discards stay legal with an eslint-disable + a reason.
const SERVER_GLOBS = ["src/lib/**/*.ts", "src/app/api/**/*.ts"];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: SERVER_GLOBS,
    ignores: ["**/__tests__/**", "**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CatchClause[param=null]",
          message:
            "Server-side catch must bind and handle the error: `catch (err) { logger.warn({ err }, \"...\") }`. If discarding it is deliberate, add an eslint-disable-next-line with the reason.",
        },
      ],
    },
  },
  {
    files: DBRAW_REQUIRED_GLOBS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/core/db",
              importNames: ["db"],
              message: "Admin/payment/scoring routes must use dbRaw (soft-delete filter bypassed). Import dbRaw instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
