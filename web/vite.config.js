import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  // Project Pages lives below /Phi5/. Locally, Vite handles this base too.
  base: "/Phi5/",
  server: { fs: { allow: [resolve(here, "..")] } },
  build: { outDir: resolve(here, "dist"), emptyOutDir: true, sourcemap: false }
});
