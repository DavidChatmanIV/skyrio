import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

/* ----------------------------------------
   ESM-safe __dirname
----------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ----------------------------------------
   Vite Config
----------------------------------------- */
export default defineConfig({
  plugins: [react()],

  /* ----------------------------------------
     Aliases (IMPORTANT for Vercel)
  ----------------------------------------- */
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // ✅ clean + correct
    },
  },

  /* ----------------------------------------
     Dev Server (LOCAL ONLY)
  ----------------------------------------- */
  server: {
    host: "localhost",
    port: 5273,
    strictPort: true,
    hmr: { overlay: false },

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  /* ----------------------------------------
     Production Build (Vercel)
  ----------------------------------------- */
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,

    // ✅ Silence large bundle warning (intentional for Skyrio)
    chunkSizeWarningLimit: 1200,
  },
});
