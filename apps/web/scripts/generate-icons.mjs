import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const sizes = [
  { input: "icon-192.svg", output: "icon-192.png", size: 192 },
  { input: "icon-512.svg", output: "icon-512.png", size: 512 },
  { input: "icon-512.svg", output: "apple-touch-icon.png", size: 180 },
];

for (const { input, output, size } of sizes) {
  const svg = readFileSync(join(root, input));
  await sharp(svg).resize(size, size).png().toFile(join(root, output));
  console.log(`wrote ${output}`);
}
