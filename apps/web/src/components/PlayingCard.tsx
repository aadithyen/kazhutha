import { Card, Rank, rankLabel, SUIT_COLOR, SUIT_SYMBOLS } from "@kazhutha/shared";
import CourtCardArt from "./CourtCardArt";

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<
  NonNullable<Props["size"]>,
  { box: string; corner: string; cornerSuit: string; pip: string; center: string }
> = {
  sm: {
    box: "h-[4.5rem] w-12 rounded-lg",
    corner: "text-[11px]",
    cornerSuit: "text-[9px]",
    pip: "text-[9px]",
    center: "text-xl",
  },
  md: {
    box: "h-[6.75rem] w-[4.75rem] rounded-xl",
    corner: "text-base",
    cornerSuit: "text-xs",
    pip: "text-sm",
    center: "text-4xl",
  },
  lg: {
    box: "h-[10rem] w-[7rem] rounded-2xl",
    corner: "text-xl",
    cornerSuit: "text-base",
    pip: "text-xl",
    center: "text-6xl",
  },
};

interface Pip {
  x: number;
  y: number;
  flip?: boolean;
}

/** Standard playing-card pip positions, in % of the pip area. Bottom-half pips render upside down. */
const PIP_LAYOUTS: Partial<Record<Rank, Pip[]>> = {
  2: [
    { x: 50, y: 15 },
    { x: 50, y: 85, flip: true },
  ],
  3: [
    { x: 50, y: 15 },
    { x: 50, y: 50 },
    { x: 50, y: 85, flip: true },
  ],
  4: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  5: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 50, y: 50 },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  6: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 27, y: 50 },
    { x: 73, y: 50 },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  7: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 50, y: 32.5 },
    { x: 27, y: 50 },
    { x: 73, y: 50 },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  8: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 50, y: 32.5 },
    { x: 27, y: 50 },
    { x: 73, y: 50 },
    { x: 50, y: 67.5, flip: true },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  9: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 27, y: 38.3 },
    { x: 73, y: 38.3 },
    { x: 50, y: 50 },
    { x: 27, y: 61.7, flip: true },
    { x: 73, y: 61.7, flip: true },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
  10: [
    { x: 27, y: 15 },
    { x: 73, y: 15 },
    { x: 50, y: 26.7 },
    { x: 27, y: 38.3 },
    { x: 73, y: 38.3 },
    { x: 27, y: 61.7, flip: true },
    { x: 73, y: 61.7, flip: true },
    { x: 50, y: 73.3, flip: true },
    { x: 27, y: 85, flip: true },
    { x: 73, y: 85, flip: true },
  ],
};

function CardFace({ card, dims }: { card: Card; dims: (typeof SIZE_CLASSES)["md"] }) {
  const symbol = SUIT_SYMBOLS[card.suit];

  if (card.rank === 14) {
    return (
      <span className={`pointer-events-none absolute inset-0 flex items-center justify-center ${dims.center} leading-none`}>
        {symbol}
      </span>
    );
  }

  if (card.rank >= 11 && card.rank <= 13) {
    return (
      <span className="pointer-events-none absolute inset-[10%] flex flex-col items-center justify-center rounded-md border border-current/20 bg-current/[0.03] leading-none">
        <CourtCardArt rank={card.rank as 11 | 12 | 13} className="h-[76%] w-[76%]" />
        <span className={`${dims.cornerSuit} -mt-0.5 opacity-70`}>{symbol}</span>
      </span>
    );
  }

  return (
    <span className="pointer-events-none absolute inset-x-[24%] inset-y-[10%] block" aria-hidden>
      {PIP_LAYOUTS[card.rank]?.map((pip, i) => (
        <span
          key={i}
          className={`absolute ${dims.pip} leading-none`}
          style={{
            left: `${pip.x}%`,
            top: `${pip.y}%`,
            transform: `translate(-50%, -50%)${pip.flip ? " rotate(180deg)" : ""}`,
          }}
        >
          {symbol}
        </span>
      ))}
    </span>
  );
}

export default function PlayingCard({ card, faceDown, selected, disabled, onClick, size = "md" }: Props) {
  const dims = SIZE_CLASSES[size];
  const base = `relative ${dims.box} border bg-white font-serif shadow-[0_2px_12px_rgba(15,23,42,0.08)] transition-all duration-150`;

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
      } ${disabled ? "brightness-[0.78] saturate-[0.72]" : interactive ? "active:scale-[0.98]" : ""}`}
    >
      <span className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-center leading-none">
        <span className={`${dims.corner} font-semibold`}>{rankLabel(card.rank)}</span>
        <span className={dims.cornerSuit}>{SUIT_SYMBOLS[card.suit]}</span>
      </span>
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex rotate-180 flex-col items-center leading-none">
        <span className={`${dims.corner} font-semibold`}>{rankLabel(card.rank)}</span>
        <span className={dims.cornerSuit}>{SUIT_SYMBOLS[card.suit]}</span>
      </span>
      <CardFace card={card} dims={dims} />
    </button>
  );
}
