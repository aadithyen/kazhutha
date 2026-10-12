import type { DatabaseSync } from "node:sqlite";
import { insertSnapshot, type LiveRoomsPayload } from "./db.js";

export async function fetchSignalingLive(
  signalingUrl: string,
  apiKey: string,
): Promise<LiveRoomsPayload | null> {
  try {
    const res = await fetch(`${signalingUrl.replace(/\/$/, "")}/internal/stats`, {
      headers: { "x-dashboard-key": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as LiveRoomsPayload;
  } catch {
    return null;
  }
}

export function startSignalingPoller(
  db: DatabaseSync,
  signalingUrl: string,
  apiKey: string,
  intervalMs: number,
  onLive: (live: LiveRoomsPayload | null) => void,
): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const live = await fetchSignalingLive(signalingUrl, apiKey);
    onLive(live);
    if (live) insertSnapshot(db, live);
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
