import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// `server-only` / `client-only` throw on import outside the RSC boundary, which
// breaks tests importing server modules. Alias them to a no-op stub for tests.
const serverOnlyStub = resolve(__dirname, "./test/server-only-stub.ts");

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
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
  },
});
