import { useState } from "react";
import { roomUrl } from "../../lib/network";
import { useRoom } from "../../lib/RoomContext";

export default function InvitePanel() {
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
        await navigator.share({ title: "Kazhutha", text: "Join my Kazhutha room", url });
      } catch {
        // user cancelled share, ignore
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Room code</p>
      <p className="font-serif text-4xl font-semibold italic tracking-[0.2em] text-neutral-900 dark:text-neutral-100">
        {state.roomCode}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={share}
          className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        >
          Share
        </button>
      </div>
    </div>
  );
}
