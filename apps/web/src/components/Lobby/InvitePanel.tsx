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
    <div className="rounded-2xl bg-slate-800/60 p-4 shadow-lg">
      <p className="text-xs uppercase text-slate-400">Room code</p>
      <p className="text-3xl font-bold tracking-widest text-amber-400">{state.roomCode}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={copyLink} className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold">
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button onClick={share} className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900">
          Share
        </button>
      </div>
    </div>
  );
}
