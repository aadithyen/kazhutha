import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEAL_FLY_SPREAD } from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import { playSound } from "../../lib/sounds";
import PlayingCard from "../PlayingCard";

const GATHER_MS = 360;
const SPLIT_MS = 320;
const WEAVE_MS = 520;
const WEAVE_STAGGER_MS = 36;
const SQUARE_MS = 240;
const RIFFLE_PASSES = 2;
const DEAL_FLY_MS = 180;
const DEAL_STAGGER_MS = 38;
const TOTAL_CARDS = 52;
const SHUFFLE_CARD_COUNT = 10;

/** One full riffle pass: split + staggered weave. */
const RIFFLE_PASS_MS = SPLIT_MS + WEAVE_MS + (SHUFFLE_CARD_COUNT / 2) * WEAVE_STAGGER_MS;

let lastAnimatedDealSeed: number | null = null;

interface Point {
  x: number;
  y: number;
}

type Phase = "idle" | "shuffle" | "deal" | "done";

interface FlyingDealCard {
  key: string;
  start: Point;
  end: Point;
  delay: number;
  revealOnArrival: boolean;
  rot: number;
}

interface ShuffleCardPose {
  x: number;
  y: number;
  rot: number;
  z: number;
  scale: number;
  opacity: number;
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
      el.style.transform = `translate(-50%, -50%) scale(0.78) rotate(${item.rot}deg)`;
      el.style.opacity = "1";

      requestAnimationFrame(() => {
        el.style.transition = `left ${DEAL_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${DEAL_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${DEAL_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${DEAL_FLY_MS}ms ease-out`;
        el.style.left = `${item.end.x}px`;
        el.style.top = `${item.end.y}px`;
        el.style.transform = `translate(-50%, -50%) scale(${item.revealOnArrival ? 1 : 0.32}) rotate(0deg)`;
        el.style.opacity = item.revealOnArrival ? "1" : "0.15";
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

function initialPoses(): ShuffleCardPose[] {
  return Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => ({
    x: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.4,
    y: -i * 1.5,
    rot: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.1,
    z: i,
    scale: 1,
    opacity: 0,
  }));
}

/** JS-driven riffle: explicit poses — no CSS-variable keyframes. */
function RiffleShuffle({
  center,
  active,
  schedule,
}: {
  center: Point;
  active: boolean;
  schedule: (fn: () => void, ms: number) => void;
}) {
  const [poses, setPoses] = useState<ShuffleCardPose[]>(initialPoses);
  const runIdRef = useRef(0);

  useLayoutEffect(() => {
    if (!active) return;

    const runId = ++runIdRef.current;
    const still = () => runIdRef.current === runId;

    // Gather — cards drop into a messy stack
    setPoses(
      Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => ({
        x: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.6,
        y: 36 - i * 1.4,
        rot: (i - 4) * 3,
        z: i,
        scale: 0.86,
        opacity: 0,
      })),
    );

    schedule(() => {
      if (!still()) return;
      setPoses(
        Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => ({
          x: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.2,
          y: -i * 1.6,
          rot: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.2,
          z: i,
          scale: 1,
          opacity: 1,
        })),
      );
    }, 30);

    let t = GATHER_MS;

    for (let pass = 0; pass < RIFFLE_PASSES; pass++) {
      const passStart = t;

      // Split into left / right packets
      schedule(() => {
        if (!still()) return;
        setPoses(
          Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => {
            const left = i % 2 === 0;
            const stack = Math.floor(i / 2);
            return {
              x: left ? -78 - stack * 2 : 78 + stack * 2,
              y: -8 - stack * 2.4,
              rot: left ? -18 - stack * 0.8 : 18 + stack * 0.8,
              z: stack + (left ? 0 : 5),
              scale: 1,
              opacity: 1,
            };
          }),
        );
      }, passStart);

      // Weave: alternate cards flush back to center, staggered
      for (let i = 0; i < SHUFFLE_CARD_COUNT; i++) {
        const weaveDelay = passStart + SPLIT_MS + i * WEAVE_STAGGER_MS;
        schedule(() => {
          if (!still()) return;
          setPoses((prev) =>
            prev.map((pose, idx) => {
              if (idx > i) return pose;
              const left = idx % 2 === 0;
              return {
                x: (idx - (SHUFFLE_CARD_COUNT - 1) / 2) * 1.1 + (left ? -1 : 1),
                y: -idx * 1.7,
                rot: (idx - (SHUFFLE_CARD_COUNT - 1) / 2) * 0.9,
                z: idx,
                scale: 1,
                opacity: 1,
              };
            }),
          );
        }, weaveDelay);
      }

      t = passStart + RIFFLE_PASS_MS;
    }

    // Square up
    schedule(() => {
      if (!still()) return;
      setPoses(
        Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => ({
          x: (i - (SHUFFLE_CARD_COUNT - 1) / 2) * 0.6,
          y: -i * 1.1,
          rot: 0,
          z: i,
          scale: 1,
          opacity: 1,
        })),
      );
    }, t);

