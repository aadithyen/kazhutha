import { Card, cardId, HandSortMode, isSameCard, sortHand } from "@kazhutha/shared";
import { getLegalCards } from "@kazhutha/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { getHandSortMode, storeHandSortMode } from "../../lib/preferences";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

const CARD_WIDTH = 112;
const CARD_SPREAD = 54;
const MAX_ROTATION = 32;
const FAN_SWAY = 18;
/** Dragged this far up (px) releases the card onto the pile. */
const SWIPE_DISTANCE = 70;
/** A quick upward flick (px/ms) plays even before reaching SWIPE_DISTANCE. */
const SWIPE_VELOCITY = 0.55;
const FLY_DURATION_MS = 220;

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
  const { registerHandTarget } = usePlayerAvatars();
  const handTargetRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [scrollBias, setScrollBias] = useState(0);
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const [flying, setFlying] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    card: Card;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [sortMode, setSortMode] = useState<HandSortMode>(() => getHandSortMode());
  const rawHand = state.hands[client.playerId] ?? [];
  const hand = useMemo(() => sortHand(rawHand, sortMode), [rawHand, sortMode]);
  const legalCards = getLegalCards(state, client.playerId);
  const myTurn = state.currentTurnId === client.playerId;

  function changeSortMode(mode: HandSortMode) {
    setSortMode(mode);
    storeHandSortMode(mode);
  }

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

  useEffect(() => {
    registerHandTarget(handTargetRef.current);
    return () => registerHandTarget(null);
  }, [registerHandTarget, hand.length]);

  const playCard = useCallback(
    (card: Card) => {
      setSelected(null);
      setDrag(null);
      setFlying(cardId(card));
      window.setTimeout(() => {
        client.sendIntent({ type: "PlayCard", playerId: client.playerId, card });
        setFlying(null);
      }, FLY_DURATION_MS);
    },
    [client],
  );

  function tapCard(card: Card) {
    if (!myTurn || flying) return;
    if (selected && isSameCard(selected, card)) {
      playCard(card);
    } else {
      setSelected(card);
    }
  }

  function handleClick(card: Card) {
    if (suppressClickRef.current) return;
    tapCard(card);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, card: Card, legal: boolean) {
    if (!legal || !myTurn || flying) return;
    dragRef.current = {
      id: cardId(card),
      card,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      d.velocity = (e.clientY - d.lastY) / dt;
    }
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 8) {
      d.moved = true;
    }
    setDrag({ id: d.id, dy: Math.min(dy, 0) });
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // Pointer capture retargets the derived click event to the wrapper, so the
    // card button's onClick never fires; handle both tap and swipe here and
    // swallow any click that does slip through.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (cancelled) {
      setDrag(null);
      return;
    }
    const dy = e.clientY - d.startY;
    const shouldPlay = dy <= -SWIPE_DISTANCE || (dy <= -24 && d.velocity <= -SWIPE_VELOCITY);
    if (shouldPlay) {
      playCard(d.card);
    } else if (!d.moved) {
      setDrag(null);
      tapCard(d.card);
    } else {
      setDrag(null);
    }
  }

  if (hand.length === 0) {
    return <div className="h-[45vh] min-h-52 bg-white" />;
  }

  return (
    <section className="relative h-[45vh] min-h-52 shrink-0 bg-white">
      <div className="absolute inset-x-0 top-2 z-10 flex justify-center">
        <div
          className="inline-flex rounded-full border border-neutral-200 bg-white/90 p-0.5 text-[11px] shadow-sm backdrop-blur-sm"
          role="group"
          aria-label="Hand sort order"
        >
          {(["suit", "value"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeSortMode(mode)}
              aria-pressed={sortMode === mode}
              className={`rounded-full px-3 py-1 capitalize transition-colors ${
                sortMode === mode
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div ref={handTargetRef} className="pointer-events-none absolute inset-x-0 top-8 h-1" aria-hidden />
      <div
        ref={scrollRef}
        className="hand-fan-scroll h-full overflow-x-auto overflow-y-hidden touch-pan-x"
        aria-label="Your hand — scroll horizontally to fan through cards"
      >
        <div className="relative mx-auto h-full" style={{ width: fanWidth, minWidth: "100%" }}>
          {hand.map((card, i) => {
            const id = cardId(card);
            const legal = myTurn && legalCards.some((c) => isSameCard(c, card));
            const isSelected = !!selected && isSameCard(selected, card);
            const isDragging = drag?.id === id;
            const isFlying = flying === id;
            const angle = fanAngle(i, hand.length, scrollBias);
            const lift = fanLift(angle);
            const center = (hand.length - 1) / 2;
            const left = fanWidth / 2 + (i - center) * CARD_SPREAD - CARD_WIDTH / 2;
            const dy = isFlying ? -420 : isDragging ? drag.dy : 0;

            return (
              <div
                key={`${id}-${i}`}
                className={`absolute -bottom-8 origin-bottom ${
                  isDragging ? "" : "transition-all duration-200 ease-out"
                }`}
                style={{
                  left,
                  zIndex: isSelected || isDragging || isFlying ? hand.length + 1 : i,
                  transform: `rotate(${isFlying ? 0 : angle}deg) translateY(${lift + dy}px)`,
                  opacity: isFlying ? 0 : 1,
                  touchAction: legal ? "pan-x" : undefined,
                }}
                onPointerDown={(e) => handlePointerDown(e, card, legal)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerEnd(e, false)}
                onPointerCancel={(e) => handlePointerEnd(e, true)}
              >
                <PlayingCard
                  card={card}
                  selected={isSelected}
                  disabled={!legal}
                  onClick={legal ? () => handleClick(card) : undefined}
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
