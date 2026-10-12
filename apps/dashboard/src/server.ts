import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  buildOverview,
  insertEvent,
  openDatabase,
  pruneOldRows,
  type IngestEvent,
  type LiveRoomsPayload,
} from "./db.js";
import { startSignalingPoller } from "./poller.js";
import { DASHBOARD_HTML } from "./publicHtml.js";

const PORT = Number(process.env.PORT ?? 9090);
const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/kazhutha.db";
const SIGNALING_URL = process.env.SIGNALING_URL ?? "http://127.0.0.1:8080";
const API_KEY = process.env.DASHBOARD_API_KEY ?? "";
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS ?? 30);
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const db = openDatabase(DATABASE_PATH);
let cachedLive: LiveRoomsPayload = { roomCount: 0, playerCount: 0, rooms: [] };

function corsOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (ALLOWED_ORIGINS.length === 0) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as T);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function apiKeyOk(req: IncomingMessage): boolean {
  if (!API_KEY) return false;
  const header = req.headers["x-analytics-key"] ?? req.headers["x-dashboard-key"];
  if (header === API_KEY) return true;
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    return url.searchParams.get("key") === API_KEY;
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown, origin?: string | null) {
  res.writeHead(status, {
    "content-type": "application/json",
    ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}),
  });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const route = req.url?.split("?")[0] ?? "/";
  const origin = corsOrigin(req);

  if (req.method === "OPTIONS" && route.startsWith("/api/")) {
    res.writeHead(204, {
      ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}),
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-analytics-key",
      "access-control-max-age": "86400",
    });
    res.end();
    return;
  }

  if (route === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (route === "/" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(DASHBOARD_HTML);
    return;
  }

  if (route === "/api/overview" && req.method === "GET") {
    sendJson(res, 200, buildOverview(db, cachedLive));
    return;
  }

  if (route === "/api/events" && req.method === "POST") {
    if (!apiKeyOk(req)) {
      sendJson(res, 401, { error: "unauthorized" }, origin);
      return;
    }
    void readJson<IngestEvent | IngestEvent[]>(req)
      .then((body) => {
        const items = Array.isArray(body) ? body : [body];
        for (const item of items) {
          if (!item.source || !item.kind || !item.severity) {
            sendJson(res, 400, { error: "invalid payload" }, origin);
            return;
          }
          insertEvent(db, item);
        }
        sendJson(res, 202, { ok: true }, origin);
      })
      .catch(() => sendJson(res, 400, { error: "bad json" }, origin));
    return;
  }

  res.writeHead(404);
  res.end();
});

startSignalingPoller(db, SIGNALING_URL, API_KEY, POLL_MS, (live) => {
  if (live) cachedLive = live;
});

const pruneTimer = setInterval(() => pruneOldRows(db, RETAIN_DAYS), 6 * 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(JSON.stringify({ level: "info", message: "dashboard listening", port: PORT }));
});

process.on("SIGTERM", () => {
  clearInterval(pruneTimer);
  server.close();
});
