import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite does not resolve the array export target packages/shared/package.json uses
// ("./x" -> src/x.ts OR src/x/index.ts), so point the workspace package straight
// at its source. Next.js resolves it correctly on its own via transpilePackages.
const alias = {
  "@ekonobar/shared": path.resolve(__dirname, "../../packages/shared/src"),
  "@":                path.resolve(__dirname, "./src"),
};
const sharedPlugins = [react()];

// Two projects:
//   unit        — existing *.test.{ts,tsx} files (mocked DB, no PostgreSQL needed)
//   integration — *.integration.test.ts files (real PostgreSQL, requires DATABASE_URL)
//
// Run selectively:
//   npm run test:unit          vitest run --project unit
//   npm run test:integration   vitest run --project integration
//   npm test                   vitest run  (both)
export default defineConfig({
  // The single .env lives at the monorepo root (see next.config.ts). Vitest loads
  // dotenv files from its own root by default, which is apps/web — without this
  // the integration project would start with no DATABASE_URL and fail in setup.ts.
  envDir: path.resolve(__dirname, "../.."),
  test: {
    projects: [
      {
        plugins: sharedPlugins,
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          globals: true,
          setupFiles: ["src/test-setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
          // Component tests declare: // @vitest-environment happy-dom
        },
      },
      {
        plugins: sharedPlugins,
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          setupFiles: ["src/test-setup.ts"],
          include: ["src/**/*.integration.test.ts"],
          exclude: ["node_modules/**"],
          globalSetup: ["src/tests/integration/setup.ts"],
          // forks pool: each test file runs in its own process for full DB isolation.
          // maxWorkers: 1 forces sequential file execution so resetDb() in one file
          // cannot truncate tables while another file's beforeEach is seeding data.
          pool: "forks",
          maxWorkers: 1,
          testTimeout: 15_000,
        },
      },
    ],
  },
});
