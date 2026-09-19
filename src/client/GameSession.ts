import {
    createInitialState,
    createRng,
    reduce,
    type GameAction,
    type GameEvent,
    type GameState,
} from '../core';

/**
 * Local game session — wraps the pure reducer for Phaser UI.
 * A future `NetworkSession` will implement the same interface over WebSocket.
 */
export interface GameSession {
    readonly state: GameState;
    readonly computerCaptains: readonly string[];
    dispatch(action: GameAction): GameEvent[];
}

export function createLocalSession(
    seed: string,
    playerCount = 6,
    lapsToWin = 3,
    computerCaptains: readonly string[] = [],
): GameSession {
    let state = createInitialState(seed, { playerCount, lapsToWin });
    const rng = createRng(seed);

    return {
        computerCaptains: [...computerCaptains],
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

export function isComputerTurn(session: GameSession): boolean {
    const state = session.state;
    if (state.phase === 'finished') return false;
    if (state.phase === 'crew')
        return session.computerCaptains.includes(state.activeCrewId!);
    if (state.activePlayerId)
        return session.computerCaptains.includes(
            state.ships[state.activePlayerId].ownerId,
        );
    return state.phase === 'combat' && session.computerCaptains.length > 0;
}
