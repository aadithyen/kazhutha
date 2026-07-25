import { useRoom } from "../../lib/RoomContext";
import { PlayerAvatarProvider } from "../../lib/PlayerAvatarContext";
import CenterPile from "./CenterPile";
import GameOverScreen from "./GameOverScreen";
import Hand from "./Hand";
import PlayerBadges from "./PlayerBadges";
import TurnBanner, { useHandSortMode } from "./TurnBanner";

export default function GameScreen() {
  const { state } = useRoom();
  const { sortMode, changeSortMode } = useHandSortMode();

  return (
    <PlayerAvatarProvider>
      <div className="flex min-h-dvh flex-col bg-white text-neutral-900">
        <PlayerBadges />
        <div className="flex min-h-0 flex-1 flex-col overflow-visible">
          <CenterPile />
        </div>
        <Hand sortMode={sortMode} />
        <TurnBanner sortMode={sortMode} onSortModeChange={changeSortMode} />
        {state.phase === "finished" && <GameOverScreen />}
      </div>
    </PlayerAvatarProvider>
  );
}
