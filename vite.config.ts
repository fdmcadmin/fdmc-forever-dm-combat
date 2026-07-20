import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        main: "index.html",
        actorPopout: "actor-popout.html",
        levelupPopout: "levelup-popout.html",
        dmPanel: "dm-panel.html",
        monsterPopout: "monster-popout.html",
        combatWindow: "combat-window.html",
        background: "background.html",
      },
      output: {
        // Stable filenames — prevents OBR re-verify on every deploy
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5173,
    strictPort: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 4173,
    strictPort: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  },
});
