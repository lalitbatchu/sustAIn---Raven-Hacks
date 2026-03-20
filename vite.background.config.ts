import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts")
      },
      output: {
        format: "es",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks(id) {
          if (
            id.includes("@huggingface/transformers") ||
            id.includes("onnxruntime") ||
            id.includes("js-tiktoken") ||
            id.includes(`${resolve(__dirname, "src/compression-lib")}`) ||
            id.includes(`${resolve(__dirname, "src/compression/runtime.ts")}`)
          ) {
            return "compression-runtime";
          }

          return undefined;
        }
      },
      treeshake: "recommended"
    }
  }
});
