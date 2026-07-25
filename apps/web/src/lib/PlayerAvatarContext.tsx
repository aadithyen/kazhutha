import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from "react";

interface Point {
  x: number;
  y: number;
}

interface PlayerAvatarContextValue {
  registerAvatar: (playerId: string, el: HTMLElement | null) => void;
  registerHandTarget: (el: HTMLElement | null) => void;
  registerPileTarget: (el: HTMLElement | null) => void;
  getAvatarCenter: (playerId: string) => Point | null;
  getHandTarget: () => Point | null;
  getPileTarget: () => Point | null;
}

const PlayerAvatarContext = createContext<PlayerAvatarContextValue | null>(null);

export function PlayerAvatarProvider({ children }: { children: ReactNode }) {
  const avatarsRef = useRef(new Map<string, HTMLElement>());
  const handTargetRef = useRef<HTMLElement | null>(null);
  const pileTargetRef = useRef<HTMLElement | null>(null);

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

  const value = useMemo(
    () => ({
      registerAvatar,
      registerHandTarget,
      registerPileTarget,
      getAvatarCenter,
      getHandTarget,
      getPileTarget,
    }),
    [registerAvatar, registerHandTarget, registerPileTarget, getAvatarCenter, getHandTarget, getPileTarget],
  );

  return <PlayerAvatarContext.Provider value={value}>{children}</PlayerAvatarContext.Provider>;
}

export function usePlayerAvatars(): PlayerAvatarContextValue {
  const ctx = useContext(PlayerAvatarContext);
  if (!ctx) throw new Error("usePlayerAvatars must be used inside PlayerAvatarProvider");
  return ctx;
}
