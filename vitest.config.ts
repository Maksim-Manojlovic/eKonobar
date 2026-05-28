import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };
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
          // forks pool: each test file runs in its own process for full DB isolation
          // maxWorkers caps concurrency to avoid exhausting the Prisma connection pool
          pool: "forks",
          maxWorkers: 4,
          testTimeout: 15_000,
        },
      },
    ],
  },
});
