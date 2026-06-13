import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  outDir: "dist",
  clean: true,
  minify: true,
  shims: true,
  copy: [
    {
      from: "src/openai/prompts/**/*.md",
      flatten: false,
    },
  ],
});
