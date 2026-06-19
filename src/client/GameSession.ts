import { createInitialState, createRng, reduce, type GameAction, type GameEvent, type GameState } from '../core';

/**
 * Local game session — wraps the pure reducer for Phaser UI.
 * A future `NetworkSession` will implement the same interface over WebSocket.
 */
export interface GameSession {
    readonly state: GameState;
    dispatch(action: GameAction): GameEvent[];
}

export function createLocalSession(seed: string, playerCount = 6): GameSession {
    let state = createInitialState(seed, { playerCount });
    const rng = createRng(seed);

    return {
        get state() {
            return state;
        },
        dispatch(action: GameAction) {
            const result = reduce(state, action, rng);
            state = result.state;
            return result.events;
        },
    };
}
