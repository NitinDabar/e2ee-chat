import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: "**/*.{jsx,js}",
    }),
  ],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
    include: ["libsodium-wrappers"],
    exclude: [],
  },
  ssr: {
    noExternal: ["libsodium-wrappers"],
  },
  resolve: {
    alias: {},
  },
  server: {
    port: 3000,
    host: true, // Allow access from network
    proxy: {
      "/api": {
        // Default to localhost so the dev proxy doesn't try to resolve a
        // non-existent hostname (avoid ENOTFOUND). Use VITE_API_URL to override.
        target: process.env.VITE_API_URL || "http://localhost:5000",
        changeOrigin: true,
      }
    }
  }
});
