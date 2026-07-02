// Rasterize the brand SVGs into PNG app icons. Run: npm run icons
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

const standard = await readFile(path.join(iconsDir, "icon.svg"));
const maskable = await readFile(path.join(iconsDir, "icon-maskable.svg"));

async function png(svg, size, outPath, background) {
  let img = sharp(svg, { density: 512 }).resize(size, size);
  if (background) img = img.flatten({ background });
  await img.png().toFile(outPath);
  console.log("wrote", path.relative(root, outPath));
}

// PWA icons
await png(standard, 192, path.join(iconsDir, "icon-192.png"));
await png(standard, 512, path.join(iconsDir, "icon-512.png"));
await png(maskable, 192, path.join(iconsDir, "icon-maskable-192.png"));
await png(maskable, 512, path.join(iconsDir, "icon-maskable-512.png"));

// Apple touch icon (opaque, iOS rounds it itself). app/ convention → auto-linked.
await png(maskable, 180, path.join(root, "app", "apple-icon.png"), "#173f2d");

// Favicon (Next serves app/icon.png as the browser tab icon)
await png(standard, 256, path.join(root, "app", "icon.png"));

console.log("done");
