import { Card, createDeck, isAceOfSpades, Player, randomSeed, shuffle } from "@kazhutha/shared";
import { GameEvent, Intent } from "./events";
import { electSuccessorHost, isHostConnected } from "./host";
import { applyEvents } from "./reducer";
import { GameState } from "./state";
import { isCardLegal, isVettuPlay } from "./validators";
import { firstActiveFrom, nextActor } from "./reducer";

function activePlayersWithCards(state: GameState): string[] {
  return state.activePlayers.filter((id) => (state.hands[id]?.length ?? 0) > 0);
}

export type HostResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

const ok = (events: GameEvent[]): HostResult => ({ ok: true, events });
const fail = (reason: string): HostResult => ({ ok: false, reason });

function isLobbyHost(state: GameState, playerId: string): boolean {
  return state.hostId === playerId;
}

/**
 * Only ever runs on the room authority peer. Validates an intent against the
 * authoritative state and returns the batch of events to broadcast, or a
 * rejection. All events are pure data so every peer (including the authority)
 * reaches identical state by folding them through the same reducer.
 */
export function processIntent(state: GameState, intent: Intent): HostResult {
  switch (intent.type) {
    case "JoinRoom": {
      const existing = state.players.find((p) => p.id === intent.playerId);
      const player: Player = existing
        ? { ...existing, connected: true }
        : {
            id: intent.playerId,
            name: intent.name.slice(0, 24) || "Player",
            isHost: intent.playerId === state.hostId,
            connected: true,
            ready: false,
          };
      const events: GameEvent[] = [{ type: "PlayerJoined", player }];
      if (intent.playerId === state.hostId && state.paused && state.phase === "playing") {
        events.push({ type: "GameResumed" });
      }
      return ok(events);
    }

    case "SetReady": {
      const player = state.players.find((p) => p.id === intent.playerId);
      if (!player) return fail("Unknown player");
      return ok([{ type: "PlayerReadyChanged", playerId: intent.playerId, ready: intent.ready }]);
    }

    case "ChangeRules": {
      if (!isLobbyHost(state, intent.playerId)) return fail("Only the host can change rules");
      if (state.phase !== "lobby") return fail("Rules can only change before the game starts");
      return ok([{ type: "RulesChanged", rules: intent.rules }]);
    }

    case "KickPlayer": {
      if (!isLobbyHost(state, intent.playerId)) return fail("Only the host can kick players");
      if (intent.target === state.hostId) return fail("Host cannot kick themselves");
      return ok([{ type: "PlayerKicked", playerId: intent.target }]);
    }

    case "StartGame":
      return startGame(state, intent.playerId);

    case "PlayCard":
      return playCard(state, intent.playerId, intent.card);

    case "RequestSnapshot":
      return ok([{ type: "StateSnapshot", state }]);

    case "SetCardCountVisible": {
      if (state.phase !== "playing") return fail("Can only change card count visibility during a game");
      if (!state.players.some((p) => p.id === intent.playerId)) return fail("Unknown player");
      return ok([
        { type: "CardCountVisibilityChanged", playerId: intent.playerId, visible: intent.visible },
      ]);
    }

    default:
      return fail("Unknown intent");
  }
}

function startGame(state: GameState, requesterId: string): HostResult {
  if (!isLobbyHost(state, requesterId)) return fail("Only the host can start the game");
  if (state.phase !== "lobby") return fail("Game already started");
  const connected = state.players.filter((p) => p.connected);
  if (connected.length < 2) return fail("Need at least 2 players");
  if (connected.length > 10) return fail("Too many players (max 10)");

  const turnOrder = connected.map((p) => p.id);
  const seed = randomSeed();
  const deck = shuffle(createDeck(), seed);

  const hands: Record<string, Card[]> = {};
  turnOrder.forEach((id) => (hands[id] = []));
  deck.forEach((card, i) => hands[turnOrder[i % turnOrder.length]].push(card));

  let leaderId = turnOrder[0];
  for (const id of turnOrder) {
    if (hands[id].some(isAceOfSpades)) {
      leaderId = id;
      break;
    }
  }

  return ok([
    { type: "GameStarted", turnOrder },
    { type: "CardsShuffled", seed },
    { type: "CardsDealt", hands, leaderId },
  ]);
}

