import { defineConfig } from "vite";

export default defineConfig({
  // Relative base path: the built dist/ works under any URL prefix
  // (file://, GitHub Pages project subpath, S3 prefix, ...).
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
