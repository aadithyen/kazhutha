import { useRoom } from "../../lib/RoomContext";
import { useLocale } from "../../i18n";

export default function HandOfferPrompt() {
  const { state, client } = useRoom();
  const { t } = useLocale();
  const offer = state.handOffer;
  if (!offer) return null;

  const offerer = state.players.find((p) => p.id === offer.offererId);
  const recipient = state.players.find((p) => p.id === offer.recipientId);
  const offererName = offerer?.name ?? t("common.someone");
  const recipientName = recipient?.name ?? t("common.someone");

  if (offer.phase === "awaiting_offer" && client.playerId === offer.offererId) {
    return (
      <div className="fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl dark:border-amber-800 dark:bg-amber-950">
        <p className="mb-3 text-center text-sm font-medium text-amber-950 dark:text-amber-100">
          {t("handOffer.promptOffer", { name: recipientName })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={() => client.sendIntent({ type: "OfferHand", playerId: client.playerId })}
          >
            {t("handOffer.offer")}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
            onClick={() => client.sendIntent({ type: "SkipHandOffer", playerId: client.playerId })}
          >
            {t("handOffer.skip")}
          </button>
        </div>
      </div>
    );
  }

  if (offer.phase === "awaiting_response" && client.playerId === offer.recipientId) {
    return (
      <div className="fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xl dark:border-emerald-800 dark:bg-emerald-950">
        <p className="mb-3 text-center text-sm font-medium text-emerald-950 dark:text-emerald-100">
          {t("handOffer.promptAccept", { name: offererName })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={() => client.sendIntent({ type: "AcceptHandOffer", playerId: client.playerId })}
          >
            {t("handOffer.accept")}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800"
            onClick={() => client.sendIntent({ type: "RejectHandOffer", playerId: client.playerId })}
          >
            {t("handOffer.reject")}
          </button>
        </div>
      </div>
    );
  }

  if (offer.phase === "awaiting_response") {
    return (
      <div className="fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 text-center text-sm text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200">
        {t("handOffer.waitingResponse", { offerer: offererName, recipient: recipientName })}
      </div>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 text-center text-sm text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200">
      {t("handOffer.waitingOffer", { offerer: offererName, recipient: recipientName })}
    </div>
  );
}
