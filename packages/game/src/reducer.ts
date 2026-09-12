import { GameEvent } from "./events";
import { createInitialState, EVENT_LOG_LIMIT, GameState } from "./state";

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

/** Who opens the round: leader when they still hold cards, otherwise next seated player who can act. */
export function firstActorForRound(state: GameState): string | null {
  const { leaderId } = state;
  if (!leaderId) return null;
  if (
    !state.finishedPlayers.includes(leaderId) &&
    (state.hands[leaderId]?.length ?? 0) > 0
  ) {
    return leaderId;
  }
  return nextActor(state);
}

/** Active player with an empty hand waiting for the current round to finish normally. */
export function isStraggler(state: GameState, playerId: string): boolean {
  return (
    state.phase === "playing" &&
    state.activePlayers.includes(playerId) &&
    !state.finishedPlayers.includes(playerId) &&
    (state.hands[playerId]?.length ?? 0) === 0
  );
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
  const log = state.eventLog.length >= EVENT_LOG_LIMIT ? state.eventLog.slice(-(EVENT_LOG_LIMIT - 1)) : state.eventLog;
  return { ...next, eventLog: [...log, event] };
}

/** Fill fields a snapshot from an older build or persisted session may lack. */
export function normalizeState(state: GameState): GameState {
  const base = createInitialState(state.roomCode);
  return { ...base, ...state, eventLog: state.eventLog ?? [] };
}

/** Snapshot payload: drop the event log so joins and persistence stay small. */
export function snapshotOf(state: GameState): GameState {
  return { ...state, eventLog: [] };
}

/** Lobby-shaped state that keeps the room, host, ban list and roster. */
function resetToLobby(state: GameState): GameState {
  const base = createInitialState(state.roomCode);
  return {
    ...base,
    hostId: state.hostId,
    rules: state.rules,
    players: state.players.map((p) => ({ ...p, ready: false })),
    kickedPlayerIds: state.kickedPlayerIds ?? [],
    eventLog: state.eventLog,
  };
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

    case "PlayerKicked": {
      const kicked = state.kickedPlayerIds ?? [];
      return {
        ...state,
        players: state.players.filter((p) => p.id !== event.playerId),
        turnOrder: state.turnOrder.filter((id) => id !== event.playerId),
        activePlayers: state.activePlayers.filter((id) => id !== event.playerId),
        kickedPlayerIds: kicked.includes(event.playerId) ? kicked : [...kicked, event.playerId],
      };
    }

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
        // Players who were listed but offline at start are not seated; drop them from the roster.
        players: state.players.filter((p) => event.turnOrder.includes(p.id)),
        turnOrder: event.turnOrder,
        activePlayers: event.turnOrder.slice(),
        finishedPlayers: [],
        kazhuthaId: null,
        successorHostId: null,
        lastRoundResult: null,
        cardCountVisible: Object.fromEntries(event.turnOrder.map((id) => [id, true])),
      };

    case "CardsShuffled":
      return { ...state, seed: event.seed };

    case "CardsDealt": {
      const dealt: GameState = {
        ...state,
        hands: event.hands,
        leaderId: event.leaderId,
        leadSuit: null,
        highestCard: null,
        centerPile: [],
        playedThisRound: [],
        roundNumber: 1,
      };
      return {
        ...dealt,
        currentTurnId: firstActorForRound(dealt) ?? event.leaderId,
      };
    }

    case "RoundStarted": {
      const round: GameState = {
        ...state,
        leaderId: event.leaderId,
        leadSuit: null,
        highestCard: null,
        centerPile: [],
        playedThisRound: [],
        roundNumber: event.roundNumber,
      };
      return {
        ...round,
        currentTurnId: firstActorForRound(round) ?? event.leaderId,
      };
    }

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
        lastRoundResult: {
          kind: "vettu",
          vettuBy: event.playerId,
          pile: state.centerPile,
          at: event.at,
        },
      };

    case "RoundFinished": {
      const pile = state.centerPile;
      return {
        ...state,
        centerPile: [],
        lastRoundResult: { kind: "normal", winnerId: event.winnerId, pile, at: event.at },
      };
    }

    case "CardsCollected": {
      const existing = state.hands[event.collectorId] ?? [];
      const pile = state.centerPile;
      return {
        ...state,
        hands: { ...state.hands, [event.collectorId]: [...existing, ...event.cards] },
        centerPile: [],
        // Host got cards back, so the advisory successor no longer applies.
        successorHostId: event.collectorId === state.hostId ? null : state.successorHostId,
        lastRoundResult: {
          kind: "vettu",
          vettuBy: state.lastRoundResult?.kind === "vettu" ? state.lastRoundResult.vettuBy : undefined,
          collectorId: event.collectorId,
          pile,
          at: event.at,
        },
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

    case "CardCountVisibilityChanged":
      return {
        ...state,
        cardCountVisible: { ...state.cardCountVisible, [event.playerId]: event.visible },
      };

    case "StateSnapshot":
      return normalizeState(event.state);

    case "ReturnedToLobby":
      return resetToLobby(state);

    case "GamePaused":
      return { ...state, paused: true };

    case "GameResumed":
      return { ...state, paused: false };

    case "HostSuccessorAssigned":
      return { ...state, successorHostId: event.successorHostId };

    case "HostTransferred":
      return {
        ...state,
        hostId: event.newHostId,
        successorHostId: null,
        players: state.players.map((p) => ({ ...p, isHost: p.id === event.newHostId })),
      };

    default:
      return state;
  }
}

export function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce(applyEvent, state);
}
