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
    // 配置和它的schema一起带走，dist单独部署时也能直接改json
    { from: "config.json" },
    { from: "config.schema.json" },
  ],
});
