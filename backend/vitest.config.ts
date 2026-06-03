import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Backend manbasi NodeNext uslubida ".js" kengaytma bilan import qiladi
    // (masalan "./audit.js"). Test paytida ularni ".ts" manbaga yo'naltiramiz.
    extensions: [".ts", ".js", ".json"],
  },
});
