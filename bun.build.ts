import { BuildConfig } from "bun";

const config: BuildConfig = {
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  splitting: true,
  minify: {
    whitespace: true,
    identifiers: true,
    syntax: true,
  },
  sourcemap: "external",
  naming: {
    entry: "[name].[hash].js",
    chunk: "[name].[hash].js",
    asset: "[name].[hash].[ext]",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
  external: [],
};

export default config;
