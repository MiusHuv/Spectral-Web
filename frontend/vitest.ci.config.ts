import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
    },
    exclude: [
      "src/test/performance.test.tsx",
      "src/test/simple-performance.test.tsx",
      "src/test/virtual-scrolling-performance.test.tsx",
      "src/test/performance/**/*.test.tsx",
    ],
  },
});
