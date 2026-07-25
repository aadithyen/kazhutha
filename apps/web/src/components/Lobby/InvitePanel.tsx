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
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <p className="font-serif text-xs font-semibold uppercase tracking-wide text-neutral-400">Room code</p>
      <p className="font-serif text-4xl font-semibold tracking-[0.2em] text-neutral-900">{state.roomCode}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 rounded-xl bg-neutral-100 px-3 py-2 font-serif text-sm font-semibold not-italic text-neutral-900 ring-1 ring-neutral-200"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={share}
          className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 font-serif text-sm font-semibold not-italic text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)]"
        >
          Share
        </button>
      </div>
    </div>
  );
}
