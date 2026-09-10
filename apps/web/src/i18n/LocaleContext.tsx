import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import LanguageToast from "../components/LanguageToast";
import { applyDocumentLocale, DEFAULT_LOCALE, getStoredLocale, storeLocale } from "./locale";
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
  const [locale, setLocaleState] = useState<LocaleId>(() => getStoredLocale() ?? DEFAULT_LOCALE);
  // First visit only: nothing stored yet, so offer the switch instead of blocking the screen.
  const [offerSwitch, setOfferSwitch] = useState(() => getStoredLocale() === null);

  const setLocale = (next: LocaleId) => {
    storeLocale(next);
    setLocaleState(next);
    setOfferSwitch(false);
  };

  const keepLocale = useCallback(() => {
    storeLocale(locale);
    setOfferSwitch(false);
  }, [locale]);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const messages = getMessages(locale);
    return {
      locale,
      messages,
      setLocale,
      t: (key, params) => translate(messages, key, params),
      translateError: (message) => translateError(messages, message),
      vettuMessages: messages.vettu.statements,
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
      {offerSwitch && <LanguageToast onDismiss={keepLocale} />}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}
