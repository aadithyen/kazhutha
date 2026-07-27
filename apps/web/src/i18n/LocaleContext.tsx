import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import LanguagePicker from "../components/LanguagePicker";
import { applyDocumentLocale, getStoredLocale, storeLocale } from "./locale";
import { getMessages } from "./messages";
import { translate, translateError } from "./translate";
import type { LocaleId, LocaleMessages } from "./types";

interface LocaleContextValue {
  locale: LocaleId;
  messages: LocaleMessages;
  setLocale: (locale: LocaleId) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  translateError: (message: string) => string;
  vettuMessages: string[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId | null>(() => getStoredLocale());

  const setLocale = (next: LocaleId) => {
    storeLocale(next);
    setLocaleState(next);
  };

  useEffect(() => {
    if (locale) applyDocumentLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue | null>(() => {
    if (!locale) return null;
    const messages = getMessages(locale);
    return {
      locale,
      messages,
      setLocale,
      t: (key, params) => translate(messages, key, params),
      translateError: (message) => translateError(messages, message),
      vettuMessages: messages.vettu,
    };
  }, [locale]);

  if (!value) {
    return <LanguagePicker onSelect={setLocale} />;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider after language is chosen");
  return ctx;
}
