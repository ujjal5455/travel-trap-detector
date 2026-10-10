// Renders the PWA icons from public/icons/icon.svg. Run after changing the SVG:
//   node scripts/generate-icons.mjs
// sharp ships with Next.js, so nothing extra to install.
import { readFileSync } from "node:fs";
import sharp from "sharp";

const dir = new URL("../public/icons/", import.meta.url);
const svg = readFileSync(new URL("icon.svg", dir));

// Maskable icons must keep their content inside the central 80% "safe zone":
// full-bleed background, artwork scaled down.
const maskable = Buffer.from(
  svg
    .toString()
    .replace('rx="112"', 'rx="0"')
    .replace(/<path /g, '<path transform="translate(51.2 51.2) scale(0.8)" '),
);

const outputs = [
  { file: "icon-192.png", src: svg, size: 192 },
  { file: "icon-512.png", src: svg, size: 512 },
  { file: "maskable-512.png", src: maskable, size: 512 },
  { file: "apple-touch-icon.png", src: maskable, size: 180 },
];

for (const { file, src, size } of outputs) {
  await sharp(src, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(new URL(file, dir).pathname.replace(/^\/([A-Z]:)/, "$1"));
  console.log(`wrote public/icons/${file} (${size}×${size})`);
}
