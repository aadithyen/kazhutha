import { useEffect, useRef } from "react";
import { getPlayerColor, getPlayerInitials } from "../../lib/playerColors";
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";

interface Props {
  playerId: string;
  name: string;
  size?: "sm" | "md";
  isTurn?: boolean;
  isFinished?: boolean;
  dimmed?: boolean;
  countRevealed?: boolean;
  handCount?: number;
}

export default function PlayerAvatar({
  playerId,
  name,
  size = "md",
  isTurn = false,
  isFinished = false,
  dimmed = false,
  countRevealed = false,
  handCount,
}: Props) {
  const { registerAvatar } = usePlayerAvatars();
  const ref = useRef<HTMLDivElement>(null);
  const color = getPlayerColor(playerId);
  const initials = getPlayerInitials(name);
  const dim = dimmed || isFinished;

  useEffect(() => {
    registerAvatar(playerId, ref.current);
    return () => registerAvatar(playerId, null);
  }, [playerId, registerAvatar]);

  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const badgeSizeClass = size === "sm" ? "h-4 min-w-4 text-[9px]" : "h-5 min-w-5 text-[10px]";

  return (
    <div className="relative shrink-0">
      <div
        ref={ref}
        className={`flex items-center justify-center rounded-full border-2 bg-white font-serif italic transition-all duration-200 ${sizeClass} ${
          dim ? "opacity-45" : ""
        }`}
        style={{
          borderColor: color.border,
          color: color.text,
          boxShadow: isTurn ? `0 0 0 2px #ffffff, 0 0 0 4px ${color.ring}` : undefined,
        }}
        title={name}
        aria-label={name}
      >
        {initials}
      </div>
      {countRevealed && handCount !== undefined && (
        <span
          className={`absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-white px-0.5 font-sans font-semibold leading-none text-neutral-700 shadow-[0_1px_4px_rgba(15,23,42,0.18)] ${badgeSizeClass}`}
          aria-label={`${handCount} cards`}
        >
          {handCount}
        </span>
      )}
    </div>
  );
}
