import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const spadeSource = readFileSync(join(root, "icons", "spade-cc0.svg"), "utf8");
const spadePathD = spadeSource.match(/d="([^"]+)"/)?.[1];
if (!spadePathD) throw new Error("Could not read spade path from icons/spade-cc0.svg");

const SPADE_CENTER = 36;

function spadeAt(x, y, scale) {
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(${-SPADE_CENTER} ${-SPADE_CENTER})"><path fill="#ffffff" d="${spadePathD}"/></g>`;
}

function buildIconSvg(size) {
  const radius = Math.round(size * 0.15625);
  const spade = spadeAt(size * 0.5, size * 0.5, (size * 0.62) / 72);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0a0a0a"/>
  ${spade}
</svg>
`;
}

const outputs = [
  { svg: "favicon.svg", size: 64 },
  { svg: "icon-192.svg", size: 192 },
  { svg: "icon-512.svg", size: 512 },
];

for (const { svg, size } of outputs) {
  const content = buildIconSvg(size);
  writeFileSync(join(root, svg), content);
  console.log(`wrote ${svg}`);
}

const pngSizes = [
  { input: "icon-192.svg", output: "icon-192.png", size: 192 },
  { input: "icon-512.svg", output: "icon-512.png", size: 512 },
  { input: "icon-512.svg", output: "apple-touch-icon.png", size: 180 },
];

for (const { input, output, size } of pngSizes) {
  const svg = readFileSync(join(root, input));
  await sharp(svg).resize(size, size).png().toFile(join(root, output));
  console.log(`wrote ${output}`);
}
