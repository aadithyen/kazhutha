import en from "./locales/en.json";
import ml from "./locales/ml.json";
import type { LocaleId, LocaleMessages } from "./types";

const MESSAGES: Record<LocaleId, LocaleMessages> = { en, ml };

export function getMessages(locale: LocaleId): LocaleMessages {
  return MESSAGES[locale];
}
