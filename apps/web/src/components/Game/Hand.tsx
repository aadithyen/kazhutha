import { Card, cardId, HandSortMode, isSameCard, sortHand } from "@kazhutha/shared";
import { getLegalCards } from "@kazhutha/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CARD_LG,
  clampOverlayPosition,
  PILE_CARD_SCALE,
  rectCenter,
  unitVectorToPile,
} from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { getHandSortMode, storeHandSortMode } from "../../lib/preferences";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

const CARD_WIDTH = CARD_LG.width;
const CARD_SPREAD = 54;
const MAX_ROTATION = 32;
const FAN_SWAY = 18;
/** Dragged this far up (px) releases the card onto the pile. */
const SWIPE_DISTANCE = 70;
/** A quick upward flick (px/ms) plays even before reaching SWIPE_DISTANCE. */
const SWIPE_VELOCITY = 0.55;
const FLY_DURATION_MS = 320;
const SNAPBACK_DURATION_MS = 200;

interface CardOverlay {
  card: Card;
  x: number;
  y: number;
  angle: number;
  scale: number;
  phase: "drag" | "fly" | "snapback";
  selected: boolean;
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
  const { registerHandTarget, getPlaySlotTarget, setLocalFlyActive } = usePlayerAvatars();
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
      if (!handIds.has(cardId(prev.card))) {
        setLocalFlyActive(false);
        return null;
      }
      if (prev.phase === "fly") {
        const onPile = state.centerPile.some(
          (played) => played.playerId === client.playerId && isSameCard(played.card, prev.card),
        );
        if (onPile) {
          setLocalFlyActive(false);
          return null;
        }
      }
      return prev;
    });
  }, [hand, state.centerPile, client.playerId, setLocalFlyActive]);

  const beginFly = useCallback(
    (card: Card, from: { x: number; y: number }, selectedForOverlay: boolean) => {
      const id = cardId(card);
      const slot = getPlaySlotTarget();
      const end = slot ?? { x: from.x, y: from.y - 420 };

      setSelected(null);
      setDragId(null);
      dragRef.current = null;
      setPendingRemovalIds((prev) => new Set(prev).add(id));
      setLocalFlyActive(true);
      setOverlay({
        card,
        x: from.x,
        y: from.y,
        angle: 0,
        scale: 1,
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
            scale: PILE_CARD_SCALE,
            phase: "fly",
            selected: false,
          });
        });
      });

      window.setTimeout(() => {
        client.sendIntent({ type: "PlayCard", playerId: client.playerId, card });
      }, FLY_DURATION_MS);
    },
    [client, getPlaySlotTarget, setLocalFlyActive],
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
    const slot = getPlaySlotTarget();
    const amount = -Math.min(dy, 0);
    const progress = Math.min(amount / SWIPE_DISTANCE, 1);
    const dragAngle = d.angle * (1 - progress);
    let x = d.originX;
    let y = d.originY;
    if (slot) {
      const dir = unitVectorToPile({ x: d.originX, y: d.originY }, slot);
      x = d.originX + dir.x * amount;
      y = d.originY + dir.y * amount;
    } else {
      y = d.originY + Math.min(dy, 0);
    }
    const scale = 1 - (1 - PILE_CARD_SCALE) * progress;
    const clamped = clampOverlayPosition(x, y, dragAngle, CARD_LG.width * scale, CARD_LG.height * scale);
    setOverlay({
      card: d.card,
      x: clamped.x,
      y: clamped.y,
      angle: dragAngle,
      scale,
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
      scale: 1,
      phase: "snapback",
      selected: d.selected,
    });
    window.setTimeout(() => {
      setOverlay(null);
      setLocalFlyActive(false);
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
      const slot = getPlaySlotTarget();
      const amount = -Math.min(dy, 0);
      let fromX = d.originX;
      let fromY = d.originY;
      if (slot) {
        const dir = unitVectorToPile({ x: d.originX, y: d.originY }, slot);
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
        className="pointer-events-none fixed z-[60] will-change-[left,top,transform,opacity]"
        style={{
          left: overlay.x,
          top: overlay.y,
          transform: `translate(-50%, -50%) rotate(${overlay.phase === "fly" ? 0 : overlay.angle}deg) scale(${overlay.scale})`,
          transition:
            overlay.phase === "drag"
              ? undefined
              : `left ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${overlay.phase === "fly" ? FLY_DURATION_MS : SNAPBACK_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease-out`,
          opacity: overlay.phase === "fly" ? 0.98 : 1,
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
    <section className="relative h-[45vh] min-h-52 shrink-0 overflow-visible bg-white">
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
        className="hand-fan-scroll h-full overflow-x-auto overflow-y-visible touch-pan-x pt-6"
        aria-label="Your hand — scroll horizontally to fan through cards"
      >
        <div className="relative mx-auto h-full" style={{ width: fanWidth, minWidth: "100%" }}>
          {hand.map((card, i) => {
            const id = cardId(card);
            const legal = myTurn && legalCards.some((c) => isSameCard(c, card));
            const isSelected = !!selected && isSameCard(selected, card);
            const isDragSource = dragId === id;
            const isPendingRemoval = pendingRemovalIds.has(id);
            const isHidden = isPendingRemoval;
            const angle = fanAngle(i, hand.length, scrollBias);
            const lift = fanLift(angle);
            const center = (hand.length - 1) / 2;
            const left = fanWidth / 2 + (i - center) * CARD_SPREAD - CARD_WIDTH / 2;

            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) cardRefs.current.set(id, el);
                  else cardRefs.current.delete(id);
                }}
                className={`absolute -bottom-8 origin-bottom transition-[left,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isHidden ? "pointer-events-none opacity-0" : ""
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
                {isDragSource ? (
                  <div
                    className="flex h-[10rem] w-[7rem] items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300/80 bg-neutral-50/60"
                    aria-hidden
                  />
                ) : (
                  <PlayingCard
                    card={card}
                    selected={isSelected}
                    disabled={!legal}
                    onClick={legal ? () => handleClick(card) : undefined}
                    size="lg"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
