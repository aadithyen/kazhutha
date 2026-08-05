export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const API_BASE = process.env.TURN_API_URL ?? "https://rtc.live.cloudflare.com";
const API_TOKEN = process.env.TURN_API_TOKEN;
const KEY_ID = process.env.TURN_KEY_ID;
const TTL_SECONDS = Number(process.env.TURN_CREDENTIAL_TTL ?? 86_400);

let cache: { servers: IceServer[]; refreshAt: number } | null = null;
let inflight: Promise<IceServer[]> | null = null;

/**
 * Generate short-lived ICE servers (STUN + TURN credentials) via the
 * Cloudflare Calls TURN API. Credentials are cached for half their TTL so
 * clients always receive at least TTL/2 of remaining validity. Returns null
 * when TURN is not configured or generation fails (clients then fall back to
 * their default STUN-only config).
 */
export async function generateIceServers(): Promise<IceServer[] | null> {
  if (!API_TOKEN || !KEY_ID) return null;
  if (cache && Date.now() < cache.refreshAt) return cache.servers;
  if (!inflight) {
    inflight = fetchFreshCredentials().finally(() => {
      inflight = null;
    });
  }
  try {
    return await inflight;
  } catch (err) {
    console.error("TURN credential generation failed:", err);
    // Serve stale credentials over nothing; they may still be valid.
    return cache?.servers ?? null;
  }
}

async function fetchFreshCredentials(): Promise<IceServer[]> {
  const res = await fetch(
    `${API_BASE}/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    },
  );
  if (!res.ok) {
    throw new Error(`Cloudflare TURN API responded ${res.status}`);
  }
  const body = (await res.json()) as { iceServers: IceServer | IceServer[] };
  const servers = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
  cache = { servers, refreshAt: Date.now() + (TTL_SECONDS * 1000) / 2 };
  return servers;
}
