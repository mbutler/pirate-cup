import {
    assignPersonalities,
    type CaptainPersonalities,
} from '../core/ai/Personality';
import { parseSave, SAVE_VERSION, type RaceSave } from './RaceSave';
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
    readonly personalities: CaptainPersonalities;
    readonly computerCaptains: readonly string[];
    dispatch(action: GameAction): GameEvent[];
    snapshot(): RaceSave;
    setSaveHandler(handler: (() => void) | null): void;
}

export function createLocalSession(
    seed: string,
    playerCount = 6,
    lapsToWin = 3,
    computerCaptains: readonly string[] = [],
    personalityChoices: CaptainPersonalities = {},
): GameSession {
    let state = createInitialState(seed, { playerCount, lapsToWin });
    const rng = createRng(seed);
    const personalities = assignPersonalities(
        seed,
        computerCaptains,
        personalityChoices,
    );
    const actions: GameAction[] = [];
    let saveHandler: (() => void) | null = null;

    return {
        personalities,
        computerCaptains: [...computerCaptains],
        snapshot() {
            return structuredClone({
                format: 'pirate-cup',
                version: SAVE_VERSION,
                seed,
                playerCount,
                lapsToWin,
                computerCaptains: [...computerCaptains],
                personalities,
                actions,
            });
        },
        setSaveHandler(handler) {
            saveHandler = handler;
        },
        get state() {
            return state;
        },
        dispatch(action: GameAction) {
            const result = reduce(state, action, rng);
            state = result.state;
            actions.push(structuredClone(action));
            saveHandler?.();
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

/** Replay restores the entire reducer state and the exact random stream. */
export function restoreSession(text: string): GameSession {
    const save = parseSave(text);
    const session = createLocalSession(
        save.seed,
        save.playerCount,
        save.lapsToWin,
        save.computerCaptains,
        save.personalities,
    );
    for (const action of save.actions) session.dispatch(action);
    return session;
}
