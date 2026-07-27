import type { LocaleId } from "./types";
import { SUPPORTED_LOCALES } from "./types";

const LOCALE_KEY = "kazhutha:locale";

export function getStoredLocale(): LocaleId | null {
  const stored = localStorage.getItem(LOCALE_KEY);
  return SUPPORTED_LOCALES.includes(stored as LocaleId) ? (stored as LocaleId) : null;
}

export function storeLocale(locale: LocaleId) {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function applyDocumentLocale(locale: LocaleId) {
  document.documentElement.lang = locale === "ml" ? "ml" : "en";
}
