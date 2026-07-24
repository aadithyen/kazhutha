import { GameEvent } from "./events";
import { GameState } from "./state";

/**
 * Finds the next player who still owes an action this round, walking the
 * fixed seating order starting right after the leader. Players who already
 * finished the game, or who are holding zero cards (a "straggler" waiting on
 * a future vettu collection), are skipped automatically. Returns null once
 * the walk loops all the way back to the leader, meaning the round is over.
 */
export function nextActor(state: GameState): string | null {
  const { turnOrder, leaderId } = state;
  if (!leaderId || turnOrder.length === 0) return null;
  const leaderIdx = turnOrder.indexOf(leaderId);
  if (leaderIdx === -1) return null;
  const n = turnOrder.length;
  for (let step = 1; step <= n; step++) {
    const id = turnOrder[(leaderIdx + step) % n];
    if (id === leaderId) return null;
    if (state.finishedPlayers.includes(id)) continue;
    if (state.playedThisRound.includes(id)) continue;
    if ((state.hands[id]?.length ?? 0) === 0) continue;
    return id;
  }
  return null;
}

/** First still-active player at or after `fromId` in the fixed seating order. */
export function firstActiveFrom(turnOrder: string[], activePlayers: string[], fromId: string): string {
  const idx = turnOrder.indexOf(fromId);
  const n = turnOrder.length;
  for (let step = 0; step < n; step++) {
    const id = turnOrder[(idx + step) % n];
    if (activePlayers.includes(id)) return id;
  }
  return fromId;
}

export function applyEvent(state: GameState, event: GameEvent): GameState {
  const next = applyEventInner(state, event);
  if (event.type === "StateSnapshot") return next;
  return { ...next, eventLog: [...state.eventLog, event] };
}

function applyEventInner(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "RoomCreated":
      return { ...state, roomCode: event.roomCode, hostId: event.hostId };

    case "PlayerJoined": {
      const exists = state.players.some((p) => p.id === event.player.id);
      const players = exists
        ? state.players.map((p) => (p.id === event.player.id ? { ...event.player } : p))
        : [...state.players, event.player];
      return { ...state, players };
    }

    case "PlayerLeft":
      return {
        ...state,
        players: state.players.map((p) => (p.id === event.playerId ? { ...p, connected: false } : p)),
      };

    case "PlayerKicked":
      return {
        ...state,
        players: state.players.filter((p) => p.id !== event.playerId),
        turnOrder: state.turnOrder.filter((id) => id !== event.playerId),
        activePlayers: state.activePlayers.filter((id) => id !== event.playerId),
      };

    case "PlayerReadyChanged":
      return {
        ...state,
        players: state.players.map((p) => (p.id === event.playerId ? { ...p, ready: event.ready } : p)),
      };

    case "RulesChanged":
      return { ...state, rules: event.rules };

    case "GameStarted":
      return {
        ...state,
        phase: "playing",
        turnOrder: event.turnOrder,
        activePlayers: event.turnOrder.slice(),
        finishedPlayers: [],
        kazhuthaId: null,
      };

    case "CardsShuffled":
      return { ...state, seed: event.seed };

    case "CardsDealt":
      return {
        ...state,
        hands: event.hands,
        leaderId: event.leaderId,
        currentTurnId: event.leaderId,
        leadSuit: null,
        highestCard: null,
        centerPile: [],
        playedThisRound: [],
        roundNumber: 1,
      };

    case "RoundStarted":
      return {
        ...state,
        leaderId: event.leaderId,
        currentTurnId: event.leaderId,
        leadSuit: null,
        highestCard: null,
        centerPile: [],
        playedThisRound: [],
        roundNumber: event.roundNumber,
      };

    case "CardPlayed": {
      const hand = state.hands[event.playerId] ?? [];
      const remainingHand = hand.filter(
        (c) => !(c.suit === event.card.suit && c.rank === event.card.rank),
      );
      const centerPile = [...state.centerPile, { playerId: event.playerId, card: event.card }];
      const isLead = state.centerPile.length === 0;
      const leadSuit = isLead ? event.card.suit : state.leadSuit;
      const isLeadSuitCard = event.card.suit === leadSuit;
      const highestCard =
        isLeadSuitCard && (!state.highestCard || event.card.rank > state.highestCard.card.rank)
          ? { playerId: event.playerId, card: event.card }
          : state.highestCard;
      const playedThisRound = [...state.playedThisRound, event.playerId];
      const workingState: GameState = {
        ...state,
        hands: { ...state.hands, [event.playerId]: remainingHand },
        centerPile,
        leadSuit,
        highestCard,
        playedThisRound,
      };
      const upcoming = nextActor(workingState);
      return { ...workingState, currentTurnId: upcoming ?? state.leaderId };
    }

    case "VettuOccurred":
      return {
        ...state,
        lastRoundResult: { kind: "vettu", vettuBy: event.playerId, at: Date.now() },
      };

    case "RoundFinished":
      return {
        ...state,
        centerPile: [],
        lastRoundResult: { kind: "normal", winnerId: event.winnerId, at: Date.now() },
      };

    case "CardsCollected": {
      const existing = state.hands[event.collectorId] ?? [];
      return {
        ...state,
        hands: { ...state.hands, [event.collectorId]: [...existing, ...event.cards] },
        centerPile: [],
        lastRoundResult: { kind: "vettu", collectorId: event.collectorId, at: Date.now() },
      };
    }

    case "PlayerExited":
      return {
        ...state,
        activePlayers: state.activePlayers.filter((id) => id !== event.playerId),
        finishedPlayers: [...state.finishedPlayers, event.playerId],
      };

    case "GameFinished":
      return { ...state, phase: "finished", kazhuthaId: event.kazhuthaId, currentTurnId: null };

    case "StateSnapshot":
      return event.state;

    default:
      return state;
  }
}

export function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce(applyEvent, state);
}
