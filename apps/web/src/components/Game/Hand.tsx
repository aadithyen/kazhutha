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
import HandPreferences from "./HandPreferences";

const CARD_WIDTH = CARD_LG.width;
const CARD_SPREAD = 60;
const MAX_ROTATION = 32;
const FAN_SWAY = 18;
/** Dragged this far up (px) releases the card onto the pile. */
const SWIPE_DISTANCE = 70;
/** A quick upward flick (px/ms) plays even before reaching SWIPE_DISTANCE. */
const SWIPE_VELOCITY = 0.55;
const FLY_DURATION_MS = 320;
const SNAPBACK_DURATION_MS = 200;
const GESTURE_LOCK_PX = 8;

type GestureMode = "pending" | "scroll" | "drag";

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
  const [isScrolling, setIsScrolling] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<CardOverlay | null>(null);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragRef = useRef<{
    id: string;
    card: Card;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
    mode: GestureMode;
    originX: number;
    originY: number;
    angle: number;
    selected: boolean;
    target: HTMLDivElement | null;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [sortMode, setSortMode] = useState<HandSortMode>(() => getHandSortMode());
  const rawHand = state.hands[client.playerId] ?? [];
  const hand = useMemo(() => sortHand(rawHand, sortMode), [rawHand, sortMode]);
  const legalCards = getLegalCards(state, client.playerId);
  const myTurn = state.currentTurnId === client.playerId;

  const myCountVisible = state.cardCountVisible[client.playerId] ?? false;
  const showCountToggle = state.phase === "playing" && !state.finishedPlayers.includes(client.playerId);

  function changeCountVisible(visible: boolean) {
    client.sendIntent({
      type: "SetCardCountVisible",
      playerId: client.playerId,
      visible,
    });
  }

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
    setIsScrolling(true);
    clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => setIsScrolling(false), 120);
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
    const preventTouchScroll = (e: TouchEvent) => {
      if (dragRef.current?.mode === "drag") e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventTouchScroll);
  }, []);

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

  function resetDragTarget(target: HTMLDivElement | null) {
    if (target) target.style.touchAction = "";
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
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
      mode: "pending",
      originX: origin.x,
      originY: origin.y,
      angle,
      selected: isSelected,
      target: e.currentTarget,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;

    if (d.mode === "pending") {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) < GESTURE_LOCK_PX && Math.abs(dy) < GESTURE_LOCK_PX) return;

      if (Math.abs(dx) >= Math.abs(dy)) {
        d.mode = "scroll";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (dy < 0) {
        d.mode = "drag";
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.style.touchAction = "none";
      } else {
        dragRef.current = null;
        return;
      }
    }

    if (d.mode === "scroll") {
      const dx = e.clientX - d.lastX;
      const el = scrollRef.current;
      if (el) {
        el.scrollLeft -= dx;
        updateScrollBias();
      }
      d.lastX = e.clientX;
      return;
    }

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      d.velocity = (e.clientY - d.lastY) / dt;
    }
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > GESTURE_LOCK_PX) {
      d.moved = true;
      setDragId(d.id);
      updateDragOverlay(dy);
    }
  }

  function snapBackOverlay(from?: NonNullable<typeof dragRef.current>) {
    const d = from ?? dragRef.current;
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
    const target = d.target;
    if (target?.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    resetDragTarget(target);
    if (d.mode === "scroll") {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (cancelled) {
      setDragId(null);
      if (d.mode === "drag") snapBackOverlay(d);
      return;
    }
    if (d.mode === "pending") {
      setDragId(null);
      tapCard(d.card);
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
      snapBackOverlay(d);
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
    return <div className="h-[52vh] min-h-60 bg-white" />;
  }

  return (
    <section className="relative h-[52vh] min-h-60 shrink-0 overflow-hidden bg-white">
      {overlayPortal}
      <HandPreferences
        sortMode={sortMode}
        onSortModeChange={changeSortMode}
        countVisible={myCountVisible}
        onCountVisibleChange={changeCountVisible}
        showCountToggle={showCountToggle}
      />
      <div ref={handTargetRef} className="pointer-events-none absolute inset-x-0 top-8 h-1" aria-hidden />
      <div
        ref={scrollRef}
        className="hand-fan-scroll h-full select-none overflow-x-auto overflow-y-hidden touch-pan-x pt-3"
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
                className={`absolute -bottom-8 origin-bottom ${
                  isScrolling ? "" : "transition-[left,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                } ${isHidden ? "pointer-events-none opacity-0" : ""}`}
                style={{
                  left,
                  zIndex: isSelected || isDragSource ? hand.length + 1 : i,
                  transform: `rotate(${angle}deg) translateY(${lift}px)`,
                }}
                onPointerDown={(e) => handlePointerDown(e, card, legal, angle)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerEnd(e, false)}
                onPointerCancel={(e) => handlePointerEnd(e, true)}
              >
                {isDragSource ? (
                  <div
                    className="flex h-[12rem] w-[8.4rem] items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300/80 bg-neutral-50/60"
                    aria-hidden
                  />
                ) : (
                  <div className="pointer-events-none">
                    <PlayingCard card={card} selected={isSelected} disabled={!legal} size="lg" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
