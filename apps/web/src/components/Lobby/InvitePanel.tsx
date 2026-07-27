import { useState } from "react";
import { useLocale } from "../../i18n";
import { roomUrl } from "../../lib/network";
import { useRoom } from "../../lib/RoomContext";

export default function InvitePanel() {
  const { t } = useLocale();
  const { state } = useRoom();
  const [copied, setCopied] = useState(false);
  const url = roomUrl(state.roomCode);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("lobby.shareTitle"), text: t("lobby.shareText"), url });
      } catch {
        // user cancelled share, ignore
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{t("lobby.roomCode")}</p>
      <p className="font-serif text-4xl font-semibold italic tracking-[0.2em] text-neutral-900 dark:text-neutral-100">
        {state.roomCode}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700"
        >
          {copied ? t("lobby.copied") : t("lobby.copyLink")}
        </button>
        <button
          onClick={share}
          className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        >
          {t("lobby.share")}
        </button>
      </div>
    </div>
  );
}
