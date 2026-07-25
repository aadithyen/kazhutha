import { HandSortMode, SUIT_SYMBOLS } from "@kazhutha/shared";
import { useState } from "react";
import { getHandSortMode, getSoundMuted, storeHandSortMode, storeSoundMuted } from "../../lib/preferences";
import { useRoom } from "../../lib/RoomContext";
import HandPreferences from "./HandPreferences";

interface Props {
  sortMode: HandSortMode;
  onSortModeChange: (mode: HandSortMode) => void;
}

export default function TurnBanner({ sortMode, onSortModeChange }: Props) {
  const { state, client } = useRoom();
  const { soundMuted, changeSoundMuted } = useSoundMuted();
  const turnPlayer = state.players.find((p) => p.id === state.currentTurnId);
  const isMyTurn = state.currentTurnId === client.playerId;
  const myCountVisible = state.cardCountVisible[client.playerId] ?? false;
  const showCountToggle = state.phase === "playing" && !state.finishedPlayers.includes(client.playerId);

  function changeCountVisible(visible: boolean) {
    client.sendIntent({
      type: "SetCardCountVisible",
      playerId: client.playerId,
      visible,
    });
  }

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-neutral-100 px-4 py-2 text-sm">
      <span className={`font-semibold ${isMyTurn ? "text-neutral-900" : "text-neutral-500"}`}>
        {isMyTurn ? "Your turn" : turnPlayer ? `${turnPlayer.name}'s turn` : "Waiting…"}
      </span>
      <span className="flex items-center gap-2 text-neutral-400">
        {state.leadSuit && <span>Lead: {SUIT_SYMBOLS[state.leadSuit]}</span>}
        <HandPreferences
          sortMode={sortMode}
          onSortModeChange={onSortModeChange}
          countVisible={myCountVisible}
          onCountVisibleChange={changeCountVisible}
          showCountToggle={showCountToggle}
          soundMuted={soundMuted}
          onSoundMutedChange={changeSoundMuted}
        />
      </span>
    </div>
  );
}

export function useHandSortMode() {
  const [sortMode, setSortMode] = useState<HandSortMode>(() => getHandSortMode());

  function changeSortMode(mode: HandSortMode) {
    setSortMode(mode);
    storeHandSortMode(mode);
  }

  return { sortMode, changeSortMode };
}

export function useSoundMuted() {
  const [soundMuted, setSoundMuted] = useState(() => getSoundMuted());

  function changeSoundMuted(muted: boolean) {
    setSoundMuted(muted);
    storeSoundMuted(muted);
  }

  return { soundMuted, changeSoundMuted };
}
