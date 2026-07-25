import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

export default function CenterPile() {
  const { state } = useRoom();

  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-3 px-4 py-6">
      {state.centerPile.length === 0 ? (
        <span className="font-serif text-sm italic text-neutral-400">Play to the center</span>
      ) : (
        state.centerPile.map((played, i) => {
          const player = state.players.find((p) => p.id === played.playerId);
          return (
            <div key={`${played.playerId}-${i}`} className="flex flex-col items-center gap-1.5">
              <PlayingCard card={played.card} size="md" />
              <span className="font-serif text-[10px] italic text-neutral-400">{player?.name ?? "?"}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
