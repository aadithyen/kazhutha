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
  /** Full center pile at round end (CardPlayed + RoundFinished/CardsCollected may batch). */
  pile: PlayedCard[];
  at: number;
}

/** Reducer keeps only this many trailing events; the log is a debugging aid, not game state. */
export const EVENT_LOG_LIMIT = 200;

export interface GameState {
  roomCode: string;
  hostId: string | null;
  /** Game frozen until host returns (e.g. host disconnected mid-play). */
  paused: boolean;
  /**
   * Advisory pick made when the current host clears their hand. The actual
   * transfer re-elects at exit time, so this is only a UI hint.
   */
  successorHostId: string | null;
  players: Player[];
  /** Players removed by the host; their JoinRoom intents are rejected for this room. */
  kickedPlayerIds: string[];
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
  /** When true (default), other players see this player's hand size. Per-game; resets each GameStarted. */
  cardCountVisible: Record<string, boolean>;
  eventLog: GameEvent[];
}

export function createInitialState(roomCode: string): GameState {
  return {
    roomCode,
    hostId: null,
    paused: false,
    successorHostId: null,
    players: [],
    kickedPlayerIds: [],
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
    cardCountVisible: {},
    eventLog: [],
  };
}
