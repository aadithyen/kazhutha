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
