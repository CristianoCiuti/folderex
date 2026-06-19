import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [preact()],
  root: "src/client",
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    proxy: {
      "/__api": "http://localhost:3000",
      "/__ws": { target: "ws://localhost:3000", ws: true },
      "/__download": "http://localhost:3000",
    },
  },
});
