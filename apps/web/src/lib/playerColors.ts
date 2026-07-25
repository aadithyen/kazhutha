export interface PlayerColor {
  bg: string;
  text: string;
  ring: string;
}

/** Bright accent colors — no pure red/blue/yellow primaries; fits neutral + rose theme. */
const PLAYER_COLORS: PlayerColor[] = [
  { bg: "#14b8a6", text: "#ffffff", ring: "#0d9488" },
  { bg: "#8b5cf6", text: "#ffffff", ring: "#7c3aed" },
  { bg: "#f472b6", text: "#ffffff", ring: "#ec4899" },
  { bg: "#34d399", text: "#064e3b", ring: "#10b981" },
  { bg: "#fb923c", text: "#ffffff", ring: "#f97316" },
  { bg: "#38bdf8", text: "#0c4a6e", ring: "#0ea5e9" },
  { bg: "#a78bfa", text: "#ffffff", ring: "#8b5cf6" },
  { bg: "#2dd4bf", text: "#134e4a", ring: "#14b8a6" },
  { bg: "#fbbf24", text: "#78350f", ring: "#f59e0b" },
  { bg: "#e879f9", text: "#ffffff", ring: "#d946ef" },
];

function hashPlayerId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPlayerColor(playerId: string): PlayerColor {
  return PLAYER_COLORS[hashPlayerId(playerId) % PLAYER_COLORS.length];
}

export function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const word = parts[0] ?? "?";
  return word.slice(0, 2).toUpperCase();
}
