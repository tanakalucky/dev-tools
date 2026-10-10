import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["features/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
  },
});
