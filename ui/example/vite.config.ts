import { vitePlugin as remix } from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    remix({
      ssr: true,
    }),
  ],
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
      // Point to library source for hot-reload during development
      "@miloapis/activity-ui": resolve(__dirname, "../src/index.ts"),
    },
  },
  ssr: {
    // Bundle the library for SSR instead of externalizing it
    noExternal: ["@miloapis/activity-ui"],
  },
  optimizeDeps: {
    exclude: ["@remix-run/react"],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
