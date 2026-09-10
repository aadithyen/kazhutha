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
  /** Preview frames render inline instead of as a game overlay. */
  embedded?: boolean;
}

const panelClass =
  "w-full max-w-md rounded-xl border border-neutral-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]";
const primaryBtnClass =
  "flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-base font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]";
const secondaryBtnClass =
  "flex-1 rounded-xl bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900 ring-1 ring-neutral-200 active:scale-[0.98] dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700";

function HandOfferShell({
  embedded,
  children,
}: {
  embedded?: boolean;
  children: React.ReactNode;
}) {
  if (embedded) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div className="relative w-full px-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}

function HandOfferWaitingBanner({
  message,
  embedded,
}: {
  message: string;
  embedded?: boolean;
}) {
  const className =
    "border-t border-neutral-100 bg-white/95 px-4 py-3 text-center text-sm text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-400";

  if (embedded) {
    return <div className={className}>{message}</div>;
  }

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 ${className}`} role="status" aria-live="polite">
      {message}
    </div>
  );
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
  embedded = false,
}: Props) {
  const offerer = players.find((p) => p.id === offer.offererId);
  const recipient = players.find((p) => p.id === offer.recipientId);
  const offererName = offerer?.name ?? t("common.someone");
  const recipientName = recipient?.name ?? t("common.someone");

  if (offer.phase === "awaiting_offer" && playerId === offer.offererId) {
    return (
      <HandOfferShell embedded={embedded}>
        <div className={panelClass}>
          <h2 className="text-center font-serif text-xl font-semibold italic text-neutral-900 dark:text-neutral-100">
            {t("handOffer.promptOffer", { name: recipientName })}
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("handOffer.promptOfferHint")}
          </p>
          <div className="mt-5 flex gap-2">
            <button type="button" className={secondaryBtnClass} onClick={onSkip}>
              {t("handOffer.skip")}
            </button>
            <button type="button" className={primaryBtnClass} onClick={onOffer}>
              {t("handOffer.offer")}
            </button>
          </div>
        </div>
      </HandOfferShell>
    );
  }

  if (offer.phase === "awaiting_response" && playerId === offer.recipientId) {
    return (
      <HandOfferShell embedded={embedded}>
        <div className={panelClass}>
          <h2 className="text-center font-serif text-xl font-semibold italic text-neutral-900 dark:text-neutral-100">
            {t("handOffer.promptAccept", { name: offererName })}
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("handOffer.promptAcceptHint")}
          </p>
          <div className="mt-5 flex gap-2">
            <button type="button" className={secondaryBtnClass} onClick={onReject}>
              {t("handOffer.reject")}
            </button>
            <button type="button" className={primaryBtnClass} onClick={onAccept}>
              {t("handOffer.accept")}
            </button>
          </div>
        </div>
      </HandOfferShell>
    );
  }

  if (offer.phase === "awaiting_response") {
    return (
      <HandOfferWaitingBanner
        embedded={embedded}
        message={t("handOffer.waitingResponse", { offerer: offererName, recipient: recipientName })}
      />
    );
  }

  return (
    <HandOfferWaitingBanner
      embedded={embedded}
      message={t("handOffer.waitingOffer", { offerer: offererName, recipient: recipientName })}
    />
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
