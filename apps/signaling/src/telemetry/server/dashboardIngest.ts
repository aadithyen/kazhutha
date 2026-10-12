import type { SecurityEvent, StructuredLog } from "../types.js";

const FLUSH_MS = 2000;
const MAX_BATCH = 40;

interface PendingEvent {
  source: string;
  kind: string;
  severity: "info" | "warn" | "error";
  roomCode?: string;
  peerId?: string;
  message?: string;
  detail?: string;
}

export function attachDashboardIngest(
  ingestUrl: string,
  apiKey: string,
  onLog: (handler: (entry: StructuredLog) => void) => void,
  onSecurity: (handler: (event: SecurityEvent) => void) => void,
): void {
  const queue: PendingEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (queue.length === 0) return;
    const batch = queue.splice(0, MAX_BATCH);
    void fetch(`${ingestUrl.replace(/\/$/, "")}/api/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-analytics-key": apiKey,
      },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
    }).catch(() => {
      // Best-effort; dropped events are acceptable for ops dashboard.
    });
    if (queue.length > 0) schedule();
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(flush, FLUSH_MS);
  };

  const enqueue = (ev: PendingEvent) => {
    queue.push(ev);
    if (queue.length >= MAX_BATCH) flush();
    else schedule();
  };

  onLog((entry) => {
    if (entry.level !== "warn" && entry.level !== "error" && !entry.security_event_type) return;
    enqueue({
      source: "signaling",
      kind: entry.security_event_type ?? (entry.level === "error" ? "log_error" : "log_warn"),
      severity: entry.level === "error" ? "error" : "warn",
      roomCode: typeof entry.room_code === "string" ? entry.room_code : entry.session_id,
      peerId: typeof entry.peer_id === "string" ? entry.peer_id : undefined,
      message: entry.message,
      detail: entry.error_message ? String(entry.error_message) : undefined,
    });
  });

  onSecurity((event) => {
    enqueue({
      source: "signaling",
      kind: event.security_event_type,
      severity: "warn",
      roomCode: event.session_id,
      peerId: event.peer_id,
      message: event.message,
      detail: event.detail,
    });
  });
}
