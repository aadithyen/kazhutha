const SECRET_KEYS = /password|token|cookie|authorization|credential|secret|api[_-]?key|private[_-]?key/i;
const SDP_KEYS = /^(sdp|candidate)$/i;

/** Strip fields that must never leave the client or appear in logs. */
export function sanitizeTelemetryPayload<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SECRET_KEYS.test(key)) continue;
    if (SDP_KEYS.test(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeTelemetryPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Hash a source identifier in the browser using Web Crypto. */
export async function hashSource(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
