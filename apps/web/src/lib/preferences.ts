import type { HandSortMode } from "@kazhutha/shared";

const HAND_SORT_KEY = "kazhutha:handSort";

export function getHandSortMode(): HandSortMode {
  const stored = localStorage.getItem(HAND_SORT_KEY);
  return stored === "value" ? "value" : "suit";
}

export function storeHandSortMode(mode: HandSortMode) {
  localStorage.setItem(HAND_SORT_KEY, mode);
}
