import { Card, Rank, SUITS } from "./types";

const RANK_LABELS: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

export function cardId(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function isSameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank: rank as Rank });
    }
  }
  return deck;
}

export function isAceOfSpades(card: Card): boolean {
  return card.suit === "S" && card.rank === 14;
}

/** Higher rank wins. Ace (14) is highest. */
export function compareRank(a: Card, b: Card): number {
  return a.rank - b.rank;
}

export type HandSortMode = "suit" | "value";

function suitIndex(suit: Card["suit"]): number {
  return SUITS.indexOf(suit);
}

/** Sort hand for display: by suit (then rank) or by value (then suit). */
export function sortHand(cards: Card[], mode: HandSortMode): Card[] {
  return [...cards].sort((a, b) => {
    if (mode === "suit") {
      const suitDiff = suitIndex(a.suit) - suitIndex(b.suit);
      return suitDiff !== 0 ? suitDiff : a.rank - b.rank;
    }
    const rankDiff = a.rank - b.rank;
    return rankDiff !== 0 ? rankDiff : suitIndex(a.suit) - suitIndex(b.suit);
  });
}
