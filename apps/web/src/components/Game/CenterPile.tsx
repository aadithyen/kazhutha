import { useEffect, useRef, useState } from "react";
import { PlayedCard } from "@kazhutha/game";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useFlipAnimation } from "../../lib/useFlipAnimation";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";
import CardAnimations, { pileKey } from "./CardAnimations";

export default function CenterPile() {
  const { state, client } = useRoom();
  const { registerPileTarget, registerPlaySlotTarget, localFlyActive, pileSettling } = usePlayerAvatars();
  const pileAreaRef = useRef<HTMLDivElement>(null);
  const playSlotRef = useRef<HTMLDivElement>(null);
  const pileCardRefs = useRef(new Map<string, HTMLDivElement>());
  const [hiddenPileKeys, setHiddenPileKeys] = useState<Set<string>>(() => new Set());
  const [lingerPile, setLingerPile] = useState<PlayedCard[]>([]);
  const displayPile = state.centerPile.length > 0 ? state.centerPile : lingerPile;
  const myTurn = state.phase === "playing" && state.currentTurnId === client.playerId;
  const showPlaySlot = (myTurn || localFlyActive) && !pileSettling;

  useEffect(() => {
    registerPileTarget(pileAreaRef.current);
    return () => registerPileTarget(null);
  }, [registerPileTarget]);

  useEffect(() => {
    registerPlaySlotTarget(showPlaySlot ? playSlotRef.current : null);
    return () => registerPlaySlotTarget(null);
  }, [registerPlaySlotTarget, showPlaySlot, displayPile.length]);

  useFlipAnimation(pileAreaRef, [displayPile, showPlaySlot, hiddenPileKeys]);

  return (
    <>
      <CardAnimations
        pileCardRefs={pileCardRefs}
        setHiddenPileKeys={setHiddenPileKeys}
        lingerPile={lingerPile}
        setLingerPile={setLingerPile}
      />
      <div
        ref={pileAreaRef}
        className="flex flex-1 flex-wrap items-center justify-center gap-3 overflow-visible px-4 py-6"
      >
        {displayPile.length === 0 && !showPlaySlot ? (
          <span className="text-sm text-neutral-400">Play to the center</span>
        ) : (
          displayPile.map((played, i) => {
            const key = pileKey(played, i);
            const player = state.players.find((p) => p.id === played.playerId);
            const hidden = hiddenPileKeys.has(key);
            return (
              <div
                key={key}
                data-flip-key={key}
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
        {showPlaySlot && (
          <div
            data-flip-key="play-slot"
            className="flex flex-col items-center gap-1.5"
            aria-hidden={!myTurn}
          >
            <div
              ref={playSlotRef}
              className="flex h-[6.75rem] w-[4.75rem] items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/90 shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)] transition-[border-color,background-color,box-shadow] duration-200"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Play</span>
            </div>
            <span className="text-[10px] text-neutral-400">Your card</span>
          </div>
        )}
      </div>
    </>
  );
}
