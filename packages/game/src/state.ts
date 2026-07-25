import { Card, DEFAULT_RULES, Player, RuleConfig, Suit } from "@kazhutha/shared";
import { GameEvent } from "./events";

export type GamePhase = "lobby" | "playing" | "finished";

export interface PlayedCard {
  playerId: string;
  card: Card;
}

export interface LastRoundResult {
  kind: "normal" | "vettu";
  winnerId?: string;
  collectorId?: string;
  vettuBy?: string;
  at: number;
}

export interface GameState {
  roomCode: string;
  hostId: string | null;
  players: Player[];
  rules: RuleConfig;
  phase: GamePhase;
  turnOrder: string[];
  roundNumber: number;
  hands: Record<string, Card[]>;
  centerPile: PlayedCard[];
  leadSuit: Suit | null;
  leaderId: string | null;
  currentTurnId: string | null;
  highestCard: PlayedCard | null;
  playedThisRound: string[];
  activePlayers: string[];
  finishedPlayers: string[];
  kazhuthaId: string | null;
  seed: number | null;
  lastRoundResult: LastRoundResult | null;
  eventLog: GameEvent[];
}

export function createInitialState(roomCode: string): GameState {
  return {
    roomCode,
    hostId: null,
    players: [],
    rules: DEFAULT_RULES,
    phase: "lobby",
    turnOrder: [],
    roundNumber: 0,
    hands: {},
    centerPile: [],
    leadSuit: null,
    leaderId: null,
    currentTurnId: null,
    highestCard: null,
    playedThisRound: [],
    activePlayers: [],
    finishedPlayers: [],
    kazhuthaId: null,
    seed: null,
    lastRoundResult: null,
    eventLog: [],
  };
}