    return () => {
      runIdRef.current += 1;
    };
  }, [active, schedule]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed z-[54]"
      style={{ left: center.x, top: center.y, transform: "translate(-50%, -50%)" }}
      aria-hidden
    >
      <div className="relative h-[6.75rem] w-[4.75rem]">
        {poses.map((pose, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{
              transform: `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.rot}deg) scale(${pose.scale})`,
              opacity: pose.opacity,
              zIndex: pose.z,
              transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out",
            }}
          >
            <PlayingCard faceDown size="md" />
          </div>
        ))}
      </div>
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
  const [flying, setFlying] = useState<FlyingDealCard[]>([]);
  const timersRef = useRef<number[]>([]);
  const revealedRef = useRef(0);
  const runningSeedRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const stateRef = useRef(state);
  const clientIdRef = useRef(client.playerId);
  const getAvatarCenterRef = useRef(getAvatarCenter);
  const getHandTargetRef = useRef(getHandTarget);
  const getPileTargetRef = useRef(getPileTarget);
  const setDealAnimatingRef = useRef(setDealAnimating);
  const setRevealedHandCountRef = useRef(setRevealedHandCount);

  stateRef.current = state;
  clientIdRef.current = client.playerId;
  getAvatarCenterRef.current = getAvatarCenter;
  getHandTargetRef.current = getHandTarget;
  getPileTargetRef.current = getPileTarget;
  setDealAnimatingRef.current = setDealAnimating;
  setRevealedHandCountRef.current = setRevealedHandCount;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const finishDeal = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFlying([]);
    setPhase("done");
    setDealAnimatingRef.current(false);
    const myId = clientIdRef.current;
    const myHand = stateRef.current.hands[myId]?.length ?? 0;
    setRevealedHandCountRef.current(myHand);
    runningSeedRef.current = null;
  }, []);

  const shuffleTotalMs = GATHER_MS + RIFFLE_PASSES * RIFFLE_PASS_MS + SQUARE_MS;
  const dealTotalMs = (TOTAL_CARDS - 1) * DEAL_STAGGER_MS + DEAL_FLY_MS + 80;

  const startDeal = useCallback(
    (turnOrder: string[]) => {
      const pileCenter = getPileTargetRef.current();
      if (!pileCenter) {
        setDealAnimatingRef.current(false);
        runningSeedRef.current = null;
        return;
      }

      const myId = clientIdRef.current;
      const targets = new Map<string, Point>();
      for (const id of turnOrder) {
        const target = id === myId ? getHandTargetRef.current() : getAvatarCenterRef.current(id);
        if (target) targets.set(id, target);
      }
      if (targets.size === 0) {
        setDealAnimatingRef.current(false);
        runningSeedRef.current = null;
        return;
      }

      revealedRef.current = 0;
      finishedRef.current = false;
      setCenter(pileCenter);
      setDealAnimatingRef.current(true);
      setRevealedHandCountRef.current(0);
      setFlying([]);
      setPhase("shuffle");
      playSound("cardShuffle");

      // Second shuffle sound mid-sequence
      schedule(() => playSound("cardShuffle"), GATHER_MS + RIFFLE_PASS_MS);

      schedule(() => {
        setPhase("deal");
        const freshCenter = getPileTargetRef.current() ?? pileCenter;
        setCenter(freshCenter);

        const freshTargets = new Map<string, Point>();
        for (const id of turnOrder) {
          const target = id === myId ? getHandTargetRef.current() : getAvatarCenterRef.current(id);
          if (target) freshTargets.set(id, target);
        }

        const items: FlyingDealCard[] = [];
        const cardsPerPlayer = Math.floor(TOTAL_CARDS / turnOrder.length);
        const dealtCount = new Map<string, number>();

        for (let i = 0; i < TOTAL_CARDS; i++) {
          const playerId = turnOrder[i % turnOrder.length];
          const target = freshTargets.get(playerId) ?? targets.get(playerId);
          if (!target) continue;

          const playerDealt = dealtCount.get(playerId) ?? 0;
          dealtCount.set(playerId, playerDealt + 1);

          const isMe = playerId === myId;
          const handOffset = isMe
            ? (playerDealt - (cardsPerPlayer - 1) / 2) * DEAL_FLY_SPREAD
            : (playerDealt % 3) * 3 - 3;

          items.push({
            key: `deal-${i}`,
            start: { ...freshCenter },
            end: {
              x: target.x + handOffset,
              y: target.y + (isMe ? 0 : 6),
            },
            delay: i * DEAL_STAGGER_MS,
            revealOnArrival: isMe,
            rot: ((i * 17) % 11) - 5,
          });
        }

        setFlying(items);

        items.forEach((item, index) => {
          if (index % turnOrder.length === 0 || index < 4) {
            schedule(() => playSound("cardDeal"), item.delay);
          }
        });

        schedule(finishDeal, dealTotalMs);
      }, shuffleTotalMs);

      schedule(finishDeal, shuffleTotalMs + dealTotalMs + 500);
    },
    [dealTotalMs, finishDeal, schedule, shuffleTotalMs],
  );

  const startDealRef = useRef(startDeal);
  startDealRef.current = startDeal;

  useLayoutEffect(() => {
    if (dealAnimationSeed == null) return;
    if (lastAnimatedDealSeed === dealAnimationSeed) return;

    const turnOrder = stateRef.current.turnOrder;
    if (turnOrder.length < 2) return;

    let cancelled = false;
    let started = false;

    setDealAnimatingRef.current(true);
    setRevealedHandCountRef.current(0);

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        lastAnimatedDealSeed = dealAnimationSeed;
        started = true;
        runningSeedRef.current = dealAnimationSeed;
        startDealRef.current(turnOrder);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (!started) return;
      if (runningSeedRef.current === dealAnimationSeed) {
        clearTimers();
        setFlying([]);
        setPhase("idle");
        setDealAnimatingRef.current(false);
        const myId = clientIdRef.current;
        const myHand = stateRef.current.hands[myId]?.length ?? 0;
        setRevealedHandCountRef.current(myHand);
        runningSeedRef.current = null;
      }
    };
  }, [dealAnimationSeed, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleArrive = useCallback((key: string, reveal: boolean) => {
    if (reveal) {
      revealedRef.current += 1;
      setRevealedHandCountRef.current(revealedRef.current);
    }
    setFlying((items) => items.filter((item) => item.key !== key));
  }, []);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[53]" aria-hidden>
      {center && (
        <RiffleShuffle center={center} active={phase === "shuffle"} schedule={schedule} />
      )}
      {flying.map((item) => (
        <DealFlyingCard key={item.key} item={item} onArrive={handleArrive} />
      ))}
    </div>
  );
}
