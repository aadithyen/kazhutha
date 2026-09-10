import { useLocale } from "../../i18n";
import { useRoom } from "../../lib/RoomContext";
import HandOfferPromptView from "./HandOfferPromptView";

export default function HandOfferPrompt() {
  const { state, client } = useRoom();
  const { t } = useLocale();
  const offer = state.handOffer;
  if (!offer) return null;

  return (
    <HandOfferPromptView
      offer={offer}
      playerId={client.playerId}
      players={state.players}
      t={t}
      onOffer={() => client.sendIntent({ type: "OfferHand", playerId: client.playerId })}
      onSkip={() => client.sendIntent({ type: "SkipHandOffer", playerId: client.playerId })}
      onAccept={() => client.sendIntent({ type: "AcceptHandOffer", playerId: client.playerId })}
      onReject={() => client.sendIntent({ type: "RejectHandOffer", playerId: client.playerId })}
    />
  );
}
