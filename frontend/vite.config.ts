import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true },        // Docker bind-mount + Windows FS needs polling
    proxy: {
      "/api": { target: "http://api:8000", changeOrigin: true, rewrite: p => p.replace(/^\/api/, "") },
    },
  },
});
