import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for buffer and other Node.js builtins
      // Required for @pythnetwork/pyth-sui-js
      include: ["buffer"],
      globals: {
        Buffer: true,
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});











