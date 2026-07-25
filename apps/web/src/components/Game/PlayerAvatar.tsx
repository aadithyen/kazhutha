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
}

export default function PlayerAvatar({
  playerId,
  name,
  size = "md",
  isTurn = false,
  isFinished = false,
  dimmed = false,
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

  return (
    <div
      ref={ref}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold shadow-sm transition-all duration-200 ${sizeClass} ${
        dim ? "opacity-45" : ""
      }`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        boxShadow: isTurn ? `0 0 0 2px #ffffff, 0 0 0 4px ${color.ring}` : undefined,
      }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
