import { useRoom } from "../../lib/RoomContext";

export default function PlayerList() {
  const { state, client } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;

  return (
    <div className="rounded-2xl bg-slate-800/60 p-4 shadow-lg">
      <p className="mb-2 text-xs uppercase text-slate-400">Players ({state.players.length})</p>
      <ul className="flex flex-col gap-2">
        {state.players.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-emerald-400" : "bg-slate-600"}`} />
              <span className="font-medium">{p.name}</span>
              {p.isHost && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-300">Host</span>}
              {p.id === client.playerId && <span className="text-xs text-slate-500">(you)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${p.ready ? "text-emerald-400" : "text-slate-500"}`}>
                {p.ready ? "Ready" : "Not ready"}
              </span>
              {isHost && p.id !== client.playerId && (
                <button
                  onClick={() => client.sendIntent({ type: "KickPlayer", playerId: client.playerId, target: p.id })}
                  className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/40"
                >
                  Kick
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
