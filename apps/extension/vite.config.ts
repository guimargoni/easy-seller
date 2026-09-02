import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({plugins:[react()],build:{outDir:"dist",emptyOutDir:true,rollupOptions:{input:{content:resolve(import.meta.dirname,"src/content.tsx"),background:resolve(import.meta.dirname,"src/background.ts")},output:{entryFileNames:"[name].js",assetFileNames:"[name][extname]"}}}});
