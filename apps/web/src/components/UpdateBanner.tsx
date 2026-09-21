import { useLocale } from "../i18n";

export default function UpdateBanner({ onReload }: { onReload: () => void }) {
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>{t("update.message")}</span>
      <button
        onClick={onReload}
        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
      >
        {t("update.reload")}
      </button>
    </div>
  );
}
