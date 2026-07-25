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
    <div className="flex gap-2 overflow-x-auto border-b border-neutral-100 px-3 py-2">
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
              isTurn ? "bg-neutral-100 ring-1 ring-neutral-300" : "bg-neutral-50"
            } ${isFinished ? "opacity-50" : ""}`}
          >
            <span className="truncate font-serif text-xs font-semibold italic">
              {player.name}
              {isMe ? " (you)" : ""}
            </span>
            <span className="mt-1 font-serif text-[10px] italic text-neutral-500">{status}</span>
            {isLeader && !isFinished && <span className="mt-0.5 font-serif text-[10px] italic text-neutral-600">Leader</span>}
            {!player.connected && <span className="mt-0.5 text-[10px] text-rose-500">offline</span>}
            {isMe && isPlaying && !isFinished && (
              <button
                type="button"
                onClick={toggleMyCountVisibility}
                className="mt-1 font-serif text-[10px] italic text-neutral-600 underline decoration-neutral-300 underline-offset-2"
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
