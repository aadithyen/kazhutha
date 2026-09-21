import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function resolveVersion() {
  if (process.env.VITE_APP_VERSION?.trim()) return process.env.VITE_APP_VERSION.trim();
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    return `${pkg.version}+${sha}`;
  } catch {
    return `${pkg.version}+dev`;
  }
}

const version = resolveVersion();
writeFileSync(join(root, "public/version.json"), `${JSON.stringify({ version }, null, 2)}\n`);
console.log(`Wrote public/version.json (${version})`);
