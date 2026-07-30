import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function resolveGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const buildDate = new Date().toISOString();
const gitCommit = resolveGitCommit();
const appVersion = process.env.npm_package_version ?? "0.0.0";

function injectServiceWorkerBuildId() {
  return {
    name: "otui-sw-build-id",
    closeBundle() {
      const swPath = resolve(__dirname, "dist/sw.js");
      if (!existsSync(swPath)) return;
      const content = readFileSync(swPath, "utf8");
      writeFileSync(swPath, content.replaceAll("__OTUI_BUILD_ID__", gitCommit));
    },
  };
}

export default defineConfig({
  plugins: [react(), injectServiceWorkerBuildId()],
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8010",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lightweight-charts")) return "vendor-charts";
          if (id.includes("recharts")) return "vendor-recharts";
          if (id.includes("react-router")) return "vendor-router";
        },
      },
    },
  },
});
