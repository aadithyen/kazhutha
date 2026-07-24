import { useRoom } from "../../lib/RoomContext";
import CenterPile from "./CenterPile";
import GameOverScreen from "./GameOverScreen";
import Hand from "./Hand";
import PlayerBadges from "./PlayerBadges";
import TurnBanner from "./TurnBanner";

export default function GameScreen() {
  const { state } = useRoom();

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayerBadges />
      <TurnBanner />
      <div className="flex-1">
        <CenterPile />
      </div>
      <Hand />
      {state.phase === "finished" && <GameOverScreen />}
    </div>
  );
}
