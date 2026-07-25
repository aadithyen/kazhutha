export interface PlayerColor {
  border: string;
  text: string;
  ring: string;
}

/** Pastel accents for white backgrounds — soft borders with readable initials. */
const PLAYER_COLORS: PlayerColor[] = [
  { border: "#7ecfc0", text: "#2d6a5f", ring: "#5bb8a8" },
  { border: "#c4b5fd", text: "#5b4b8a", ring: "#a78bfa" },
  { border: "#f9a8d4", text: "#9d3b6e", ring: "#f472b6" },
  { border: "#86efac", text: "#2f6b45", ring: "#4ade80" },
  { border: "#fdba74", text: "#9a4a12", ring: "#fb923c" },
  { border: "#7dd3fc", text: "#1e5f7a", ring: "#38bdf8" },
  { border: "#d8b4fe", text: "#6b3f8f", ring: "#c084fc" },
  { border: "#5eead4", text: "#1f6b62", ring: "#2dd4bf" },
  { border: "#fde68a", text: "#8a6b1a", ring: "#fbbf24" },
  { border: "#f0abfc", text: "#8a3b8f", ring: "#e879f9" },
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
