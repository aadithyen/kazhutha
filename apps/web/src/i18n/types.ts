import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["en", "ml"] as const;
export type LocaleId = (typeof SUPPORTED_LOCALES)[number];

export type LocaleMessages = typeof en;
