import { useRoom } from "../../lib/RoomContext";
import PlayerAvatar from "./PlayerAvatar";

export default function PlayerBadges() {
  const { state, client } = useRoom();
  const order = state.turnOrder.length > 0 ? state.turnOrder : state.players.map((p) => p.id);
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-neutral-100 px-3 py-3 dark:border-neutral-800">
      {order.map((id) => {
        const player = state.players.find((p) => p.id === id);
        if (!player) return null;
        const isMe = id === client.playerId;
        const isTurn = state.currentTurnId === id;
        const finishedIndex = state.finishedPlayers.indexOf(id);
        const isFinished = finishedIndex !== -1;
        const handCount = state.hands[id]?.length ?? 0;
        const countVisibleToOthers = state.cardCountVisible[id] ?? false;
        const showHandCount = !isFinished && (isMe || countVisibleToOthers);

        return (
          <div key={id} className="flex min-w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <PlayerAvatar
              playerId={id}
              name={player.name}
              isTurn={isTurn && !isFinished}
              isFinished={isFinished}
              showHandCount={showHandCount}
              handCount={handCount}
              finishRank={isFinished ? finishedIndex + 1 : undefined}
            />
            <span className="max-w-[72px] truncate text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
              {player.name}
              {isMe ? " (you)" : ""}
            </span>
            {!player.connected && <span className="text-[10px] text-rose-500">offline</span>}
          </div>
        );
      })}
    </div>
  );
}
