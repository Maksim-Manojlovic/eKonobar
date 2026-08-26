/**
 * @ekonobar/shared — framework-free code imported by BOTH apps/web and apps/mobile.
 *
 * Rules for anything added here:
 *   1. No `next/*`, no `react-dom`, no Node built-ins (`fs`, `path`, `crypto`).
 *      React Native has none of them and Metro will fail the bundle.
 *   2. No runtime import of `@prisma/client`. Type-only imports are erased at
 *      compile time and are fine (`import type { Role } from "@prisma/client"`);
 *      runtime enum values are NOT — they live in ./enums.ts as `as const`
 *      objects, with a test asserting they match the Prisma enums exactly.
 *   3. No Tailwind class strings. They mean nothing in React Native. Labels and
 *      other data live here; the `*_COLORS` maps stay in apps/web.
 *
 * Consumed as TypeScript source (no build step). apps/web lists it in
 * `transpilePackages`; apps/mobile picks it up through the Metro workspace resolver.
 *
 * Prefer deep imports (`@ekonobar/shared/geo/cities`) over this barrel in app
 * code — a barrel drags every module into the bundle whatever you asked for.
 * This file exists for discoverability and for consumers that want the surface.
 */

export * from "./enums";
export * from "./formatting/utils";
export * from "./formatting/labels";
export * from "./geo/cities";
export * from "./geo/municipalities";
export * from "./design-tokens";
