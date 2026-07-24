export function getSignalingUrl(): string {
  const configured = import.meta.env.VITE_SIGNALING_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8080`;
}

export function getIceServers(): RTCIceServer[] | undefined {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as RTCIceServer[];
  } catch {
    return undefined;
  }
}

export function roomUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}
