import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 90000,
    hookTimeout: 90000,
    teardownTimeout: 30000,
  },
});
