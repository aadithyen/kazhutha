import { Card, createDeck, isAceOfSpades, Player, randomSeed, shuffle } from "@kazhutha/shared";
import { GameEvent, Intent } from "./events";
import { applyEvents } from "./reducer";
import { GameState } from "./state";
import { isCardLegal, isVettuPlay } from "./validators";
import { firstActiveFrom, nextActor } from "./reducer";

export type HostResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

const ok = (events: GameEvent[]): HostResult => ({ ok: true, events });
const fail = (reason: string): HostResult => ({ ok: false, reason });

/**
 * Only ever runs on the room host. Validates an intent against the
 * authoritative state and returns the batch of events to broadcast, or a
 * rejection. All events are pure data so every peer (including the host)
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
            isHost: state.players.length === 0,
            connected: true,
            ready: false,
          };
      return ok([{ type: "PlayerJoined", player }]);
    }

    case "SetReady": {
      const player = state.players.find((p) => p.id === intent.playerId);
      if (!player) return fail("Unknown player");
      return ok([{ type: "PlayerReadyChanged", playerId: intent.playerId, ready: intent.ready }]);
    }

    case "ChangeRules": {
      if (intent.playerId !== state.hostId) return fail("Only the host can change rules");
      if (state.phase !== "lobby") return fail("Rules can only change before the game starts");
      return ok([{ type: "RulesChanged", rules: intent.rules }]);
    }

    case "KickPlayer": {
      if (intent.playerId !== state.hostId) return fail("Only the host can kick players");
      if (intent.target === state.hostId) return fail("Host cannot kick themselves");
      return ok([{ type: "PlayerKicked", playerId: intent.target }]);
    }

    case "StartGame":
      return startGame(state, intent.playerId);

    case "PlayCard":
      return playCard(state, intent.playerId, intent.card);

    case "RequestSnapshot":
      return ok([{ type: "StateSnapshot", state }]);

    default:
      return fail("Unknown intent");
  }
}

function startGame(state: GameState, requesterId: string): HostResult {
  if (requesterId !== state.hostId) return fail("Only the host can start the game");
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
  if (state.currentTurnId !== playerId) return fail("Not your turn");
  const hand = state.hands[playerId] ?? [];
  if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return fail("Card not in hand");
  if (!isCardLegal(state, playerId, card)) return fail("Illegal move");

  const playedEvent: GameEvent = { type: "CardPlayed", playerId, card };
  const vettu = isVettuPlay(state, playerId, card);
  const afterPlay = applyEvents(state, [playedEvent]);

  if (vettu) {
    const vettuEvent: GameEvent = { type: "VettuOccurred", playerId, card };
    const collectorId = afterPlay.highestCard?.playerId ?? state.leaderId!;
    const collectedCards = afterPlay.centerPile.map((p) => p.card);
    const collectedEvent: GameEvent = { type: "CardsCollected", collectorId, cards: collectedCards };
    const roundStartedEvent: GameEvent = {
      type: "RoundStarted",
      leaderId: collectorId,
      roundNumber: state.roundNumber + 1,
    };
    return ok([playedEvent, vettuEvent, collectedEvent, roundStartedEvent]);
  }

  if (nextActor(afterPlay) !== null) {
    return ok([playedEvent]);
  }

  const winnerId = afterPlay.highestCard!.playerId;
  const finishedEvent: GameEvent = { type: "RoundFinished", winnerId };
  const afterFinish = applyEvents(afterPlay, [finishedEvent]);
  const events: GameEvent[] = [playedEvent, finishedEvent];

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
  });

  const remaining = runningState.activePlayers;
  if (remaining.length <= 1) {
    const kazhuthaId = remaining[0] ?? winnerId;
    events.push({ type: "GameFinished", kazhuthaId });
    return ok(events);
  }

  const nextLeader = remaining.includes(winnerId) ? winnerId : firstActiveFrom(state.turnOrder, remaining, winnerId);
  events.push({ type: "RoundStarted", leaderId: nextLeader, roundNumber: state.roundNumber + 1 });
  return ok(events);
}
