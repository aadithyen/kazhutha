const DEFAULT_VETTU_MESSAGES = ["VETTU!!"];

export function getVettuMessages(): string[] {
  const raw = import.meta.env.VITE_VETTU_MESSAGES;
  if (!raw) return DEFAULT_VETTU_MESSAGES;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_VETTU_MESSAGES;
    const messages = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return messages.length > 0 ? messages : DEFAULT_VETTU_MESSAGES;
  } catch {
    return DEFAULT_VETTU_MESSAGES;
  }
}

export function pickRandomVettuMessage(): string {
  const messages = getVettuMessages();
  return messages[Math.floor(Math.random() * messages.length)]!;
}
