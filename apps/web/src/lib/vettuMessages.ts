export function pickRandomVettuMessage(messages: string[]): string {
  if (messages.length === 0) return "";
  return messages[Math.floor(Math.random() * messages.length)]!;
}
