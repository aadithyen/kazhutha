import { Card, isSameCard } from "@kazhutha/shared";
import { getLegalCards } from "@kazhutha/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

const CARD_WIDTH = 72;
const CARD_SPREAD = 34;
const MAX_ROTATION = 38;
const FAN_SWAY = 22;

function fanAngle(index: number, total: number, scrollBias: number): number {
  if (total <= 1) return scrollBias;
  const center = (total - 1) / 2;
  const spread = center || 1;
  return ((index - center) / spread) * MAX_ROTATION - scrollBias;
}

function fanLift(angle: number): number {
  return Math.abs(angle) * 0.35;
}

export default function Hand() {
  const { state, client } = useRoom();
  const [selected, setSelected] = useState<Card | null>(null);
  const [scrollBias, setScrollBias] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hand = state.hands[client.playerId] ?? [];
  const legalCards = getLegalCards(state, client.playerId);
  const myTurn = state.currentTurnId === client.playerId;

  const fanWidth = useMemo(() => {
    const spread = Math.max(hand.length - 1, 0) * CARD_SPREAD;
    const wing = CARD_WIDTH * 0.55;
    return Math.max(spread + CARD_WIDTH + wing * 2, typeof window !== "undefined" ? window.innerWidth : 360);
  }, [hand.length]);

  const updateScrollBias = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) {
      setScrollBias(0);
      return;
    }
    const progress = el.scrollLeft / max;
    setScrollBias((progress - 0.5) * 2 * FAN_SWAY);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    updateScrollBias();
  }, [hand.length, updateScrollBias]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollBias, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollBias);
  }, [updateScrollBias]);

  function handleTap(card: Card) {
    if (!myTurn) return;
    if (selected && isSameCard(selected, card)) {
      client.sendIntent({ type: "PlayCard", playerId: client.playerId, card });
      setSelected(null);
    } else {
      setSelected(card);
    }
  }

  if (hand.length === 0) {
    return <div className="h-[50vh] min-h-48 bg-white" />;
  }

  return (
    <section className="relative h-[50vh] min-h-48 shrink-0 bg-white">
      <div
        ref={scrollRef}
        className="hand-fan-scroll h-full overflow-x-auto overflow-y-hidden touch-pan-x"
        aria-label="Your hand — scroll horizontally to fan through cards"
      >
        <div className="relative mx-auto h-full" style={{ width: fanWidth, minWidth: "100%" }}>
          {hand.map((card, i) => {
            const legal = myTurn && legalCards.some((c) => isSameCard(c, card));
            const isSelected = !!selected && isSameCard(selected, card);
            const angle = fanAngle(i, hand.length, scrollBias);
            const lift = fanLift(angle);
            const center = (hand.length - 1) / 2;
            const left = fanWidth / 2 + (i - center) * CARD_SPREAD - CARD_WIDTH / 2;

            return (
              <div
                key={`${card.suit}${card.rank}-${i}`}
                className="absolute bottom-6 origin-bottom transition-transform duration-150 ease-out"
                style={{
                  left,
                  zIndex: isSelected ? hand.length + 1 : i,
                  transform: `rotate(${angle}deg) translateY(${lift}px)`,
                }}
              >
                <PlayingCard
                  card={card}
                  selected={isSelected}
                  disabled={!legal}
                  onClick={legal ? () => handleTap(card) : undefined}
                  size="lg"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
