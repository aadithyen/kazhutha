import { Card, rankLabel, SUIT_COLOR, SUIT_SYMBOLS } from "@kazhutha/shared";

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, { box: string; rank: string; suit: string; watermark: string }> = {
  sm: {
    box: "h-16 w-11",
    rank: "text-[11px]",
    suit: "text-[10px]",
    watermark: "text-2xl",
  },
  md: {
    box: "h-[5.25rem] w-[3.75rem]",
    rank: "text-sm",
    suit: "text-xs",
    watermark: "text-3xl",
  },
  lg: {
    box: "h-28 w-[4.75rem]",
    rank: "text-base",
    suit: "text-sm",
    watermark: "text-4xl",
  },
};

export default function PlayingCard({ card, faceDown, selected, disabled, onClick, size = "md" }: Props) {
  const dims = SIZE_CLASSES[size];
  const base = `relative ${dims.box} rounded-xl border bg-white font-serif italic shadow-[0_2px_12px_rgba(15,23,42,0.08)] transition-all duration-150`;

  if (faceDown || !card) {
    return (
      <div
        className={`${base} border-neutral-200 bg-gradient-to-br from-neutral-100 to-neutral-200`}
        aria-hidden
      />
    );
  }

  const isRed = SUIT_COLOR[card.suit] === "red";
  const color = isRed ? "text-rose-600" : "text-neutral-900";
  const interactive = !disabled && !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${base} border-neutral-200 ${color} ${
        selected
          ? "-translate-y-3 border-neutral-400 shadow-[0_12px_28px_rgba(15,23,42,0.14)] ring-1 ring-neutral-300"
          : interactive
            ? "hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
            : ""
      } ${disabled ? "opacity-35" : interactive ? "active:scale-[0.98]" : ""}`}
    >
      <span className={`absolute left-1.5 top-1.5 leading-none ${dims.rank} font-semibold not-italic`}>
        {rankLabel(card.rank)}
      </span>
      <span className={`absolute left-1.5 top-[1.35rem] leading-none ${dims.suit}`}>{SUIT_SYMBOLS[card.suit]}</span>
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center ${dims.watermark} opacity-[0.12]`}
        aria-hidden
      >
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  );
}
