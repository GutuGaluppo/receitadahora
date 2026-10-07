import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/client",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../../dist/client", emptyOutDir: true },
  // o front conversa com o Worker local (wrangler dev) na 8788
  server: { port: 5174, proxy: { "/api": "http://localhost:8788" } },
});
