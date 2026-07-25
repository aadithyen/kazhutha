export interface PlayerColor {
  border: string;
  ring: string;
}

/**
 * Pastel accents spaced across the hue wheel so adjacent players stay distinguishable.
 * Initials stay neutral; only the border carries player color.
 */
const PLAYER_COLORS: PlayerColor[] = [
  { border: "#5eb8d4", ring: "#3a9fbe" }, // cyan
  { border: "#6b9ee0", ring: "#4a84c9" }, // blue
  { border: "#8b7fd4", ring: "#6f64b8" }, // indigo
  { border: "#b07fd4", ring: "#9664b8" }, // purple
  { border: "#d47bb8", ring: "#b85f9e" }, // magenta
  { border: "#e07a8f", ring: "#c45f74" }, // rose
  { border: "#e8966e", ring: "#d07a52" }, // coral
  { border: "#ddb85a", ring: "#c49a42" }, // gold
  { border: "#8fbf6a", ring: "#73a34f" }, // chartreuse
  { border: "#5ebf9a", ring: "#45a37f" }, // seafoam
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
