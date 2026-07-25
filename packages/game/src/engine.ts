import { GameEvent } from "./events";
import { applyEvent } from "./reducer";
import { createInitialState, GameState } from "./state";

export type Listener = (state: GameState) => void;

/** Thin observable holder around the reducer. UI subscribes; network layer feeds events in. */
export class GameEngine {
  private state: GameState;
  private listeners = new Set<Listener>();

  constructor(roomCode: string) {
    this.state = createInitialState(roomCode);
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(event: GameEvent): GameState {
    this.state = applyEvent(this.state, event);
    this.emit();
    return this.state;
  }

  applyMany(events: GameEvent[]): GameState {
    for (const event of events) {
      this.state = applyEvent(this.state, event);
    }
    this.emit();
    return this.state;
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}
