import { useEffect } from "react";
import { useRoom } from "../../lib/RoomContext";
import { PlayerAvatarProvider } from "../../lib/PlayerAvatarContext";
import { preloadSounds } from "../../lib/sounds";
import DealAnimation from "./DealAnimation";
import CenterPile from "./CenterPile";
import GameOverScreen from "./GameOverScreen";
import Hand from "./Hand";
import PlayerBadges from "./PlayerBadges";
import TurnBanner, { useHandSortMode } from "./TurnBanner";
import VettuBanner from "./VettuBanner";

export default function GameScreen({ dealAnimationSeed }: { dealAnimationSeed: number | null }) {
  const { state } = useRoom();
  const { sortMode, changeSortMode } = useHandSortMode();

  useEffect(() => {
    preloadSounds();
  }, []);

  return (
    <PlayerAvatarProvider>
      <div className="flex min-h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <PlayerBadges />
        <div className="flex min-h-0 flex-1 flex-col overflow-visible">
          <CenterPile />
        </div>
        <Hand sortMode={sortMode} />
        <TurnBanner sortMode={sortMode} onSortModeChange={changeSortMode} />
        <DealAnimation dealAnimationSeed={dealAnimationSeed} />
        {state.phase === "finished" && <GameOverScreen />}
        <VettuBanner />
      </div>
    </PlayerAvatarProvider>
  );
}
