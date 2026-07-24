import { Card, rankLabel, SUIT_COLOR, SUIT_SYMBOLS } from "@kazhutha/shared";

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-14 w-10 text-sm",
  md: "h-20 w-14 text-lg",
  lg: "h-24 w-16 text-xl",
};

export default function PlayingCard({ card, faceDown, selected, disabled, onClick, size = "md" }: Props) {
  const base = `flex flex-col items-center justify-center rounded-lg border-2 font-bold shadow transition-transform ${SIZE_CLASSES[size]}`;

  if (faceDown || !card) {
    return <div className={`${base} border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800`} />;
  }

  const color = SUIT_COLOR[card.suit] === "red" ? "text-red-500" : "text-slate-900";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${base} bg-slate-50 ${color} ${
        selected ? "-translate-y-2 border-amber-400 ring-2 ring-amber-400" : "border-slate-300"
      } ${disabled ? "opacity-40" : onClick ? "active:scale-95" : ""}`}
    >
      <span>{rankLabel(card.rank)}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}
