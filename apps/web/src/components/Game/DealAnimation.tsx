import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEAL_FLY_SPREAD } from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import { playSound } from "../../lib/sounds";
import PlayingCard from "../PlayingCard";

const SHUFFLE_MS = 720;
const SPLIT_MS = 380;
const DEAL_FLY_MS = 160;
const DEAL_STAGGER_MS = 38;
const TOTAL_CARDS = 52;

let lastAnimatedDealSeed: number | null = null;

interface Point {
  x: number;
  y: number;
}

type Phase = "idle" | "shuffle" | "split" | "deal" | "done";

interface FlyingDealCard {
  key: string;
  start: Point;
  end: Point;
  delay: number;
  revealOnArrival: boolean;
}

interface SplitStack {
  playerId: string;
  start: Point;
  end: Point;
}

function DealFlyingCard({
  item,
  onArrive,
}: {
  item: FlyingDealCard;
  onArrive: (key: string, reveal: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let flyTimer: number | undefined;
    const delayTimer = window.setTimeout(() => {
      el.style.left = `${item.start.x}px`;
      el.style.top = `${item.start.y}px`;
      el.style.transform = "translate(-50%, -50%) scale(0.72)";
      el.style.opacity = "1";

      requestAnimationFrame(() => {
        el.style.transition = `left ${DEAL_FLY_MS}ms ease-out, top ${DEAL_FLY_MS}ms ease-out, transform ${DEAL_FLY_MS}ms ease-out, opacity ${DEAL_FLY_MS}ms ease-out`;
        el.style.left = `${item.end.x}px`;
        el.style.top = `${item.end.y}px`;
        el.style.transform = `translate(-50%, -50%) scale(${item.revealOnArrival ? 1 : 0.35})`;
        el.style.opacity = item.revealOnArrival ? "1" : "0.2";
      });

      flyTimer = window.setTimeout(() => onArrive(item.key, item.revealOnArrival), DEAL_FLY_MS);
    }, item.delay);

    return () => {
      window.clearTimeout(delayTimer);
      if (flyTimer !== undefined) window.clearTimeout(flyTimer);
    };
  }, [item, onArrive]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[55] will-change-[left,top,transform,opacity]"
      style={{ left: item.start.x, top: item.start.y, opacity: 0 }}
    >
      <PlayingCard faceDown size="sm" />
    </div>
  );
}

