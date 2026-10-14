import { useMemo } from "react";
import { useLocale } from "../../i18n";
import { getVettuMessageByIndex } from "../../lib/vettuMessages";
import { useAddToHomeScreen } from "../../lib/pwaInstall";

export default function AddToHomeScreenPrompt() {
  const { t, addToHomeMessages } = useLocale();
  const { canShow, canNativeInstall, showIosHint, dismiss, promptInstall } = useAddToHomeScreen();

  const message = useMemo(() => {
    const index = Math.floor(Math.random() * addToHomeMessages.length);
    return getVettuMessageByIndex(addToHomeMessages, index);
  }, [addToHomeMessages]);

  if (!canShow) return null;

  return (
    <div
      className="mt-1 w-full max-w-xs rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left dark:border-neutral-700 dark:bg-neutral-900"
      role="region"
      aria-label={t("game.addToHome.aria")}
    >
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{message}</p>
      {showIosHint && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t("game.addToHome.iosHint")}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canNativeInstall && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t("game.addToHome.install")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200 dark:text-neutral-300 dark:ring-neutral-600"
        >
          {t("game.addToHome.dismiss")}
        </button>
      </div>
    </div>
  );
}
