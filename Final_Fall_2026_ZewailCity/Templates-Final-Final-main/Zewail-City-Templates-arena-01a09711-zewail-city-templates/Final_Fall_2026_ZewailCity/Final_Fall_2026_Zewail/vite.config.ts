import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep JS and CSS as separate static assets instead of inlining the whole app
// into one HTML file. This enables parallel downloads and browser caching.
export default defineConfig(({ mode }) => ({
  server: { host: "0.0.0.0", port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 5173, strictPort: true, allowedHosts: true },
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: mode !== "admin",
    rollupOptions: {
      input: path.resolve(__dirname, mode === "admin" ? "admin.html" : "index.html"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
}));
