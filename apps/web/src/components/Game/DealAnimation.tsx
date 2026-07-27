import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DEAL_FLY_SPREAD } from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import { playSound } from "../../lib/sounds";
import PlayingCard from "../PlayingCard";

const GATHER_MS = 320;
const RIFFLE_PASS_MS = 860;
const RIFFLE_PASSES = 2;
const SQUARE_MS = 280;
const DEAL_FLY_MS = 180;
const DEAL_STAGGER_MS = 38;
const TOTAL_CARDS = 52;
const SHUFFLE_CARD_COUNT = 12;

let lastAnimatedDealSeed: number | null = null;

interface Point {
  x: number;
  y: number;
}

type ShufflePhase = "gather" | "riffle" | "square";
type Phase = "idle" | ShufflePhase | "deal" | "done";

interface FlyingDealCard {
  key: string;
  start: Point;
  end: Point;
  delay: number;
  revealOnArrival: boolean;
  rot: number;
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

/** Center-stage riffle: split packets, weave cards, square — CSS-driven. */
function RiffleShuffle({
  center,
  phase,
  pass,
}: {
  center: Point;
  phase: ShufflePhase;
  pass: number;
}) {
  const cards = Array.from({ length: SHUFFLE_CARD_COUNT }, (_, i) => i);
  const leftPacket = cards.filter((i) => i % 2 === 0);
  const rightPacket = cards.filter((i) => i % 2 === 1);

  return (
    <div
      className="pointer-events-none fixed z-[54]"
      style={{ left: center.x, top: center.y, transform: "translate(-50%, -50%)" }}
      aria-hidden
    >
      <div
        className={`deal-riffle-stage relative h-[6.75rem] w-[4.75rem] ${
          phase === "gather" ? "deal-riffle-gather" : phase === "square" ? "deal-riffle-square" : ""
        }`}
        data-pass={pass}
      >
        {leftPacket.map((i, stackIndex) => (
          <div
            key={`L-${i}-${pass}`}
            className={`deal-riffle-card absolute left-1/2 top-1/2 ${
              phase === "riffle" ? "deal-riffle-left" : phase === "gather" ? "deal-riffle-stack" : "deal-riffle-settle"
            }`}
            style={
              {
                "--stack": stackIndex,
                "--weave": stackIndex,
                "--side": -1,
                animationDelay:
                  phase === "riffle"
                    ? `${stackIndex * 48}ms`
                    : phase === "gather"
                      ? `${stackIndex * 20}ms`
                      : "0ms",
              } as CSSProperties
            }
          >
            <PlayingCard faceDown size="md" />
          </div>
        ))}
        {rightPacket.map((i, stackIndex) => (
          <div
            key={`R-${i}-${pass}`}
            className={`deal-riffle-card absolute left-1/2 top-1/2 ${
              phase === "riffle" ? "deal-riffle-right" : phase === "gather" ? "deal-riffle-stack" : "deal-riffle-settle"
            }`}
            style={
              {
                "--stack": stackIndex,
                "--weave": stackIndex,
                "--side": 1,
                animationDelay:
                  phase === "riffle"
                    ? `${32 + stackIndex * 48}ms`
                    : phase === "gather"
                      ? `${(stackIndex + leftPacket.length) * 20}ms`
                      : "0ms",
              } as CSSProperties
            }
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
  const [rifflePass, setRifflePass] = useState(0);
  const [flying, setFlying] = useState<FlyingDealCard[]>([]);
  const timersRef = useRef<number[]>([]);
  const revealedRef = useRef(0);
  const runningSeedRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  // Keep latest room/layout values in refs so the seed effect never re-subscribes
  // mid-animation (re-subscribe cleanup was clearing timers and freezing the hand).
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
      setRifflePass(0);
      setFlying([]);
      setPhase("gather");
      playSound("cardShuffle");

      const shuffleTotalMs = GATHER_MS + RIFFLE_PASSES * RIFFLE_PASS_MS + SQUARE_MS;
      const dealTotalMs = (TOTAL_CARDS - 1) * DEAL_STAGGER_MS + DEAL_FLY_MS + 80;

      schedule(() => {
        setPhase("riffle");
        setRifflePass(0);
      }, GATHER_MS);

      for (let p = 1; p < RIFFLE_PASSES; p++) {
        schedule(() => {
          setRifflePass(p);
          setPhase("riffle");
          playSound("cardShuffle");
        }, GATHER_MS + p * RIFFLE_PASS_MS);
      }

      schedule(() => {
        setPhase("square");
      }, GATHER_MS + RIFFLE_PASSES * RIFFLE_PASS_MS);

      schedule(() => {
        setPhase("deal");
        // Refresh layout targets right before cards fly — avatars/hand may have settled.
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

      // Hard safety: never leave the hand frozen if a timer is lost.
      schedule(finishDeal, shuffleTotalMs + dealTotalMs + 500);
    },
    [finishDeal, schedule],
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
        // Consume seed only once the sequence actually begins so React Strict Mode
        // remounts can still start the animation.
        lastAnimatedDealSeed = dealAnimationSeed;
        started = true;
        runningSeedRef.current = dealAnimationSeed;
        startDealRef.current(turnOrder);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (!started) {
        // Strict Mode abort-before-start: leave seed unconsumed for remount.
        return;
      }
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

  const handleArrive = useCallback(
    (key: string, reveal: boolean) => {
      if (reveal) {
        revealedRef.current += 1;
        setRevealedHandCountRef.current(revealedRef.current);
      }
      setFlying((items) => items.filter((item) => item.key !== key));
    },
    [],
  );

  if (phase === "idle" || phase === "done") return null;

  const shufflePhase: ShufflePhase | null =
    phase === "gather" || phase === "riffle" || phase === "square" ? phase : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[53]" aria-hidden>
      {center && shufflePhase && <RiffleShuffle center={center} phase={shufflePhase} pass={rifflePass} />}
      {flying.map((item) => (
        <DealFlyingCard key={item.key} item={item} onArrive={handleArrive} />
      ))}
    </div>
  );
}
