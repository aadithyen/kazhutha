import { isStraggler } from "@kazhutha/game";
import { useLocale } from "../../i18n";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import PlayerAvatar from "./PlayerAvatar";

export default function PlayerBadges() {
  const { t } = useLocale();
  const { state, client } = useRoom();
  const { dealAnimating } = usePlayerAvatars();
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
        const isPendingExit = !isFinished && isStraggler(state, id);
        const isOut = isFinished || isPendingExit;
        const handCount = state.hands[id]?.length ?? 0;
        const countVisibleToOthers = state.cardCountVisible[id] ?? false;
        const showHandCount = !dealAnimating && !isOut && (isMe || countVisibleToOthers);

        return (
          <div key={id} className="flex min-w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <PlayerAvatar
              playerId={id}
              name={player.name}
              isTurn={isTurn && !isOut}
              isFinished={isOut}
              pendingExit={isPendingExit}
              showHandCount={showHandCount}
              handCount={handCount}
              finishRank={isFinished ? finishedIndex + 1 : undefined}
            />
            <span className="max-w-[72px] truncate text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
              {player.name}
              {isMe ? ` ${t("common.you")}` : ""}
            </span>
            {!player.connected && <span className="text-[10px] text-rose-500">{t("common.offline")}</span>}
          </div>
        );
      })}
    </div>
  );
}
