import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

async function buildCSS() {
  const cssPath = join(process.cwd(), "src", "index.css");
  const outputPath = join(process.cwd(), "src", "index.processed.css");
  
  const css = readFileSync(cssPath, "utf-8");
  
  const result = await postcss([tailwindcss]).process(css, {
    from: cssPath,
    to: outputPath,
  });
  
  writeFileSync(outputPath, result.css);
  console.log("CSS processed successfully");
}

buildCSS().catch(console.error);
