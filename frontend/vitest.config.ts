import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `server-only` / `client-only` throw on import outside the RSC boundary, which
// breaks tests importing server modules. Alias them to a no-op stub for tests.
const serverOnlyStub = resolve(__dirname, "./test/server-only-stub.ts");

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": serverOnlyStub,
      "client-only": serverOnlyStub,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "app/api/**/*.{ts,tsx}",
        "app/dashboard/**/actions.ts",
        "app/dashboard/files/storage.ts",
        "lib/**/*.{ts,tsx}",
      ],
      exclude: [
        "lib/supabase/database.types.ts",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
      ],
      // These are honest whole-module baselines, including currently uncovered
      // production files. Raise them as coverage grows; never lower them to
      // make a change pass.
      thresholds: {
        statements: 24,
        branches: 23,
        functions: 18,
        lines: 25,
        "lib/calendar/ics.ts": {
          statements: 80,
          branches: 50,
          functions: 100,
          lines: 85,
        },
        "app/api/contact/route.ts": {
          statements: 90,
          branches: 85,
          functions: 100,
          lines: 90,
        },
      },
    },
  },
});
