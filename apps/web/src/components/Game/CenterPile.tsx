import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

export default function CenterPile() {
  const { state } = useRoom();

  return (
    <div className="flex min-h-32 flex-wrap items-center justify-center gap-2 py-4">
      {state.centerPile.length === 0 ? (
        <span className="text-sm text-slate-500">Center pile</span>
      ) : (
        state.centerPile.map((played, i) => {
          const player = state.players.find((p) => p.id === played.playerId);
          return (
            <div key={`${played.playerId}-${i}`} className="flex flex-col items-center gap-1">
              <PlayingCard card={played.card} size="sm" />
              <span className="text-[10px] text-slate-400">{player?.name ?? "?"}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
