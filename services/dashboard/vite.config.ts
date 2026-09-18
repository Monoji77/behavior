import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const analyticsApiUrl = environment.ANALYTICS_API_URL || "http://127.0.0.1:8081";

  return {
    plugins: [react()],
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
