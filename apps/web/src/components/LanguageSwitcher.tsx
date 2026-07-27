import { SUPPORTED_LOCALES, useLocale, type LocaleId } from "../i18n";
import en from "../i18n/locales/en.json";
import ml from "../i18n/locales/ml.json";

const LANGUAGE_LABELS: Record<LocaleId, string> = {
  en: en.meta.languageName,
  ml: ml.meta.languageName,
};

interface Props {
  className?: string;
  showLabel?: boolean;
}

export default function LanguageSwitcher({ className = "", showLabel = false }: Props) {
  const { t, locale, setLocale } = useLocale();

  return (
    <div className={className}>
      {showLabel && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {t("common.language")}
        </p>
      )}
      <div
        className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-800"
        role="group"
        aria-label={t("common.language")}
      >
        {SUPPORTED_LOCALES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setLocale(id)}
            aria-pressed={locale === id}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              locale === id
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {LANGUAGE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
