import { createHash } from "node:crypto";

/** Hash a source identifier (e.g. IP) for abuse tracking without storing raw values. */
export function hashSourceSync(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}
