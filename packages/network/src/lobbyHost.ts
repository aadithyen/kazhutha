/** Deterministic P2P lobby host: earliest joiner still present wins; ties break on peer id. */
export function electLobbyHost(selfId: string, joinOrder: readonly string[], presentIds: ReadonlySet<string>): string {
  for (const id of joinOrder) {
    if (presentIds.has(id)) return id;
  }
  const fallback = [...presentIds].sort();
  return fallback[0] ?? selfId;
}
