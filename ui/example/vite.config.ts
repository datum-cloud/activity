import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    remix({
      ssr: true,
    }),
  ],
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
    },
  },
  optimizeDeps: {
    exclude: ["@remix-run/react"],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
