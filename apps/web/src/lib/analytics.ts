const URL = (import.meta.env.VITE_ANALYTICS_URL as string | undefined)?.replace(/\/$/, "");
const KEY = import.meta.env.VITE_ANALYTICS_KEY as string | undefined;

export type ClientEventKind =
  | "signaling_disconnect"
  | "signaling_connected"
  | "webrtc_disconnect"
  | "webrtc_connected"
  | "ice_fetch_failed"
  | "client_error"
  | "game_phase"
  | "game_started"
  | "game_finished";

function enabled(): boolean {
  return Boolean(URL && KEY);
}

export function reportClientEvent(
  kind: ClientEventKind,
  severity: "info" | "warn" | "error",
  fields: { roomCode?: string; peerId?: string; message?: string; detail?: string } = {},
): void {
  if (!enabled()) return;
  const body = JSON.stringify({
    source: "web",
    kind,
    severity,
    roomCode: fields.roomCode,
    peerId: fields.peerId,
    message: fields.message,
    detail: fields.detail,
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(
        `${URL}/api/events?key=${encodeURIComponent(KEY!)}`,
        blob,
      );
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch(`${URL}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-analytics-key": KEY! },
    body,
    keepalive: true,
  }).catch(() => {});
}
