import { useRef, useState } from "react";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";
import CardAnimations, { pileKey } from "./CardAnimations";

export default function CenterPile() {
  const { state } = useRoom();
  const pileCardRefs = useRef(new Map<string, HTMLDivElement>());
  const [hiddenPileKeys, setHiddenPileKeys] = useState<Set<string>>(() => new Set());

  return (
    <>
      <CardAnimations pileCardRefs={pileCardRefs} setHiddenPileKeys={setHiddenPileKeys} />
      <div className="flex flex-1 flex-wrap items-center justify-center gap-3 px-4 py-6">
        {state.centerPile.length === 0 ? (
          <span className="text-sm text-neutral-400">Play to the center</span>
        ) : (
          state.centerPile.map((played, i) => {
            const key = pileKey(played, i);
            const player = state.players.find((p) => p.id === played.playerId);
            const hidden = hiddenPileKeys.has(key);
            return (
              <div
                key={key}
                className={`flex flex-col items-center gap-1.5 transition-opacity duration-150 ${hidden ? "opacity-0" : "opacity-100"}`}
              >
                <div
                  ref={(el) => {
                    if (el) pileCardRefs.current.set(key, el);
                    else pileCardRefs.current.delete(key);
                  }}
                >
                  <PlayingCard card={played.card} size="md" />
                </div>
                <span className="text-[10px] text-neutral-400">{player?.name ?? "?"}</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
