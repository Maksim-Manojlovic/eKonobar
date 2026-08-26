/**
 * @ekonobar/shared — framework-free code imported by BOTH apps/web and apps/mobile.
 *
 * Rules for anything added here:
 *   1. No `next/*`, no `react-dom`, no Node built-ins (`fs`, `path`, `crypto`).
 *      React Native has none of them and Metro will fail the bundle.
 *   2. No runtime import of `@prisma/client`. Type-only imports are erased at
 *      compile time and are fine (`import type { Role } from "@prisma/client"`);
 *      runtime enum values are NOT — declare those here as `as const` objects and
 *      add a test asserting they match the Prisma enums.
 *   3. No Tailwind class strings. They mean nothing in React Native. Labels and
 *      other data live here; the class strings stay in apps/web.
 *
 * This package is consumed as TypeScript source (no build step). apps/web lists it
 * in `transpilePackages`; apps/mobile picks it up through the Metro workspace resolver.
 */

export const SHARED_PACKAGE_VERSION = "0.0.0";
