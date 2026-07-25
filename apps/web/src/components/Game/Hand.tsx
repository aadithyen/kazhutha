import { Card, cardId, HandSortMode, isSameCard, sortHand } from "@kazhutha/shared";
import { getLegalCards } from "@kazhutha/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const FLY_DURATION_MS = 280;
const SNAPBACK_DURATION_MS = 180;

interface Point {
  x: number;
  y: number;
}

interface CardOverlay {
  card: Card;
  x: number;
  y: number;
  angle: number;
  phase: "drag" | "fly" | "snapback";
  selected: boolean;
}

function rectCenter(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function unitVectorToPile(from: Point, pile: Point): Point {
  const dx = pile.x - from.x;
  const dy = pile.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { x: dx / dist, y: dy / dist };
}

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
  const { registerHandTarget, getPileTarget } = usePlayerAvatars();
  const handTargetRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [selected, setSelected] = useState<Card | null>(null);
  const [scrollBias, setScrollBias] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<CardOverlay | null>(null);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    card: Card;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
    originX: number;
    originY: number;
    angle: number;
    selected: boolean;
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

  useEffect(() => {
    const handIds = new Set(hand.map(cardId));
    setPendingRemovalIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (handIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
    setOverlay((prev) => {
      if (!prev) return null;
      return handIds.has(cardId(prev.card)) ? prev : null;
    });
  }, [hand]);

  const beginFly = useCallback(
    (card: Card, from: Point, selectedForOverlay: boolean) => {
      const id = cardId(card);
      const pile = getPileTarget();
      const end = pile ?? { x: from.x, y: from.y - 420 };

      setSelected(null);
      setDragId(null);
      dragRef.current = null;
      setPendingRemovalIds((prev) => new Set(prev).add(id));
      setOverlay({
        card,
        x: from.x,
        y: from.y,
        angle: 0,
        phase: "drag",
        selected: selectedForOverlay,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOverlay({
            card,
            x: end.x,
            y: end.y,
            angle: 0,
            phase: "fly",
            selected: false,
          });
        });
      });

      window.setTimeout(() => {
        client.sendIntent({ type: "PlayCard", playerId: client.playerId, card });
      }, FLY_DURATION_MS);
    },
    [client, getPileTarget],
  );

  const playCard = useCallback(
    (card: Card) => {
      const cardEl = cardRefs.current.get(cardId(card));
      const from = cardEl
        ? rectCenter(cardEl.getBoundingClientRect())
        : { x: window.innerWidth / 2, y: window.innerHeight - 120 };
      beginFly(card, from, !!selected && isSameCard(selected, card));
    },
    [beginFly, selected],
  );

  function tapCard(card: Card) {
    if (!myTurn || overlay) return;
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

  function updateDragOverlay(dy: number) {
    const d = dragRef.current;
    if (!d) return;
    const pile = getPileTarget();
    const amount = -Math.min(dy, 0);
    let x = d.originX;
    let y = d.originY;
    if (pile) {
      const dir = unitVectorToPile({ x: d.originX, y: d.originY }, pile);
      x = d.originX + dir.x * amount;
      y = d.originY + dir.y * amount;
    } else {
      y = d.originY + Math.min(dy, 0);
    }
    setOverlay({
      card: d.card,
      x,
      y,
      angle: d.angle,
      phase: "drag",
      selected: d.selected,
    });
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    card: Card,
    legal: boolean,
    angle: number,
  ) {
    if (!legal || !myTurn || overlay) return;
    const origin = rectCenter(e.currentTarget.getBoundingClientRect());
    const isSelected = !!selected && isSameCard(selected, card);
    dragRef.current = {
      id: cardId(card),
      card,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
      originX: origin.x,
      originY: origin.y,
      angle,
      selected: isSelected,
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
      setDragId(d.id);
      updateDragOverlay(dy);
    }
  }

  function snapBackOverlay() {
    const d = dragRef.current;
    if (!d) {
      setOverlay(null);
      return;
    }
    setOverlay({
      card: d.card,
      x: d.originX,
      y: d.originY,
      angle: d.angle,
      phase: "snapback",
      selected: d.selected,
    });
    window.setTimeout(() => {
      setOverlay(null);
    }, SNAPBACK_DURATION_MS);
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (cancelled) {
      setDragId(null);
      snapBackOverlay();
      return;
    }
    const dy = e.clientY - d.startY;
    const shouldPlay = dy <= -SWIPE_DISTANCE || (dy <= -24 && d.velocity <= -SWIPE_VELOCITY);
    if (shouldPlay) {
      const pile = getPileTarget();
      const amount = -Math.min(dy, 0);
      let fromX = d.originX;
      let fromY = d.originY;
      if (pile) {
        const dir = unitVectorToPile({ x: d.originX, y: d.originY }, pile);
        fromX = d.originX + dir.x * amount;
        fromY = d.originY + dir.y * amount;
      } else {
        fromY = d.originY + Math.min(dy, 0);
      }
      beginFly(d.card, { x: fromX, y: fromY }, d.selected);
    } else if (!d.moved) {
      setDragId(null);
      setOverlay(null);
      tapCard(d.card);
    } else {
      setDragId(null);
      snapBackOverlay();
    }
  }

  const overlayPortal =
    overlay &&
    createPortal(
      <div
        className="pointer-events-none fixed z-50 will-change-[left,top,transform]"
        style={{
          left: overlay.x,
          top: overlay.y,
          transform: `translate(-50%, -50%) rotate(${overlay.phase === "fly" ? 0 : overlay.angle}deg)`,
          transition:
            overlay.phase === "drag"
              ? undefined
              : `left ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms ease-out, top ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms ease-out, transform ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms ease-out, opacity ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms ease-out`,
          opacity: overlay.phase === "fly" ? 0 : 1,
        }}
      >
        <PlayingCard card={overlay.card} selected={overlay.selected} size="lg" />
      </div>,
      document.body,
    );

  if (hand.length === 0) {
    return <div className="h-[45vh] min-h-52 bg-white" />;
  }

  return (
    <section className="relative h-[45vh] min-h-52 shrink-0 bg-white">
      {overlayPortal}
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
            const isDragSource = dragId === id;
            const isPendingRemoval = pendingRemovalIds.has(id);
            const isHidden = isDragSource || isPendingRemoval;
            const angle = fanAngle(i, hand.length, scrollBias);
            const lift = fanLift(angle);
            const center = (hand.length - 1) / 2;
            const left = fanWidth / 2 + (i - center) * CARD_SPREAD - CARD_WIDTH / 2;

            return (
              <div
                key={`${id}-${i}`}
                ref={(el) => {
                  if (el) cardRefs.current.set(id, el);
                  else cardRefs.current.delete(id);
                }}
                className={`absolute -bottom-8 origin-bottom ${
                  isHidden ? "opacity-0" : "transition-all duration-200 ease-out"
                }`}
                style={{
                  left,
                  zIndex: isSelected || isDragSource ? hand.length + 1 : i,
                  transform: `rotate(${angle}deg) translateY(${lift}px)`,
                  touchAction: legal ? "pan-x" : undefined,
                }}
                onPointerDown={(e) => handlePointerDown(e, card, legal, angle)}
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
