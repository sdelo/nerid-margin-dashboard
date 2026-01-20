#!/usr/bin/env bun

import { $ } from "bun";
import * as fs from "fs";
import * as path from "path";

console.log("🏗️  Building DeepBook Dashboard...\n");

// Step 1: Build CSS
console.log("1️⃣  Building CSS...");
await $`bun scripts/build-css.ts`;
console.log("✅ CSS built\n");

// Step 2: Build JS with Bun
console.log("2️⃣  Building JavaScript...");
const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  naming: "[name].[ext]",
  minify: false,
  sourcemap: "external",
  target: "browser",
  format: "esm",
  splitting: true, // Re-enable splitting but with external modules
  external: [], // Let Bun bundle everything but handle it better
  loader: {
    ".svg": "file",
  },
});

if (!result.success) {
  console.error("❌ Build failed:", result.logs);
  process.exit(1);
}
console.log("✅ JavaScript built\n");

// Step 3: Copy static assets
console.log("3️⃣  Copying static assets...");
const publicDir = "./public";
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    fs.copyFileSync(
      path.join(publicDir, file),
      path.join("./dist", file)
    );
  }
  console.log(`✅ Copied ${files.length} file(s) from public/\n`);
}

// Step 4: Process and copy index.html
console.log("4️⃣  Processing index.html...");
let html = fs.readFileSync("./index.html", "utf-8");

// Update favicon to use the hashed version
const distFiles = fs.readdirSync("./dist");
const divingHelmetFile = distFiles.find((f) => f.startsWith("diving-helment-"));
if (divingHelmetFile) {
  html = html.replace(
    /href="\/src\/assets\/diving-helment\.svg"/,
    `href="/${divingHelmetFile}"`
  );
}

// Update script tag to use the built main.js
html = html.replace(
  /<script type="module" src="\/src\/main\.tsx"><\/script>/,
  '<script type="module" src="/main.js"></script>'
);

// Write processed HTML
fs.writeFileSync("./dist/index.html", html);
console.log("✅ index.html processed\n");

// Step 5: Fix Bun bundler bug with __toESM
console.log("5️⃣  Patching Bun bundler issues...");
let mainJs = fs.readFileSync("./dist/main.js", "utf-8");
// Fix broken __toESM(, 1) patterns
mainJs = mainJs.replace(/__toESM\(,\s*1\)/g, "__toESM(require_esm2(), 1)");
fs.writeFileSync("./dist/main.js", mainJs);
console.log("✅ Patched bundler issues\n");

console.log("🎉 Build complete! Output: ./dist/\n");

