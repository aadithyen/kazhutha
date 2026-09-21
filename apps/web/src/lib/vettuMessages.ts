export function getVettuMessageByIndex(messages: string[], index: number): string {
  if (messages.length === 0) return "";
  const safe = Math.floor(index) % messages.length;
  return messages[safe < 0 ? safe + messages.length : safe]!;
}
