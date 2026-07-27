import { Card, Player, RuleConfig } from "@kazhutha/shared";
import { GameState } from "./state";

export interface RoomCreatedEvent {
  type: "RoomCreated";
  roomCode: string;
  hostId: string;
}

export interface PlayerJoinedEvent {
  type: "PlayerJoined";
  player: Player;
}

export interface PlayerLeftEvent {
  type: "PlayerLeft";
  playerId: string;
}

export interface PlayerKickedEvent {
  type: "PlayerKicked";
  playerId: string;
}

export interface PlayerReadyChangedEvent {
  type: "PlayerReadyChanged";
  playerId: string;
  ready: boolean;
}

export interface RulesChangedEvent {
  type: "RulesChanged";
  rules: RuleConfig;
}

export interface GameStartedEvent {
  type: "GameStarted";
  turnOrder: string[];
}

export interface CardsShuffledEvent {
  type: "CardsShuffled";
  seed: number;
}

export interface CardsDealtEvent {
  type: "CardsDealt";
  hands: Record<string, Card[]>;
  leaderId: string;
}

export interface RoundStartedEvent {
  type: "RoundStarted";
  leaderId: string;
  roundNumber: number;
}

export interface CardPlayedEvent {
  type: "CardPlayed";
  playerId: string;
  card: Card;
}

export interface VettuOccurredEvent {
  type: "VettuOccurred";
  playerId: string;
  card: Card;
}

export interface RoundFinishedEvent {
  type: "RoundFinished";
  winnerId: string;
}

export interface CardsCollectedEvent {
  type: "CardsCollected";
  collectorId: string;
  cards: Card[];
}

export interface PlayerExitedEvent {
  type: "PlayerExited";
  playerId: string;
  order: number;
}

export interface GameFinishedEvent {
  type: "GameFinished";
  kazhuthaId: string;
}

export interface CardCountVisibilityChangedEvent {
  type: "CardCountVisibilityChanged";
  playerId: string;
  visible: boolean;
}

export interface StateSnapshotEvent {
  type: "StateSnapshot";
  state: GameState;
}

export interface ActingHostElectedEvent {
  type: "ActingHostElected";
  actingHostId: string;
}

export interface ActingHostReleasedEvent {
  type: "ActingHostReleased";
}

export interface HostSuccessorAssignedEvent {
  type: "HostSuccessorAssigned";
  successorHostId: string;
}

export interface HostTransferredEvent {
  type: "HostTransferred";
  newHostId: string;
}

export type GameEvent =
  | RoomCreatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerKickedEvent
  | PlayerReadyChangedEvent
  | RulesChangedEvent
  | GameStartedEvent
  | CardsShuffledEvent
  | CardsDealtEvent
  | RoundStartedEvent
  | CardPlayedEvent
  | VettuOccurredEvent
  | RoundFinishedEvent
  | CardsCollectedEvent
  | PlayerExitedEvent
  | GameFinishedEvent
  | CardCountVisibilityChangedEvent
  | StateSnapshotEvent
  | ActingHostElectedEvent
  | ActingHostReleasedEvent
  | HostSuccessorAssignedEvent
  | HostTransferredEvent;

export type GameEventType = GameEvent["type"];

export type Intent =
  | { type: "CreateRoom"; playerId: string; name: string }
  | { type: "JoinRoom"; playerId: string; name: string }
  | { type: "SetReady"; playerId: string; ready: boolean }
  | { type: "ChangeRules"; playerId: string; rules: RuleConfig }
  | { type: "KickPlayer"; playerId: string; target: string }
  | { type: "StartGame"; playerId: string }
  | { type: "PlayCard"; playerId: string; card: Card }
  | { type: "RequestSnapshot"; playerId: string }
  | { type: "SetCardCountVisible"; playerId: string; visible: boolean };

export interface IntentRejected {
  type: "IntentRejected";
  intent: Intent;
  reason: string;
}
