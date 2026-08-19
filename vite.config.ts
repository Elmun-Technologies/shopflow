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
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
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
            // Function-form manualChunks — array-form react-dom'ni boshqa vendor
            // chunk'ga "yutib yuborardi" (recharts-vendor'ga react-dom tushib,
            // 395kb chunk eager yuklanardi). Bu yerda har paket aniq yo'naltiriladi.
            manualChunks(id) {
              if (!id.includes("node_modules")) return;
              // React yadrosi — recharts/framer'dan OLDIN da'vo qilinishi shart
              if (
                id.includes("/react-dom/") ||
                id.includes("/react/") ||
                id.includes("/react-is/") ||
                id.includes("/scheduler/") ||
                id.includes("react/jsx-runtime")
              ) return "react-vendor";
              // recharts + uning d3/victory bog'liqliklari
              if (
                id.includes("/recharts/") ||
                id.includes("/victory-vendor/") ||
                id.includes("/d3-") ||
                id.includes("/internmap/")
              ) return "recharts-vendor";
              if (id.includes("/framer-motion/")) return "framer-vendor";
              if (id.includes("/lucide-react/")) return "icons-vendor";
              if (id.includes("/clsx/") || id.includes("/tailwind-merge/")) return "utils-vendor";
            },
            chunkFileNames: "assets/[name]-[hash].js",
            entryFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash].[ext]",
          },
        },
  },
});
