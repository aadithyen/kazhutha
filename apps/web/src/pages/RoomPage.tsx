import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import ConnectionBanner from "../components/ConnectionBanner";
import GameScreen from "../components/Game/GameScreen";
import LobbyScreen from "../components/Lobby/LobbyScreen";
import { getStoredName, storeName } from "../lib/identity";
import { RoomProvider, useRoom } from "../lib/RoomContext";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [hasName, setHasName] = useState(!!getStoredName());

  if (!code) return null;
  if (!hasName) return <NameGate onDone={() => setHasName(true)} />;

  return (
    <RoomProvider roomCode={code.toUpperCase()}>
      <RoomBody />
    </RoomProvider>
  );
}

function NameGate({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    storeName(name);
    onDone();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold text-amber-400">Join the table</h1>
      <form onSubmit={handleSubmit} className="w-full">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base outline-none ring-1 ring-slate-700 focus:ring-amber-400"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-semibold text-slate-900 active:scale-[0.98]"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

function RoomBody() {
  const { state, banner, dismissBanner } = useRoom();

  return (
    <div className="min-h-dvh">
      {banner && <ConnectionBanner message={banner} onDismiss={dismissBanner} />}
      {state.phase === "lobby" ? <LobbyScreen /> : <GameScreen />}
    </div>
  );
}
