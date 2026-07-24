import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Kazhutha",
        short_name: "Kazhutha",
        description: "Play Kazhutha (Donkey) card game with friends, no install required.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
