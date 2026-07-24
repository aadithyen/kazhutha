export type Suit = "S" | "H" | "D" | "C";

/** 11=J, 12=Q, 13=K, 14=A. Ace is highest. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
}

export interface RuleConfig {
  /** If true, the Ace-of-Spades holder must lead it in round 1. If false, they may lead any card. */
  mustLeadAceOfSpades: boolean;
}

export const DEFAULT_RULES: RuleConfig = {
  mustLeadAceOfSpades: true,
};

export const SUITS: Suit[] = ["S", "H", "D", "C"];

export const SUIT_NAMES: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

/** Red suits render red, black suits render as near-black. Colorblind-safe via shape + letter, not color alone. */
export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  S: "black",
  C: "black",
  H: "red",
  D: "red",
};
