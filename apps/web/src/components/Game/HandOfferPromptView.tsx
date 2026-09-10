import { HandOffer, HandOfferPhase } from "@kazhutha/game";

interface PlayerRef {
  id: string;
  name: string;
}

interface Props {
  offer: HandOffer;
  playerId: string;
  players: PlayerRef[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onOffer?: () => void;
  onSkip?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  className?: string;
}

export default function HandOfferPromptView({
  offer,
  playerId,
  players,
  t,
  onOffer,
  onSkip,
  onAccept,
  onReject,
  className = "fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md",
}: Props) {
  const offerer = players.find((p) => p.id === offer.offererId);
  const recipient = players.find((p) => p.id === offer.recipientId);
  const offererName = offerer?.name ?? t("common.someone");
  const recipientName = recipient?.name ?? t("common.someone");

  if (offer.phase === "awaiting_offer" && playerId === offer.offererId) {
    return (
      <div
        className={`${className} rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl dark:border-amber-800 dark:bg-amber-950`}
      >
        <p className="mb-3 text-center text-sm font-medium text-amber-950 dark:text-amber-100">
          {t("handOffer.promptOffer", { name: recipientName })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={onOffer}
          >
            {t("handOffer.offer")}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
            onClick={onSkip}
          >
            {t("handOffer.skip")}
          </button>
        </div>
      </div>
    );
  }

  if (offer.phase === "awaiting_response" && playerId === offer.recipientId) {
    return (
      <div
        className={`${className} rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xl dark:border-emerald-800 dark:bg-emerald-950`}
      >
        <p className="mb-3 text-center text-sm font-medium text-emerald-950 dark:text-emerald-100">
          {t("handOffer.promptAccept", { name: offererName })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={onAccept}
          >
            {t("handOffer.accept")}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800"
            onClick={onReject}
          >
            {t("handOffer.reject")}
          </button>
        </div>
      </div>
    );
  }

  if (offer.phase === "awaiting_response") {
    return (
      <div
        className={`${className} rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 text-center text-sm text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200`}
      >
        {t("handOffer.waitingResponse", { offerer: offererName, recipient: recipientName })}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 text-center text-sm text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200`}
    >
      {t("handOffer.waitingOffer", { offerer: offererName, recipient: recipientName })}
    </div>
  );
}

export function previewHandOffer(phase: HandOfferPhase) {
  return {
    offererId: "bob",
    recipientId: "alice",
    phase,
  } satisfies HandOffer;
}

export const previewPlayers = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
];
