import type { HandSortMode } from "@kazhutha/shared";

const HAND_SORT_KEY = "kazhutha:handSort";
const SOUND_MUTED_KEY = "kazhutha:soundMuted";

export function getHandSortMode(): HandSortMode {
  const stored = localStorage.getItem(HAND_SORT_KEY);
  return stored === "value" ? "value" : "suit";
}

export function storeHandSortMode(mode: HandSortMode) {
  localStorage.setItem(HAND_SORT_KEY, mode);
}

export function getSoundMuted(): boolean {
  return localStorage.getItem(SOUND_MUTED_KEY) === "true";
}

export function storeSoundMuted(muted: boolean) {
  localStorage.setItem(SOUND_MUTED_KEY, muted ? "true" : "false");
}
