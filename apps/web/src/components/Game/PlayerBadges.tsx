import { useRoom } from "../../lib/RoomContext";

function handStatus(
  id: string,
  clientPlayerId: string,
  handCount: number,
  cardCountVisible: Record<string, boolean>,
  isKazhutha: boolean,
  isFinished: boolean,
  finishedIndex: number,
): string {
  if (isKazhutha) return "🐴 Kazhutha";
  if (isFinished) return `Out #${finishedIndex + 1}`;
  if (id === clientPlayerId || cardCountVisible[id]) return `${handCount} cards`;
  return "Hidden";
}

export default function PlayerBadges() {
  const { state, client } = useRoom();
  const order = state.turnOrder.length > 0 ? state.turnOrder : state.players.map((p) => p.id);
  const isPlaying = state.phase === "playing";
  const myCountVisible = state.cardCountVisible[client.playerId] ?? false;

  function toggleMyCountVisibility() {
    client.sendIntent({
      type: "SetCardCountVisible",
      playerId: client.playerId,
      visible: !myCountVisible,
    });
  }

  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2">
      {order.map((id) => {
        const player = state.players.find((p) => p.id === id);
        if (!player) return null;
        const isMe = id === client.playerId;
        const isTurn = state.currentTurnId === id;
        const isLeader = state.leaderId === id;
        const finishedIndex = state.finishedPlayers.indexOf(id);
        const isFinished = finishedIndex !== -1;
        const isKazhutha = state.kazhuthaId === id;
        const handCount = state.hands[id]?.length ?? 0;
        const status = handStatus(id, client.playerId, handCount, state.cardCountVisible, isKazhutha, isFinished, finishedIndex);

        return (
          <div
            key={id}
            className={`flex min-w-[84px] shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center ${
              isTurn ? "bg-amber-400/20 ring-1 ring-amber-400" : "bg-slate-800/60"
            } ${isFinished ? "opacity-50" : ""}`}
          >
            <span className="truncate text-xs font-semibold">
              {player.name}
              {isMe ? " (you)" : ""}
            </span>
            <span className="mt-1 text-[10px] text-slate-400">{status}</span>
            {isLeader && !isFinished && <span className="mt-0.5 text-[10px] text-amber-300">Leader</span>}
            {!player.connected && <span className="mt-0.5 text-[10px] text-red-400">offline</span>}
            {isMe && isPlaying && !isFinished && (
              <button
                type="button"
                onClick={toggleMyCountVisibility}
                className="mt-1 text-[10px] text-amber-300 underline decoration-amber-300/40 underline-offset-2"
              >
                {myCountVisible ? "Hide count" : "Reveal count"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
