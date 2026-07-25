import { useRoom } from "../../lib/RoomContext";

export default function PlayerBadges() {
  const { state, client } = useRoom();
  const order = state.turnOrder.length > 0 ? state.turnOrder : state.players.map((p) => p.id);

  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2">
      {order.map((id) => {
        const player = state.players.find((p) => p.id === id);
        if (!player) return null;
        const isTurn = state.currentTurnId === id;
        const isLeader = state.leaderId === id;
        const finishedIndex = state.finishedPlayers.indexOf(id);
        const isFinished = finishedIndex !== -1;
        const isKazhutha = state.kazhuthaId === id;
        const handCount = state.hands[id]?.length ?? 0;

        return (
          <div
            key={id}
            className={`flex min-w-[84px] shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center ${
              isTurn ? "bg-amber-400/20 ring-1 ring-amber-400" : "bg-slate-800/60"
            } ${isFinished ? "opacity-50" : ""}`}
          >
            <span className="truncate text-xs font-semibold">
              {player.name}
              {id === client.playerId ? " (you)" : ""}
            </span>
            <span className="mt-1 text-[10px] text-slate-400">
              {isKazhutha ? "🐴 Kazhutha" : isFinished ? `Out #${finishedIndex + 1}` : `${handCount} cards`}
            </span>
            {isLeader && !isFinished && <span className="mt-0.5 text-[10px] text-amber-300">Leader</span>}
            {!player.connected && <span className="mt-0.5 text-[10px] text-red-400">offline</span>}
          </div>
        );
      })}
    </div>
  );
}
