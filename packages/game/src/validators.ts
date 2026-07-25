import { Card, isAceOfSpades } from "@kazhutha/shared";
import { GameState } from "./state";

export function isLeadPlay(state: GameState): boolean {
  return state.centerPile.length === 0;
}

/** Cards a player is currently allowed to play, respecting follow-suit and the ace-of-spades opener rule. */
export function getLegalCards(state: GameState, playerId: string): Card[] {
  const hand = state.hands[playerId] ?? [];
  if (state.phase !== "playing" || state.currentTurnId !== playerId) return [];

  if (isLeadPlay(state)) {
    if (state.roundNumber === 1 && state.rules.mustLeadAceOfSpades && playerId === state.leaderId) {
      const ace = hand.find(isAceOfSpades);
      return ace ? [ace] : hand;
    }
    return hand;
  }

  const leadSuitCards = hand.filter((c) => c.suit === state.leadSuit);
  return leadSuitCards.length > 0 ? leadSuitCards : hand;
}

export function isCardLegal(state: GameState, playerId: string, card: Card): boolean {
  return getLegalCards(state, playerId).some((c) => c.suit === card.suit && c.rank === card.rank);
}

export function isVettuPlay(state: GameState, playerId: string, card: Card): boolean {
  if (isLeadPlay(state)) return false;
  const hand = state.hands[playerId] ?? [];
  const hasLeadSuit = hand.some((c) => c.suit === state.leadSuit);
  return !hasLeadSuit && card.suit !== state.leadSuit;
}
