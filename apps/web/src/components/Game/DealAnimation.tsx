import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DEAL_FLY_SPREAD } from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import { playSound } from "../../lib/sounds";
import PlayingCard from "../PlayingCard";

const GATHER_MS = 280;
const RIFFLE_PASS_MS = 780;
const RIFFLE_PASSES = 2;
const SQUARE_MS = 260;
const DEAL_FLY_MS = 170;
const DEAL_STAGGER_MS = 36;
const TOTAL_CARDS = 52;
const SHUFFLE_CARD_COUNT = 12;

let lastAnimatedDealSeed: number | null = null;

interface Point {
  x: number;
  y: number;
}

type Phase = "idle" | "gather" | "riffle" | "square" | "deal" | "done";

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
  phase: "gather" | "riffle" | "square";
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
                    ? `${stackIndex * 42}ms`
                    : phase === "gather"
                      ? `${stackIndex * 18}ms`
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
                    ? `${28 + stackIndex * 42}ms`
                    : phase === "gather"
                      ? `${(stackIndex + leftPacket.length) * 18}ms`
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
      setRifflePass(0);
      setPhase("gather");
      playSound("cardShuffle");

      const shuffleTotalMs = GATHER_MS + RIFFLE_PASSES * RIFFLE_PASS_MS + SQUARE_MS;

      // First riffle after gather
      schedule(() => {
        setPhase("riffle");
        setRifflePass(0);
      }, GATHER_MS);

      // Extra riffle passes
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
            rot: ((i * 17) % 11) - 5,
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
      }, shuffleTotalMs);
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

  const shufflePhase = phase === "gather" || phase === "riffle" || phase === "square" ? phase : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[53]" aria-hidden>
      {center && shufflePhase && <RiffleShuffle center={center} phase={shufflePhase} pass={rifflePass} />}
      {flying.map((item) => (
        <DealFlyingCard key={item.key} item={item} onArrive={handleArrive} />
      ))}
    </div>
  );
}
