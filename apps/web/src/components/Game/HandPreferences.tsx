import type { HandSortMode } from "@kazhutha/shared";
import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES, useLocale, type LocaleId } from "../../i18n";
import en from "../../i18n/locales/en.json";
import ml from "../../i18n/locales/ml.json";
import type { ThemePreference } from "../../lib/theme";

const LANGUAGE_LABELS: Record<LocaleId, string> = {
  en: en.meta.languageName,
  ml: ml.meta.languageName,
};

interface Props {
  sortMode: HandSortMode;
  onSortModeChange: (mode: HandSortMode) => void;
  countVisible: boolean;
  onCountVisibleChange: (visible: boolean) => void;
  showCountToggle: boolean;
  soundMuted: boolean;
  onSoundMutedChange: (muted: boolean) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (theme: ThemePreference) => void;
}

function PreferencesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.06 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HandPreferences({
  sortMode,
  onSortModeChange,
  countVisible,
  onCountVisibleChange,
  showCountToggle,
  soundMuted,
  onSoundMutedChange,
  themePreference,
  onThemePreferenceChange,
}: Props) {
  const { t, locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("preferences.title")}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
      >
        <PreferencesIcon />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("preferences.title")}
          className="absolute bottom-full right-0 z-30 mb-2 w-52 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-black/40"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {t("common.language")}
          </p>
          <div
            className="mb-3 inline-flex w-full rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-800"
            role="group"
            aria-label={t("common.language")}
          >
            {SUPPORTED_LOCALES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocale(id as LocaleId)}
                aria-pressed={locale === id}
                className={`flex-1 rounded-full px-2 py-1 transition-colors ${
                  locale === id
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                {LANGUAGE_LABELS[id]}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {t("preferences.appearance")}
          </p>
          <div
            className="mb-3 inline-flex w-full rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-800"
            role="group"
            aria-label={t("preferences.colorTheme")}
          >
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => onThemePreferenceChange(theme)}
                aria-pressed={themePreference === theme}
                className={`flex-1 rounded-full px-2 py-1 transition-colors ${
                  themePreference === theme
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                {t(`preferences.theme${theme === "system" ? "Auto" : theme.charAt(0).toUpperCase() + theme.slice(1)}`)}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {t("preferences.arrangement")}
          </p>
          <div
            className="mb-3 inline-flex w-full rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-800"
            role="group"
            aria-label={t("preferences.handSortOrder")}
          >
            {(["suit", "value"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSortModeChange(mode)}
                aria-pressed={sortMode === mode}
                className={`flex-1 rounded-full px-2 py-1 transition-colors ${
                  sortMode === mode
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                {t(`preferences.sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
              </button>
            ))}
          </div>
          {showCountToggle && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {t("preferences.visibility")}
              </p>
              <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                <span>{t("preferences.showCardCount")}</span>
                <input
                  type="checkbox"
                  checked={countVisible}
                  onChange={(e) => onCountVisibleChange(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-neutral-500"
                />
              </label>
            </>
          )}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {t("preferences.audio")}
          </p>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-300">
            <span>{t("preferences.soundEffects")}</span>
            <input
              type="checkbox"
              checked={!soundMuted}
              onChange={(e) => onSoundMutedChange(!e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-neutral-500"
            />
          </label>
        </div>
      )}
    </div>
  );
}
