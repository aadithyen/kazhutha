import { randomId } from "@kazhutha/shared";

const PLAYER_ID_KEY = "kazhutha:playerId";
const NAME_KEY = "kazhutha:name";

export function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = randomId(8);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getStoredName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function storeName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}
