import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type EventSeverity = "info" | "warn" | "error";

export interface IngestEvent {
  source: string;
  kind: string;
  severity: EventSeverity;
  roomCode?: string;
  peerId?: string;
  message?: string;
  detail?: string;
}

export interface LiveRoomsPayload {
  roomCount: number;
  playerCount: number;
  rooms: { code: string; playerCount: number; peers: { peerId: string; name: string }[] }[];
}

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      room_code TEXT,
      peer_id TEXT,
      message TEXT,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_kind_ts ON events(kind, ts);

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      room_count INTEGER NOT NULL,
      player_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts);
  `);
  return db;
}

export function insertEvent(db: DatabaseSync, ev: IngestEvent): void {
  db.prepare(
    `INSERT INTO events (ts, source, kind, severity, room_code, peer_id, message, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    new Date().toISOString(),
    ev.source,
    ev.kind,
    ev.severity,
    ev.roomCode ?? null,
    ev.peerId ?? null,
    ev.message ?? null,
    ev.detail ?? null,
  );
}

export function insertSnapshot(db: DatabaseSync, live: LiveRoomsPayload): void {
  db.prepare(`INSERT INTO snapshots (ts, room_count, player_count) VALUES (?, ?, ?)`).run(
    new Date().toISOString(),
    live.roomCount,
    live.playerCount,
  );
}

export function pruneOldRows(db: DatabaseSync, retainDays: number): void {
  const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`DELETE FROM events WHERE ts < ?`).run(cutoff);
  db.prepare(`DELETE FROM snapshots WHERE ts < ?`).run(cutoff);
}

export interface OverviewData {
  live: LiveRoomsPayload;
  issues: {
    lastHour: { kind: string; count: number; severity: string }[];
    alert: boolean;
    summary: string | null;
  };
  history: { hour: string; avgRooms: number; avgPlayers: number; maxPlayers: number }[];
  recentEvents: {
    ts: string;
    source: string;
    kind: string;
    severity: string;
    roomCode: string | null;
    message: string | null;
  }[];
  totals: { eventsLast24h: number; snapshotsLast24h: number };
}

export function buildOverview(db: DatabaseSync, live: LiveRoomsPayload): OverviewData {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const issueRows = db
    .prepare(
      `SELECT kind, severity, COUNT(*) AS count FROM events
       WHERE ts >= ?
         AND (severity IN ('warn', 'error') OR kind IN (
           'signaling_disconnect','webrtc_disconnect','ice_fetch_failed','client_error',
           'log_error','security_event','rate_limit_exceeded','unauthorized_access',
           'signaling_abuse','connection_flood'))
       GROUP BY kind, severity ORDER BY count DESC LIMIT 20`,
    )
    .all(hourAgo) as { kind: string; severity: string; count: number }[];

  const disconnectCount = issueRows
    .filter((r) => r.kind === "signaling_disconnect" || r.kind === "webrtc_disconnect")
    .reduce((n, r) => n + r.count, 0);

  const alert = disconnectCount >= 10 || issueRows.some((r) => r.severity === "error" && r.count >= 5);
  let summary: string | null = null;
  if (alert) {
    if (disconnectCount >= 10) {
      summary = `${disconnectCount} connect/disconnect failures in the last hour — players may be struggling to join or stay connected.`;
    } else {
      summary = "Elevated error rate in the last hour — check recent events below.";
    }
  }

  const historyRows = db
    .prepare(
      `SELECT substr(ts, 1, 13) AS hour,
              AVG(room_count) AS avgRooms,
              AVG(player_count) AS avgPlayers,
              MAX(player_count) AS maxPlayers
       FROM snapshots WHERE ts >= ?
       GROUP BY hour ORDER BY hour ASC`,
    )
    .all(dayAgo) as { hour: string; avgRooms: number; avgPlayers: number; maxPlayers: number }[];

  const recentEvents = db
    .prepare(
      `SELECT ts, source, kind, severity, room_code AS roomCode, message FROM events
       ORDER BY id DESC LIMIT 40`,
    )
    .all() as OverviewData["recentEvents"];

  const eventsLast24h = (
    db.prepare(`SELECT COUNT(*) AS n FROM events WHERE ts >= ?`).get(dayAgo) as { n: number }
  ).n;
  const snapshotsLast24h = (
    db.prepare(`SELECT COUNT(*) AS n FROM snapshots WHERE ts >= ?`).get(dayAgo) as { n: number }
  ).n;

  return {
    live,
    issues: { lastHour: issueRows, alert, summary },
    history: historyRows.map((r) => ({
      hour: r.hour,
      avgRooms: Math.round(r.avgRooms * 10) / 10,
      avgPlayers: Math.round(r.avgPlayers * 10) / 10,
      maxPlayers: r.maxPlayers,
    })),
    recentEvents,
    totals: { eventsLast24h, snapshotsLast24h },
  };
}
