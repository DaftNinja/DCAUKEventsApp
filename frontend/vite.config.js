import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// [FIX P1] Proxy port corrected from 5000 → 8080 to match src/index.js default.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
