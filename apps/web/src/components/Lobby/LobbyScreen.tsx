import { useRoom } from "../../lib/RoomContext";
import InvitePanel from "./InvitePanel";
import PlayerList from "./PlayerList";
import RulesPanel from "./RulesPanel";

export default function LobbyScreen() {
  const { state, client } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;
  const connectedPlayers = state.players.filter((p) => p.connected);
  const allReady = connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.ready);

  function toggleReady() {
    client.sendIntent({ type: "SetReady", playerId: client.playerId, ready: !me?.ready });
  }

  function startGame() {
    client.sendIntent({ type: "StartGame", playerId: client.playerId });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-center text-2xl font-bold text-amber-400">Lobby</h1>
      <InvitePanel />
      <PlayerList />
      <RulesPanel />

      <div className="sticky bottom-0 mt-2 flex gap-2 bg-slate-950/80 py-3 backdrop-blur">
        <button
          onClick={toggleReady}
          className={`flex-1 rounded-lg px-4 py-3 text-base font-semibold ${
            me?.ready ? "bg-emerald-500 text-slate-900" : "bg-slate-700"
          }`}
        >
          {me?.ready ? "Ready ✓" : "I'm ready"}
        </button>
        {isHost && (
          <button
            onClick={startGame}
            disabled={!allReady}
            className="flex-1 rounded-lg bg-amber-400 px-4 py-3 text-base font-semibold text-slate-900 disabled:opacity-40"
          >
            {allReady ? "Start game" : `Waiting (${connectedPlayers.filter((p) => p.ready).length}/${connectedPlayers.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
