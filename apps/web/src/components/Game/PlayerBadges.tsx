import { useRoom } from "../../lib/RoomContext";
import PlayerAvatar from "./PlayerAvatar";

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
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-neutral-100 px-3 py-3">
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
          <div key={id} className="flex min-w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <PlayerAvatar
              playerId={id}
              name={player.name}
              isTurn={isTurn && !isFinished}
              isFinished={isFinished}
            />
            <span className="max-w-[72px] truncate text-[11px] font-medium text-neutral-800">
              {player.name}
              {isMe ? " (you)" : ""}
            </span>
            <span className="text-[10px] leading-tight text-neutral-500">{status}</span>
            {isLeader && !isFinished && <span className="text-[10px] font-medium text-neutral-600">Leader</span>}
            {!player.connected && <span className="text-[10px] text-rose-500">offline</span>}
          </div>
        );
      })}
    </div>
  );
}
