import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VITE_SINGLE_FILE=true → bitta HTML faylga inline (GitHub Pages, simple deploy)
// Default: code splitting bilan standart Vite build (Docker/nginx, Contabo VPS)
const useSingleFile = process.env.VITE_SINGLE_FILE === "true";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), ...(useSingleFile ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: useSingleFile
      ? undefined
      : {
          output: {
            manualChunks: {
              "react-vendor": ["react", "react-dom"],
              "recharts-vendor": ["recharts"],
              "framer-vendor": ["framer-motion"],
              "icons-vendor": ["lucide-react"],
              "utils-vendor": ["clsx", "tailwind-merge"],
            },
            chunkFileNames: "assets/[name]-[hash].js",
            entryFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash].[ext]",
          },
        },
  },
});
