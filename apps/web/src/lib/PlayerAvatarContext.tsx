import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

/** Stable callbacks: registering DOM targets, reading their centers, flipping flags. */
interface PlayerAvatarActions {
  registerAvatar: (playerId: string, el: HTMLElement | null) => void;
  registerHandTarget: (el: HTMLElement | null) => void;
  registerPileTarget: (el: HTMLElement | null) => void;
  registerPlaySlotTarget: (el: HTMLElement | null) => void;
  setLocalFlyActive: (active: boolean) => void;
  setPileSettling: (settling: boolean) => void;
  setDealAnimating: (animating: boolean) => void;
  setRevealedHandCount: (count: number) => void;
  registerHandCardTarget: (index: number, el: HTMLElement | null) => void;
  clearHandCardTargets: () => void;
  getHandCardTarget: (index: number) => Point | null;
  getAvatarCenter: (playerId: string) => Point | null;
  getHandTarget: () => Point | null;
  getPileTarget: () => Point | null;
  getPlaySlotTarget: () => Point | null;
}

/** Flags that change during play; consumers of these re-render on every flip. */
interface PlayerAvatarFlags {
  localFlyActive: boolean;
  pileSettling: boolean;
  dealAnimating: boolean;
  revealedHandCount: number;
}

type PlayerAvatarContextValue = PlayerAvatarActions & PlayerAvatarFlags;

const ActionsContext = createContext<PlayerAvatarActions | null>(null);
const FlagsContext = createContext<PlayerAvatarFlags | null>(null);

export function PlayerAvatarProvider({ children }: { children: ReactNode }) {
  const avatarsRef = useRef(new Map<string, HTMLElement>());
  const handCardTargetsRef = useRef(new Map<number, HTMLElement>());
  const handTargetRef = useRef<HTMLElement | null>(null);
  const pileTargetRef = useRef<HTMLElement | null>(null);
  const playSlotTargetRef = useRef<HTMLElement | null>(null);
  const [localFlyActive, setLocalFlyActive] = useState(false);
  const [pileSettling, setPileSettling] = useState(false);
  const [dealAnimating, setDealAnimating] = useState(false);
  const [revealedHandCount, setRevealedHandCount] = useState(0);

  const registerHandCardTarget = useCallback((index: number, el: HTMLElement | null) => {
    if (el) handCardTargetsRef.current.set(index, el);
    else handCardTargetsRef.current.delete(index);
  }, []);

  const clearHandCardTargets = useCallback(() => {
    handCardTargetsRef.current.clear();
  }, []);

  const getHandCardTarget = useCallback((index: number): Point | null => {
    const el = handCardTargetsRef.current.get(index);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const registerAvatar = useCallback((playerId: string, el: HTMLElement | null) => {
    if (el) avatarsRef.current.set(playerId, el);
    else avatarsRef.current.delete(playerId);
  }, []);

  const registerHandTarget = useCallback((el: HTMLElement | null) => {
    handTargetRef.current = el;
  }, []);

  const registerPileTarget = useCallback((el: HTMLElement | null) => {
    pileTargetRef.current = el;
  }, []);

  const registerPlaySlotTarget = useCallback((el: HTMLElement | null) => {
    playSlotTargetRef.current = el;
  }, []);

  const getAvatarCenter = useCallback((playerId: string): Point | null => {
    const el = avatarsRef.current.get(playerId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const getHandTarget = useCallback((): Point | null => {
    const el = handTargetRef.current;
    if (!el) {
      return { x: window.innerWidth / 2, y: window.innerHeight - 120 };
    }
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const getPileTarget = useCallback((): Point | null => {
    const el = pileTargetRef.current;
    if (!el) {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.38 };
    }
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const getPlaySlotTarget = useCallback((): Point | null => {
    const el = playSlotTargetRef.current;
    if (!el) return getPileTarget();
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [getPileTarget]);

  const actions = useMemo<PlayerAvatarActions>(
    () => ({
      registerAvatar,
      registerHandTarget,
      registerPileTarget,
      registerPlaySlotTarget,
      setLocalFlyActive,
      setPileSettling,
      setDealAnimating,
      setRevealedHandCount,
      registerHandCardTarget,
      clearHandCardTargets,
      getHandCardTarget,
      getAvatarCenter,
      getHandTarget,
      getPileTarget,
      getPlaySlotTarget,
    }),
    [
      registerAvatar,
      registerHandTarget,
      registerPileTarget,
      registerPlaySlotTarget,
      registerHandCardTarget,
      clearHandCardTargets,
      getHandCardTarget,
      getAvatarCenter,
      getHandTarget,
      getPileTarget,
      getPlaySlotTarget,
    ],
  );

  const flags = useMemo<PlayerAvatarFlags>(
    () => ({ localFlyActive, pileSettling, dealAnimating, revealedHandCount }),
    [localFlyActive, pileSettling, dealAnimating, revealedHandCount],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>
    </ActionsContext.Provider>
  );
}

/** Callbacks only; never re-renders the caller when animation flags flip. */
export function usePlayerAvatarActions(): PlayerAvatarActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("usePlayerAvatarActions must be used inside PlayerAvatarProvider");
  return ctx;
}

/** Callbacks plus live flags; for components whose render depends on the flags. */
export function usePlayerAvatars(): PlayerAvatarContextValue {
  const actions = usePlayerAvatarActions();
  const flags = useContext(FlagsContext);
  if (!flags) throw new Error("usePlayerAvatars must be used inside PlayerAvatarProvider");
  return useMemo(() => ({ ...actions, ...flags }), [actions, flags]);
}