function SplitStackView({ stack, active }: { stack: SplitStack; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    el.style.left = `${stack.start.x}px`;
    el.style.top = `${stack.start.y}px`;
    el.style.transform = "translate(-50%, -50%) scale(0.9)";
    el.style.opacity = "0.95";

    const frame = requestAnimationFrame(() => {
      el.style.transition = `left ${SPLIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${SPLIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${SPLIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out`;
      el.style.left = `${stack.end.x}px`;
      el.style.top = `${stack.end.y}px`;
      el.style.transform = "translate(-50%, -50%) scale(0.55)";
    });

    return () => cancelAnimationFrame(frame);
  }, [stack, active]);

  if (!active) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[54]"
      style={{ left: stack.start.x, top: stack.start.y }}
    >
      <div className="relative h-[4.5rem] w-12">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }}
          >
            <PlayingCard faceDown size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ShuffleDeck({ center, active }: { center: Point; active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="deal-shuffle pointer-events-none fixed z-[54]"
      style={{ left: center.x, top: center.y }}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${i * 1.5 - 3}px, ${-i * 2}px) rotate(${(i - 2) * 2}deg)`,
          }}
        >
          <PlayingCard faceDown size="md" />
        </div>
      ))}
    </div>
  );
}

export default function DealAnimation({ dealAnimationSeed }: { dealAnimationSeed: number | null }) {
  const { state, client } = useRoom();
  const {
    getAvatarCenter,
    getHandTarget,
    getPileTarget,
    setDealAnimating,
    setRevealedHandCount,
  } = usePlayerAvatars();
  const [phase, setPhase] = useState<Phase>("idle");
  const [center, setCenter] = useState<Point | null>(null);
  const [splitStacks, setSplitStacks] = useState<SplitStack[]>([]);
  const [flying, setFlying] = useState<FlyingDealCard[]>([]);
  const timersRef = useRef<number[]>([]);
  const revealedRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const playerTarget = useCallback(
    (playerId: string): Point | null => {
      if (playerId === client.playerId) return getHandTarget();
      return getAvatarCenter(playerId);
    },
    [client.playerId, getAvatarCenter, getHandTarget],
  );

  const finishDeal = useCallback(() => {
    setFlying([]);
    setSplitStacks([]);
    setPhase("done");
    setDealAnimating(false);
    const myHand = state.hands[client.playerId]?.length ?? 0;
    setRevealedHandCount(myHand);
  }, [client.playerId, setDealAnimating, setRevealedHandCount, state.hands]);

  const startDeal = useCallback(
    (turnOrder: string[]) => {
      const pileCenter = getPileTarget();
      if (!pileCenter) return;

      const targets = new Map<string, Point>();
      for (const id of turnOrder) {
        const target = playerTarget(id);
        if (target) targets.set(id, target);
      }
      if (targets.size === 0) return;

      revealedRef.current = 0;
      setCenter(pileCenter);
      setDealAnimating(true);
      setRevealedHandCount(0);
      setPhase("shuffle");
      playSound("cardShuffle");

      schedule(() => {
        const stacks: SplitStack[] = turnOrder
          .map((playerId) => {
            const end = targets.get(playerId);
            if (!end) return null;
            return { playerId, start: pileCenter, end };
          })
          .filter((s): s is SplitStack => s !== null);
        setSplitStacks(stacks);
        setPhase("split");
      }, SHUFFLE_MS);

      schedule(() => {
        setPhase("deal");
        const items: FlyingDealCard[] = [];
        const cardsPerPlayer = Math.floor(TOTAL_CARDS / turnOrder.length);
        const dealtCount = new Map<string, number>();

        for (let i = 0; i < TOTAL_CARDS; i++) {
          const playerId = turnOrder[i % turnOrder.length];
          const target = targets.get(playerId);
          if (!target) continue;

          const playerDealt = dealtCount.get(playerId) ?? 0;
          dealtCount.set(playerId, playerDealt + 1);

          const isMe = playerId === client.playerId;
          const handOffset = isMe
            ? (playerDealt - (cardsPerPlayer - 1) / 2) * DEAL_FLY_SPREAD
            : (playerDealt % 3) * 3 - 3;

          items.push({
            key: `deal-${i}`,
            start: { ...pileCenter },
            end: {
              x: target.x + handOffset,
              y: target.y + (isMe ? 0 : 6),
            },
            delay: i * DEAL_STAGGER_MS,
            revealOnArrival: isMe,
          });
        }

        setFlying(items);

        items.forEach((item, index) => {
          if (index % turnOrder.length === 0 || index < 4) {
            schedule(() => playSound("cardDeal"), item.delay);
          }
        });

        const totalDealMs = (TOTAL_CARDS - 1) * DEAL_STAGGER_MS + DEAL_FLY_MS + 80;
        schedule(finishDeal, totalDealMs);
      }, SHUFFLE_MS + SPLIT_MS);
    },
    [
      client.playerId,
      finishDeal,
      getPileTarget,
      playerTarget,
      schedule,
      setDealAnimating,
      setRevealedHandCount,
    ],
  );

  useLayoutEffect(() => {
    if (dealAnimationSeed == null) return;
    if (lastAnimatedDealSeed === dealAnimationSeed) return;

    const turnOrder = state.turnOrder;
    if (turnOrder.length < 2) return;

    lastAnimatedDealSeed = dealAnimationSeed;
    setDealAnimating(true);
    setRevealedHandCount(0);

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => startDeal(turnOrder));
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimers();
    };
  }, [dealAnimationSeed, state.turnOrder, clearTimers, setDealAnimating, setRevealedHandCount, startDeal]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleArrive = useCallback(
    (key: string, reveal: boolean) => {
      if (reveal) {
        revealedRef.current += 1;
        setRevealedHandCount(revealedRef.current);
      }
      setFlying((items) => items.filter((item) => item.key !== key));
    },
    [setRevealedHandCount],
  );

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[53]" aria-hidden>
      {center && <ShuffleDeck center={center} active={phase === "shuffle"} />}
      {splitStacks.map((stack) => (
        <SplitStackView key={stack.playerId} stack={stack} active={phase === "split" || phase === "deal"} />
      ))}
      {flying.map((item) => (
        <DealFlyingCard key={item.key} item={item} onArrive={handleArrive} />
      ))}
    </div>
  );
}
