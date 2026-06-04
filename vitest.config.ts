/// <reference types="vitest" />
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Faqat frontend testlari — backend'ning o'z vitest'i bor (@prisma/client
    // import'lari frontend muhitida resolve bo'lmaydi)
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "backend/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["node_modules", "dist", "src/test", "**/*.config.*", "src/data/**"],
    },
  },
});
