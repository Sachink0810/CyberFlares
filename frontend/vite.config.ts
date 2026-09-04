import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Simple config — no proxy. Frontend calls the API directly using
// VITE_API_URL (defaults to http://localhost:8000). CORS on the FastAPI
// side already whitelists http://localhost:5173.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