function playCard(state: GameState, playerId: string, card: Card): HostResult {
  if (state.phase !== "playing") return fail("Game is not in progress");
  if (state.paused) return fail("Game is paused");
  if (state.currentTurnId !== playerId) return fail("Not your turn");
  const hand = state.hands[playerId] ?? [];
  if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return fail("Card not in hand");
  if (!isCardLegal(state, playerId, card)) return fail("Illegal move");

  const playedEvent: GameEvent = { type: "CardPlayed", playerId, card };
  const vettu = isVettuPlay(state, playerId, card);
  const afterPlay = applyEvents(state, [playedEvent]);
  const events: GameEvent[] = [playedEvent];

  if (playerId === state.hostId && (afterPlay.hands[playerId]?.length ?? 0) === 0) {
    const successor = electSuccessorHost(afterPlay, playerId);
    if (successor) {
      events.push({ type: "HostSuccessorAssigned", successorHostId: successor });
    }
  }

  if (vettu) {
    const vettuEvent: GameEvent = { type: "VettuOccurred", playerId, card };
    const collectorId = afterPlay.highestCard?.playerId ?? state.leaderId!;
    const collectedEvent: GameEvent = { type: "CardsCollected", collectorId, cards: afterPlay.centerPile.map((p) => p.card) };
    const roundStartedEvent: GameEvent = {
      type: "RoundStarted",
      leaderId: collectorId,
      roundNumber: state.roundNumber + 1,
    };
  return ok([...events, vettuEvent, collectedEvent, roundStartedEvent]);
  }

  if (nextActor(afterPlay) !== null) {
    return ok(events);
  }

  const winnerId = afterPlay.highestCard!.playerId;
  const finishedEvent: GameEvent = { type: "RoundFinished", winnerId };
  const afterFinish = applyEvents(afterPlay, [finishedEvent]);
  events.push(finishedEvent);

  let exitCandidates = state.activePlayers.filter((id) => (afterFinish.hands[id]?.length ?? 0) === 0);
  if (exitCandidates.length === state.activePlayers.length) {
    exitCandidates = exitCandidates.filter((id) => id !== winnerId);
  }
  const exitOrder = state.turnOrder.filter((id) => exitCandidates.includes(id));

  let runningState = afterFinish;
  exitOrder.forEach((id, i) => {
    const evt: GameEvent = { type: "PlayerExited", playerId: id, order: state.finishedPlayers.length + i + 1 };
    events.push(evt);
    runningState = applyEvents(runningState, [evt]);
    if (id === state.hostId) {
      const successor =
        runningState.successorHostId ?? electSuccessorHost(runningState, id);
      if (successor) {
        const transfer: GameEvent = { type: "HostTransferred", newHostId: successor };
        events.push(transfer);
        runningState = applyEvents(runningState, [transfer]);
      }
    }
  });

  const remaining = runningState.activePlayers;
  if (remaining.length <= 1) {
    const kazhuthaId = remaining[0] ?? winnerId;
    events.push({ type: "GameFinished", kazhuthaId });
    return ok(events);
  }

  const withCards = activePlayersWithCards(runningState);
  if (withCards.length === 1) {
    events.push({ type: "GameFinished", kazhuthaId: withCards[0] });
    return ok(events);
  }

  const nextLeader = remaining.includes(winnerId) ? winnerId : firstActiveFrom(state.turnOrder, remaining, winnerId);
  events.push({ type: "RoundStarted", leaderId: nextLeader, roundNumber: state.roundNumber + 1 });
  return ok(events);
}

/** All peers apply locally when host disconnects during play. */
export function eventsForHostDisconnect(state: GameState): GameEvent[] {
  if (state.phase !== "playing") return [];
  if (!state.hostId) return [];
  if (state.paused) return [];
  if (isHostConnected(state)) return [];
  return [{ type: "GamePaused", reason: "host-disconnected" }];
}
