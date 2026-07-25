import { GameState } from "./state";

/** Who may validate intents and broadcast events right now. */
export function getAuthorityId(state: GameState): string | null {
  if (state.actingHostId) return state.actingHostId;
  return state.hostId;
}

/** Deterministic pick: first connected eligible player in seating order. */
export function electActingHost(state: GameState, excludeId?: string): string | null {
  const order =
    state.phase === "lobby"
      ? state.players.map((p) => p.id)
      : state.turnOrder.length > 0
        ? state.turnOrder
        : state.players.map((p) => p.id);

  const eligible =
    state.phase === "lobby"
      ? state.players.filter((p) => p.connected && p.id !== excludeId).map((p) => p.id)
      : state.activePlayers.filter((id) => {
          if (id === excludeId) return false;
          const player = state.players.find((p) => p.id === id);
          return player?.connected ?? false;
        });

  for (const id of order) {
    if (eligible.includes(id)) return id;
  }
  return eligible[0] ?? null;
}

/** Pre-assign permanent successor when current host clears their hand. */
export function electSuccessorHost(state: GameState, currentHostId: string): string | null {
  return electActingHost(state, currentHostId);
}

export function isHostConnected(state: GameState): boolean {
  if (!state.hostId) return false;
  return state.players.find((p) => p.id === state.hostId)?.connected ?? false;
}
