import { DEFAULT_ICE_SERVERS } from "@kazhutha/network";

export function getSignalingUrl(): string {
  const configured = import.meta.env.VITE_SIGNALING_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8080`;
}

export function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const extra = JSON.parse(raw) as RTCIceServer[];
    if (!Array.isArray(extra) || extra.length === 0) return DEFAULT_ICE_SERVERS;
    return [...DEFAULT_ICE_SERVERS, ...extra];
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export function roomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}
