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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 bg-white px-4 text-neutral-900">
      <h1 className="font-serif text-3xl font-semibold italic">Join the table</h1>
      <form onSubmit={handleSubmit} className="w-full">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-xl bg-neutral-50 px-4 py-3 font-serif text-base italic outline-none ring-1 ring-neutral-200 focus:ring-neutral-400"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-neutral-900 px-4 py-3 font-serif text-base font-semibold not-italic text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] active:scale-[0.98]"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

function RoomBody() {
  const { state, banner, dismissBanner } = useRoom();

  const inLobby = state.phase === "lobby";

  return (
    <div className={`min-h-dvh ${inLobby ? "bg-white text-neutral-900" : ""}`}>
      {banner && <ConnectionBanner message={banner} onDismiss={dismissBanner} />}
      {inLobby ? <LobbyScreen /> : <GameScreen />}
    </div>
  );
}
