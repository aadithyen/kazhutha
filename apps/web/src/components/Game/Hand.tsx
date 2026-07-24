import { Card, isSameCard } from "@kazhutha/shared";
import { getLegalCards } from "@kazhutha/game";
import { useState } from "react";
import { useRoom } from "../../lib/RoomContext";
import PlayingCard from "../PlayingCard";

export default function Hand() {
  const { state, client } = useRoom();
  const [selected, setSelected] = useState<Card | null>(null);
  const hand = state.hands[client.playerId] ?? [];
  const legalCards = getLegalCards(state, client.playerId);
  const myTurn = state.currentTurnId === client.playerId;

  function handleTap(card: Card) {
    if (!myTurn) return;
    if (selected && isSameCard(selected, card)) {
      client.sendIntent({ type: "PlayCard", playerId: client.playerId, card });
      setSelected(null);
    } else {
      setSelected(card);
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 px-3 py-4">
      {hand.map((card, i) => {
        const legal = myTurn && legalCards.some((c) => isSameCard(c, card));
        return (
          <PlayingCard
            key={`${card.suit}${card.rank}-${i}`}
            card={card}
            selected={!!selected && isSameCard(selected, card)}
            disabled={!legal}
            onClick={legal ? () => handleTap(card) : undefined}
            size="lg"
          />
        );
      })}
    </div>
  );
}
