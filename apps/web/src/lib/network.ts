export function getSignalingUrl(): string {
  const configured = import.meta.env.VITE_SIGNALING_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8080`;
}

/** ICE servers from VITE_ICE_SERVERS only — no built-in defaults. */
export function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return [];
  try {
    const servers = JSON.parse(raw) as RTCIceServer[];
    return Array.isArray(servers) ? servers : [];
  } catch {
    return [];
  }
}

export function roomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}
