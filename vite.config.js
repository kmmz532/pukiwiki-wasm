import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  server: {
    headers: {
      "Service-Worker-Allowed": "/",
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: resolve(root, "index.html"),
        cgiWorker: resolve(root, "src/cgi-worker.js"),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "cgiWorker" ? "cgi-worker.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
