function semverParts(version: string): number[] {
  const core = version.split("+")[0] ?? version;
  return core.split(".").map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Compare semver prefixes (text after `+` ignored). */
export function compareSemver(a: string, b: string): number {
  const left = semverParts(a);
  const right = semverParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Empty minVersion disables the gate. */
export function isClientVersionSupported(clientVersion: string, minVersion: string): boolean {
  if (!minVersion) return true;
  return compareSemver(clientVersion, minVersion) >= 0;
}
