import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
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
      "/api": {
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
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: true,
      },
    },
  },
}));
