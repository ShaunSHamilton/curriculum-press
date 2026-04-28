import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["server/**", "target/**"],
    },
    fs: {
      // Prevent Vite from serving files from the target directory
      strict: true,
      allow: ["."],
      exclude: ["target"],
    },
    proxy: {
      // Proxy API and auth routes to the Rust server (default port 8080).
      // This lets you run the real server while using Vite's HMR for client
      // changes. Adjust PORT env var if your backend runs on a different port.
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/api/, "/api"),
      },
      // Ping/health endpoint
      "/status": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      host: "127.0.0.1",
      // Keep the HMR port equal to Vite's port so connections are stable
      port: 1420,
    },
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // This is needed to avoid the following error:
        // dist/assets/index-BS2y5DZK.js   1,747.08 kB │ gzip: 576.15 kB
        // (!) Some chunks are larger than 500 kB after minification.
        advancedChunks: {
          groups: [
            {
              name: "react-vendor",
              test: /\/node_modules\/(react|react-dom)\//,
            },
            {
              name: "react-query",
              test: /\/node_modules\/@tanstack\/react-query\//,
            },
            {
              name: "react-router",
              test: /\/node_modules\/@tanstack\/react-router\//,
            },
            {
              name: "icons",
              test: /\/node_modules\/(lucide-react|react-icons)\//,
            },
          ],
        },
      },
    },
  },
}));
