import { Card, createDeck, isAceOfSpades, Player, randomSeed, shuffle } from "@kazhutha/shared";
import { GameEvent, Intent } from "./events";
import { electSuccessorHost, isHostConnected } from "./host";
import { applyEvents, firstActiveFrom, nextActor } from "./reducer";
import { GameState } from "./state";
import { isCardLegal, isVettuPlay } from "./validators";

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
      if ((state.kickedPlayerIds ?? []).includes(intent.playerId)) return fail("Removed from this room");
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
      // Host already out of the game only because nobody seated was online when
      // they exited; hand over as soon as a seated player is back.
      if (
        state.phase === "playing" &&
        state.hostId &&
        state.finishedPlayers.includes(state.hostId) &&
        state.activePlayers.includes(intent.playerId)
      ) {
        events.push({ type: "HostTransferred", newHostId: intent.playerId });
      }
      return ok(events);
    }

    case "SetReady": {
      if (state.phase !== "lobby") return fail("Game already started");
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
      if (state.phase !== "lobby") return fail("Players can only be removed before the game starts");
      if (intent.target === state.hostId) return fail("Host cannot kick themselves");
      if (!state.players.some((p) => p.id === intent.target)) return fail("Unknown player");
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

    case "ReturnToLobby": {
      if (!isLobbyHost(state, intent.playerId)) return fail("Only the host can return to the lobby");
      if (state.phase !== "finished") return fail("Game is not finished");
      return ok([{ type: "ReturnedToLobby" }]);
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
  if (!connected.every((p) => p.ready)) return fail("Everyone must be ready");

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

/**
 * Exit every candidate (seating order), then hand the host role to a player
 * who is still seated and connected if the host was among them. Election runs
 * after all exits so a successor can never be someone who left in the same
 * round. Returns the state after the appended events.
 */
function exitPlayers(
  state: GameState,
  events: GameEvent[],
  candidates: string[],
  fallbackKazhutha: string,
): { state: GameState; finished: boolean } {
  const exitOrder = state.turnOrder.filter((id) => candidates.includes(id));
  let running = state;
  exitOrder.forEach((id, i) => {
    const evt: GameEvent = { type: "PlayerExited", playerId: id, order: state.finishedPlayers.length + i + 1 };
    events.push(evt);
    running = applyEvents(running, [evt]);
  });

  if (finishIfDecided(running, events, fallbackKazhutha)) return { state: running, finished: true };

  // Only hand off when play continues: at game over the finished host is still
  // connected and keeps the room (and the "Play again" control).
  if (state.hostId && exitOrder.includes(state.hostId)) {
    const successor = electSuccessorHost(running, state.hostId);
    if (successor) {
      const transfer: GameEvent = { type: "HostTransferred", newHostId: successor };
      events.push(transfer);
      running = applyEvents(running, [transfer]);
    }
  }
  return { state: running, finished: false };
}

/** True when at most one seated player still holds cards; appends GameFinished. */
function finishIfDecided(state: GameState, events: GameEvent[], fallbackKazhutha: string): boolean {
  const remaining = state.activePlayers;
  if (remaining.length <= 1) {
    events.push({ type: "GameFinished", kazhuthaId: remaining[0] ?? fallbackKazhutha });
    return true;
  }
  const withCards = activePlayersWithCards(state);
  if (withCards.length <= 1) {
    events.push({ type: "GameFinished", kazhuthaId: withCards[0] ?? fallbackKazhutha });
    return true;
  }
  return false;
}

function playCard(state: GameState, playerId: string, card: Card): HostResult {
  if (state.phase !== "playing") return fail("Game is not in progress");
  if (state.paused) return fail("Game is paused");
  if (state.currentTurnId !== playerId) return fail("Not your turn");
  const hand = state.hands[playerId] ?? [];
  if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return fail("Card not in hand");
  if (!isCardLegal(state, playerId, card)) return fail("Illegal move");

  const at = Date.now();
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
    const collectorId = afterPlay.highestCard?.playerId ?? state.leaderId!;
    const vettuEvent: GameEvent = { type: "VettuOccurred", playerId, card, at };
    const collectedEvent: GameEvent = {
      type: "CardsCollected",
      collectorId,
      cards: afterPlay.centerPile.map((p) => p.card),
      at,
    };
    events.push(vettuEvent, collectedEvent);
    const afterCollect = applyEvents(afterPlay, [vettuEvent, collectedEvent]);

    // A vettu can leave a single player holding every card; nobody else has a
    // move, so exit the empty hands and finish instead of forcing a lone play.
    if (activePlayersWithCards(afterCollect).length <= 1) {
      const empty = afterCollect.activePlayers.filter((id) => (afterCollect.hands[id]?.length ?? 0) === 0);
      if (exitPlayers(afterCollect, events, empty, collectorId).finished) return ok(events);
    }

    events.push({ type: "RoundStarted", leaderId: collectorId, roundNumber: state.roundNumber + 1 });
    return ok(events);
  }

  if (nextActor(afterPlay) !== null) {
    return ok(events);
  }

  const winnerId = afterPlay.highestCard!.playerId;
  const finishedEvent: GameEvent = { type: "RoundFinished", winnerId, at };
  const afterFinish = applyEvents(afterPlay, [finishedEvent]);
  events.push(finishedEvent);

  let exitCandidates = state.activePlayers.filter((id) => (afterFinish.hands[id]?.length ?? 0) === 0);
  if (exitCandidates.length === state.activePlayers.length) {
    exitCandidates = exitCandidates.filter((id) => id !== winnerId);
  }

  const { state: settled, finished } = exitPlayers(afterFinish, events, exitCandidates, winnerId);
  if (finished) return ok(events);

  const remaining = settled.activePlayers;
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
