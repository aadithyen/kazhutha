import { useEffect } from "react";
import { SUPPORTED_LOCALES, useLocale } from "../i18n";
import { getMessages } from "../i18n/messages";

const AUTO_HIDE_MS = 12_000;

/**
 * Non-blocking first-visit prompt. Shows in the current (default) language and offers
 * each other language in that language's own words, so a reader who can't follow the
 * default still finds the way out.
 */
export default function LanguageToast({ onDismiss }: { onDismiss: () => void }) {
  const { t, locale, setLocale } = useLocale();
  const others = SUPPORTED_LOCALES.filter((id) => id !== locale);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <span className="flex-1">{t("languageToast.message")}</span>
        {others.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setLocale(id)}
            lang={id}
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900"
          >
            {getMessages(id).languageToast.switchAction}
          </button>
        ))}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.dismiss")}
          className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
