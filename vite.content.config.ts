import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": "\"production\"",
    "process.env": "{}"
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.tsx"),
      name: "PromptEfficiencyContent",
      formats: ["iife"],
      fileName: () => "assets/content.js"
    },
    rollupOptions: {
      treeshake: "recommended"
    }
  }
});
