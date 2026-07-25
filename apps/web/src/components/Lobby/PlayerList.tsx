import { useRoom } from "../../lib/RoomContext";

export default function PlayerList() {
  const { state, client } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Players ({state.players.length})
      </p>
      <ul className="flex flex-col gap-2">
        {state.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 ring-1 ring-neutral-100"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-emerald-500" : "bg-neutral-300"}`} />
              <span className="font-medium text-neutral-900">{p.name}</span>
              {p.isHost && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">Host</span>
              )}
              {p.id === client.playerId && <span className="text-xs text-neutral-400">(you)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${p.ready ? "text-emerald-700" : "text-neutral-400"}`}>
                {p.ready ? "Ready" : "Not ready"}
              </span>
              {isHost && p.id !== client.playerId && (
                <button
                  onClick={() => client.sendIntent({ type: "KickPlayer", playerId: client.playerId, target: p.id })}
                  className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100"
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
