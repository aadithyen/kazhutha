import { Card } from "@kazhutha/shared";
import { PlayedCard } from "@kazhutha/game";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

const FLY_DURATION_MS = 420;
const FOLD_DURATION_MS = 480;
export const ROUND_LINGER_MS = 3000;

interface Point {
  x: number;
  y: number;
}

interface FlyingCard {
  key: string;
  card: Card;
  start: Point;
  end: Point;
  faceDown: boolean;
  scaleEnd: number;
  duration: number;
  hidePileKey?: string;
}

export function pileKey(played: PlayedCard, index: number): string {
  return `${played.playerId}-${played.card.suit}${played.card.rank}-${index}`;
}

function rectCenter(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function AnimatedCard({
  item,
  onDone,
}: {
  item: FlyingCard;
  onDone: (hidePileKey?: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.left = `${item.start.x}px`;
    el.style.top = `${item.start.y}px`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.opacity = "1";

    const frame = requestAnimationFrame(() => {
      el.style.transition = `left ${item.duration}ms ease-out, top ${item.duration}ms ease-out, transform ${item.duration}ms ease-out, opacity ${item.duration}ms ease-out`;
      el.style.left = `${item.end.x}px`;
      el.style.top = `${item.end.y}px`;
      el.style.transform = `translate(-50%, -50%) rotateX(${item.faceDown ? 180 : 0}deg) scale(${item.scaleEnd})`;
      el.style.opacity = item.faceDown ? "0" : item.hidePileKey ? "0" : "0.85";
    });

    const timer = window.setTimeout(() => onDone(item.hidePileKey), item.duration);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [item, onDone]);

  return (
    <div ref={ref} className="card-flight pointer-events-none fixed z-50 will-change-[left,top,transform,opacity]">
      <PlayingCard card={item.card} size="md" />
    </div>
  );
}

export default function CardAnimations({
  pileCardRefs,
  setHiddenPileKeys,
  lingerPile,
  setLingerPile,
}: {
  pileCardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  setHiddenPileKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  lingerPile: PlayedCard[];
  setLingerPile: React.Dispatch<React.SetStateAction<PlayedCard[]>>;
}) {
  const { state, client } = useRoom();
  const { getAvatarCenter, getHandTarget } = usePlayerAvatars();
  const [flying, setFlying] = useState<FlyingCard[]>([]);
  const prevPileRef = useRef(state.centerPile);
  const lastPositionsRef = useRef<Map<string, DOMRect>>(new Map());
  const pendingPlayInRef = useRef<PlayedCard[]>([]);
  const lingerTimerRef = useRef<number | null>(null);

  function addHiddenKeys(keys: string[]) {
    if (keys.length === 0) return;
    setHiddenPileKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function removeHiddenKey(key?: string) {
    if (!key) return;
    setHiddenPileKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  useLayoutEffect(() => {
    const pile = state.centerPile.length > 0 ? state.centerPile : lingerPile;
    if (pile.length === 0) return;
    const positions = new Map<string, DOMRect>();
    pile.forEach((played, i) => {
      const key = pileKey(played, i);
      const el = pileCardRefs.current.get(key);
      if (el) positions.set(key, el.getBoundingClientRect());
    });
    if (positions.size > 0) {
      lastPositionsRef.current = positions;
    }
  }, [state.centerPile, lingerPile, pileCardRefs]);

  useEffect(() => {
    const prev = prevPileRef.current;
    const curr = state.centerPile;

    if (curr.length > prev.length) {
      pendingPlayInRef.current = curr.slice(prev.length);
    }

    if (curr.length > 0) {
      setLingerPile([]);
      if (lingerTimerRef.current !== null) {
        window.clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    }

    if (prev.length > 0 && curr.length === 0) {
      const result = state.lastRoundResult;

      if (result?.kind === "vettu" && result.collectorId) {
        const collectorId = result.collectorId;
        const isMe = collectorId === client.playerId;
        const target = isMe ? getHandTarget() : getAvatarCenter(collectorId);
        const positions = lastPositionsRef.current;
        const items: FlyingCard[] = [];
        if (target) {
          prev.forEach((played, i) => {
            const key = pileKey(played, i);
            const rect = positions.get(key);
            if (!rect) return;
            items.push({
              key: `collect-${key}`,
              card: played.card,
              start: rectCenter(rect),
              end: target,
              faceDown: false,
              scaleEnd: isMe ? 0.55 : 0.3,
              duration: FLY_DURATION_MS,
            });
          });
        }
        if (items.length > 0) {
          setFlying((f) => [...f, ...items]);
        }
      } else if (result?.kind === "normal") {
        setLingerPile(prev);
        lingerTimerRef.current = window.setTimeout(() => {
          lingerTimerRef.current = null;
          setLingerPile([]);
          const items: FlyingCard[] = [];
          prev.forEach((played, i) => {
            const key = pileKey(played, i);
            const el = pileCardRefs.current.get(key);
            const rect = el?.getBoundingClientRect();
            if (!rect) return;
            const center = rectCenter(rect);
            items.push({
              key: `fold-${key}`,
              card: played.card,
              start: center,
              end: { x: center.x, y: -120 },
              faceDown: true,
              scaleEnd: 0.4,
              duration: FOLD_DURATION_MS,
            });
          });
          if (items.length > 0) {
            setFlying((f) => [...f, ...items]);
          }
        }, ROUND_LINGER_MS);
      }
    }

    prevPileRef.current = curr;
  }, [state.centerPile, state.lastRoundResult, client.playerId, getAvatarCenter, getHandTarget, pileCardRefs, setLingerPile]);

  useEffect(() => {
    return () => {
      if (lingerTimerRef.current !== null) {
        window.clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const pending = pendingPlayInRef.current;
    if (pending.length === 0) return;
    pendingPlayInRef.current = [];

    const items: FlyingCard[] = [];
    const hiddenKeys: string[] = [];
    const startIndex = state.centerPile.length - pending.length;

    pending.forEach((played, offset) => {
      if (played.playerId === client.playerId) return;
      const pileIndex = startIndex + offset;
      const key = pileKey(played, pileIndex);
      const pileEl = pileCardRefs.current.get(key);
      const from = getAvatarCenter(played.playerId);
      if (!pileEl || !from) return;
      const to = rectCenter(pileEl.getBoundingClientRect());
      hiddenKeys.push(key);
      items.push({
        key: `playin-${key}`,
        card: played.card,
        start: from,
        end: to,
        faceDown: false,
        scaleEnd: 1,
        duration: FLY_DURATION_MS,
        hidePileKey: key,
      });
    });

    if (hiddenKeys.length > 0) {
      addHiddenKeys(hiddenKeys);
    }
    if (items.length > 0) {
      setFlying((f) => [...f, ...items]);
    }
  }, [state.centerPile, client.playerId, getAvatarCenter, pileCardRefs]);

  function removeFlying(key: string, hidePileKey?: string) {
    setFlying((f) => f.filter((item) => item.key !== key));
    removeHiddenKey(hidePileKey);
  }

  if (flying.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      {flying.map((item) => (
        <AnimatedCard
          key={item.key}
          item={item}
          onDone={(hidePileKey) => removeFlying(item.key, hidePileKey)}
        />
      ))}
    </div>
  );
}
