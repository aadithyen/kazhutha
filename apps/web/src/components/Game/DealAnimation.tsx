import { useCallback, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { CARD_LG, CARD_SM, DEAL_FLY_SPREAD } from "../../lib/cardLayout";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { useRoom } from "../../lib/RoomContext";
import { playSound } from "../../lib/sounds";
import PlayingCard from "../PlayingCard";

const SHUFFLE_N = 10;
const GATHER_MS = 420;
const SPLIT_MS = 520;
const WEAVE_CARD_MS = 60;
const BETWEEN_PASS_MS = 200;
const SQUARE_MS = 320;
const RIFFLE_PASSES = 2;
const DEAL_FLY_MS = 200;
const DEAL_ABSORB_MS = 240;
const DEAL_STAGGER_MS = 40;
const TOTAL_CARDS = 52;
const PACKET_X = 100;

let lastAnimatedDealSeed: number | null = null;

interface Point {
  x: number;
  y: number;
}

const DEAL_HAND_SCALE = CARD_LG.width / CARD_SM.width;

interface FlyingDealCard {
  key: string;
  start: Point;
  end: Point;
  delay: number;
  revealOnArrival: boolean;
  rot: number;
  handIndex?: number;
}

function DealFlyingCard({
  item,
  getHandCardTarget,
  onReveal,
  onArrive,
}: {
  item: FlyingDealCard;
  getHandCardTarget: (index: number) => Point | null;
  onReveal: (key: string) => void;
  onArrive: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const timers: number[] = [];
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

    const delayTimer = window.setTimeout(() => {
      el.style.left = `${item.start.x}px`;
      el.style.top = `${item.start.y}px`;
      el.style.transform = `translate(-50%, -50%) scale(0.78) rotate(${item.rot}deg)`;
      el.style.opacity = "1";

      requestAnimationFrame(() => {
        el.style.transition = `left ${DEAL_FLY_MS}ms ${ease}, top ${DEAL_FLY_MS}ms ${ease}, transform ${DEAL_FLY_MS}ms ${ease}, opacity ${DEAL_FLY_MS}ms ease-out`;
        el.style.left = `${item.end.x}px`;
        el.style.top = `${item.end.y}px`;
        el.style.transform = `translate(-50%, -50%) scale(${item.revealOnArrival ? 1 : 0.32}) rotate(0deg)`;
        el.style.opacity = item.revealOnArrival ? "1" : "0.18";
      });

      timers.push(
        window.setTimeout(() => {
          if (!item.revealOnArrival) {
            onArrive(item.key);
            return;
          }

          onReveal(item.key);

          const absorb = () => {
            const handIndex = item.handIndex ?? 0;
            const fanTarget = getHandCardTarget(handIndex) ?? { x: item.end.x, y: item.end.y };

            el.style.transition = `left ${DEAL_ABSORB_MS}ms ${ease}, top ${DEAL_ABSORB_MS}ms ${ease}, transform ${DEAL_ABSORB_MS}ms ${ease}, opacity ${DEAL_ABSORB_MS}ms ease-in`;
            el.style.left = `${fanTarget.x}px`;
            el.style.top = `${fanTarget.y}px`;
            el.style.transform = `translate(-50%, -50%) scale(${DEAL_HAND_SCALE}) rotate(0deg)`;
            el.style.opacity = "0";

            timers.push(window.setTimeout(() => onArrive(item.key), DEAL_ABSORB_MS));
          };

          requestAnimationFrame(() => {
            requestAnimationFrame(absorb);
          });
        }, DEAL_FLY_MS),
      );
    }, item.delay);

    timers.push(delayTimer);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [item, getHandCardTarget, onReveal, onArrive]);

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

function applyPose(el: HTMLElement, x: number, y: number, rot: number, scale: number, opacity: number) {
  el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
  el.style.opacity = String(opacity);
}

function riffleDurationMs(): number {
  const weaveMs = SHUFFLE_N * WEAVE_CARD_MS;
  const onePass = SPLIT_MS + weaveMs + BETWEEN_PASS_MS;
  return GATHER_MS + RIFFLE_PASSES * onePass + SQUARE_MS;
}

/**
 * Imperative center-stage riffle. Mutates card DOM directly so motion is
 * visible even when React batches heavily during game-start state churn.
 */
function ShuffleStage({
  center,
  active,
  timers,
}: {
  center: Point;
  active: boolean;
  timers: MutableRefObject<number[]>;
}) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!active) return;

    let cancelled = false;
    const boot = requestAnimationFrame(() => {
      const cards = cardRefs.current.filter((el): el is HTMLDivElement => el != null);
      if (cancelled || cards.length === 0) return;

      const schedule = (fn: () => void, ms: number) => {
        const id = window.setTimeout(() => {
          if (cancelled) return;
          fn();
        }, ms);
        timers.current.push(id);
      };

      cards.forEach((el, i) => {
        el.style.transition = "none";
        el.style.zIndex = String(i);
        applyPose(el, (i - (SHUFFLE_N - 1) / 2) * 1.2, -i * 1.5, (i - 4) * 1.5, 1, 1);
      });

      schedule(() => {
        cards.forEach((el) => {
          el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out";
        });
        cards.forEach((el, i) => {
          applyPose(el, (i - (SHUFFLE_N - 1) / 2) * 1.1, -i * 1.6, (i - (SHUFFLE_N - 1) / 2) * 1.2, 1, 1);
        });
      }, 40);

      let t = GATHER_MS;

      for (let pass = 0; pass < RIFFLE_PASSES; pass++) {
        const passAt = t;

        schedule(() => {
          cards.forEach((el, i) => {
            const left = i % 2 === 0;
            const stack = Math.floor(i / 2);
            el.style.zIndex = String(stack + (left ? 0 : SHUFFLE_N));
            applyPose(
              el,
              left ? -PACKET_X - stack * 2.5 : PACKET_X + stack * 2.5,
              -10 - stack * 2.5,
              left ? -20 - stack : 20 + stack,
              1,
              1,
            );
          });
        }, passAt);

        for (let i = 0; i < SHUFFLE_N; i++) {
          schedule(() => {
            const el = cards[i];
            if (!el) return;
            el.style.zIndex = String(i);
            applyPose(
              el,
              (i - (SHUFFLE_N - 1) / 2) * 1.2,
              -i * 1.7,
              (i - (SHUFFLE_N - 1) / 2) * 0.8,
              1,
              1,
            );
          }, passAt + SPLIT_MS + i * WEAVE_CARD_MS);
        }

        t = passAt + SPLIT_MS + SHUFFLE_N * WEAVE_CARD_MS + BETWEEN_PASS_MS;
      }

      schedule(() => {
        cards.forEach((el, i) => {
          el.style.zIndex = String(i);
          applyPose(el, (i - (SHUFFLE_N - 1) / 2) * 0.5, -i * 1.1, 0, 1, 1);
        });
      }, t);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
    };
  }, [active, timers]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed z-[54]"
      style={{ left: center.x, top: center.y, transform: "translate(-50%, -50%)" }}
      aria-hidden
    >
      <div className="relative h-[6.75rem] w-[4.75rem]">
        {Array.from({ length: SHUFFLE_N }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{ opacity: 0 }}
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
    getHandCardTarget,
    getPileTarget,
    setDealAnimating,
    setRevealedHandCount,
    clearHandCardTargets,
  } = usePlayerAvatars();
  const [showShuffle, setShowShuffle] = useState(false);
  const [center, setCenter] = useState<Point | null>(null);
  const [flying, setFlying] = useState<FlyingDealCard[]>([]);
  const timersRef = useRef<number[]>([]);
  const revealedRef = useRef(0);
  const runningSeedRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const aliveRef = useRef(true);

  const stateRef = useRef(state);
  const clientIdRef = useRef(client.playerId);
  const getAvatarCenterRef = useRef(getAvatarCenter);
  const getHandTargetRef = useRef(getHandTarget);
  const getHandCardTargetRef = useRef(getHandCardTarget);
  const getPileTargetRef = useRef(getPileTarget);
  const setDealAnimatingRef = useRef(setDealAnimating);
  const setRevealedHandCountRef = useRef(setRevealedHandCount);
  const clearHandCardTargetsRef = useRef(clearHandCardTargets);

  stateRef.current = state;
  clientIdRef.current = client.playerId;
  getAvatarCenterRef.current = getAvatarCenter;
  getHandTargetRef.current = getHandTarget;
  getHandCardTargetRef.current = getHandCardTarget;
  getPileTargetRef.current = getPileTarget;
  setDealAnimatingRef.current = setDealAnimating;
  setRevealedHandCountRef.current = setRevealedHandCount;
  clearHandCardTargetsRef.current = clearHandCardTargets;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (!aliveRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const finishDeal = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    setFlying([]);
    setShowShuffle(false);
    setCenter(null);
    setDealAnimatingRef.current(false);
    clearHandCardTargetsRef.current();
    const myId = clientIdRef.current;
    const myHand = stateRef.current.hands[myId]?.length ?? 0;
    setRevealedHandCountRef.current(myHand);
    runningSeedRef.current = null;
  }, [clearTimers]);

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
      setFlying([]);
      setShowShuffle(true);
      setDealAnimatingRef.current(true);
      setRevealedHandCountRef.current(0);
      playSound("cardShuffle");

      const shuffleMs = riffleDurationMs();
      const dealMs = (TOTAL_CARDS - 1) * DEAL_STAGGER_MS + DEAL_FLY_MS + DEAL_ABSORB_MS + 100;

      schedule(() => playSound("cardShuffle"), GATHER_MS + SPLIT_MS + SHUFFLE_N * WEAVE_CARD_MS);

      schedule(() => {
        setShowShuffle(false);

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
            handIndex: isMe ? playerDealt : undefined,
            rot: ((i * 17) % 11) - 5,
          });
        }

        setFlying(items);

        items.forEach((item, index) => {
          if (index % Math.max(turnOrder.length, 1) === 0 || index < 4) {
            schedule(() => playSound("cardDeal"), item.delay);
          }
        });

        schedule(finishDeal, dealMs);
      }, shuffleMs);

      schedule(finishDeal, shuffleMs + dealMs + 800);
    },
    [finishDeal, schedule],
  );

  const startDealRef = useRef(startDeal);
  startDealRef.current = startDeal;

  useLayoutEffect(() => {
    aliveRef.current = true;

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
      aliveRef.current = false;
      cancelAnimationFrame(frame);
      if (!started) return;
      // Abort mid-run (Strict Mode remount / leave room). Free the seed so a
      // remount can replay; keep hand hidden until a run finishes.
      if (runningSeedRef.current === dealAnimationSeed) {
        clearTimers();
        setFlying([]);
        setShowShuffle(false);
        setCenter(null);
        lastAnimatedDealSeed = null;
        runningSeedRef.current = null;
        finishedRef.current = false;
        setDealAnimatingRef.current(true);
        setRevealedHandCountRef.current(0);
      }
    };
  }, [dealAnimationSeed, clearTimers]);

  const handleReveal = useCallback((key: string) => {
    revealedRef.current += 1;
    setRevealedHandCountRef.current(revealedRef.current);
  }, []);

  const handleArrive = useCallback((key: string) => {
    setFlying((items) => items.filter((item) => item.key !== key));
  }, []);

  if (!showShuffle && flying.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[53]" aria-hidden>
      {center && <ShuffleStage center={center} active={showShuffle} timers={timersRef} />}
      {flying.map((item) => (
        <DealFlyingCard
          key={item.key}
          item={item}
          getHandCardTarget={(index) => getHandCardTargetRef.current(index)}
          onReveal={handleReveal}
          onArrive={handleArrive}
        />
      ))}
    </div>
  );
}
