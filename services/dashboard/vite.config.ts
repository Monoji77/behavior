import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const analyticsApiUrl = environment.ANALYTICS_API_URL || "http://127.0.0.1:8081";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src")
      }
    },
    server: {
      proxy: {
        "/api": {
          target: analyticsApiUrl,
          changeOrigin: true
        }
      }
    }
  };
});
