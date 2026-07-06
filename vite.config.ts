import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
// On GitHub Pages the app is served from https://<user>.github.io/clouddex/,
// so production builds need the "/clouddex/" base. Dev stays at "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/clouddex/" : "/",
  build: {
    rollupOptions: {
      output: {
        // Keep big, rarely-changing vendor code in its own chunks so app-code
        // edits don't invalidate ~1.9 MB of precached JS on every deploy.
        // The tfjs chunk stays lazy: it's only reachable via the dynamic
        // import of src/ml/model.ts.
        manualChunks(id: string) {
          if (id.includes("node_modules/@tensorflow/")) return "tfjs";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return "react";
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      // Cache the (potentially large) model files so the app works offline
      // after first load.
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        // jpg included so the Clouddex grid images work offline too.
        globPatterns: ["**/*.{js,css,html,png,svg,json,bin,jpg}"],
      },
      manifest: {
        name: "Clouddex — Cloud Pokedex",
        short_name: "Clouddex",
        description:
          "Take a photo of the sky and identify the cloud type. Collect all 10 cloud genera.",
        theme_color: "#0a1026",
        background_color: "#0a1026",
        display: "standalone",
        orientation: "portrait",
        // Relative so it resolves correctly under the "/clouddex/" base.
        start_url: ".",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
}));
