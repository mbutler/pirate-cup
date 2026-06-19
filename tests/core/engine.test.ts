import { describe, expect, it, vi } from 'vitest';
import * as decks from '../../src/core/cards/decks';
import { createRng } from '../../src/core/rng/Rng';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createGameConfig } from '../../src/core/config/GameConfig';
import { createShipState } from '../../src/core/state/GameState';

describe('GameEngine', () => {
    it('creates a configurable initial state', () => {
        const state = createInitialState('test-seed', { playerCount: 4, lapsToWin: 2 });

        expect(Object.keys(state.ships)).toHaveLength(4);
        expect(state.config.lapsToWin).toBe(2);
        expect(state.phase).toBe('input');
    });

    it('starts movement immediately when the active player submits speed', () => {
        const rng = createRng('test-seed');
        const result = reduce(createInitialState('test-seed', { playerCount: 2 }), {
            type: 'SUBMIT_TURN_INPUT',
            playerId: 'player-1',
            input: { speed: 3, moves: [] },
        }, rng);

        expect(result.state.phase).toBe('movement');
        expect(result.state.activePlayerId).toBe('player-1');
        expect(result.state.ships['player-1'].movementRemaining).toBe(3);
        expect(result.events.some((e) => e.type === 'PHASE_CHANGED')).toBe(true);
    });

    it('passes to the next captain after a ship finishes moving', () => {
        let state = createInitialState('test-seed', { playerCount: 2 });
        const rng = createRng('test-seed');

        state = reduce(state, {
            type: 'SUBMIT_TURN_INPUT',
            playerId: 'player-1',
            input: { speed: 0, moves: [] },
        }, rng).state;

        state = reduce(state, {
            type: 'FLOG_DECISION',
            playerId: 'player-1',
            flog: false,
        }, rng).state;

        expect(state.phase).toBe('input');
        expect(state.activePlayerId).toBe('player-2');
    });

    it('returns ram events when the final move of a turn is a ram', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('ram-last-move');

        let state = createInitialState('ram-last-move', { playerCount: 2 });
        state = {
            ...state,
            phase: 'movement',
            activePlayerId: 'player-1',
            ships: {
                'player-1': {
                    ...createShipState('player-1', 'red', 'a1', config),
                    chosenSpeed: 1,
                    movementRemaining: 1,
                },
                'player-2': createShipState('player-2', 'blue', 'a2', config),
            },
            inputs: {
                'player-1': { speed: 1, moves: [] },
            },
        };

        const result = reduce(state, {
            type: 'CHOOSE_MOVE',
            playerId: 'player-1',
            direction: 'forward',
        }, rng);

        expect(result.events.some((event) => event.type === 'RAMMING')).toBe(true);
        expect(result.events.some((event) => event.type === 'SHIP_MOVED')).toBe(true);
        expect(result.state.ships['player-1'].movementRemaining).toBe(0);
    });

    it('auto-rolls mutiny speed as sails plus d10 on turn start', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('mutiny-turn');

        let state = createInitialState('mutiny-turn', { playerCount: 2 });
        const baseShip = createShipState('player-1', 'red', 'a1', config);

        state = {
            ...state,
            phase: 'input',
            activePlayerId: 'player-1',
            ships: {
                'player-1': {
                    ...baseShip,
                    rowers: { ...baseShip.rowers, temperament: 'mutiny' },
                },
                'player-2': createShipState('player-2', 'blue', 'b1', config),
            },
        };

        const result = reduce(state, {
            type: 'SUBMIT_TURN_INPUT',
            playerId: 'player-1',
            input: { speed: 2, moves: [] },
        }, rng);

        expect(result.events.some((event) => event.type === 'MUTINY_SPEED_ROLLED')).toBe(true);
        expect(result.state.phase).toBe('movement');
        expect(result.state.ships['player-1'].chosenSpeed).toBeGreaterThan(baseShip.maxSpeed);
        expect(result.state.ships['player-1'].movementRemaining).toBe(result.state.ships['player-1'].chosenSpeed);
        expect(result.state.ships['player-1'].flogAttemptsRemaining).toBe(0);
    });

    it('ends the turn immediately when flogging draws mutiny', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('mutiny-flog');
        vi.spyOn(decks, 'drawFlogging').mockReturnValue('mutiny');

        let state = createInitialState('mutiny-flog', { playerCount: 2 });
        state = {
            ...state,
            phase: 'movement',
            activePlayerId: 'player-1',
            ships: {
                'player-1': {
                    ...createShipState('player-1', 'red', 'a1', config),
                    movementRemaining: 0,
                    flogAttemptsRemaining: 6,
                },
                'player-2': createShipState('player-2', 'blue', 'b1', config),
            },
        };

        const result = reduce(state, {
            type: 'FLOG_DECISION',
            playerId: 'player-1',
            flog: true,
        }, rng);

        vi.restoreAllMocks();

        expect(result.events.some((event) => event.type === 'MUTINY_STARTED')).toBe(true);
        expect(result.state.ships['player-1'].rowers.temperament).toBe('mutiny');
        expect(result.state.ships['player-1'].movementRemaining).toBe(0);
        expect(result.state.ships['player-1'].flogAttemptsRemaining).toBe(0);
        expect(result.state.activePlayerId).toBe('player-2');
    });

    it('varies flogging outcomes across repeated attempts in one turn', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('flog-multi');

        let state = createInitialState('flog-multi', { playerCount: 2 });
        state = {
            ...state,
            phase: 'movement',
            activePlayerId: 'player-1',
            ships: {
                'player-1': {
                    ...createShipState('player-1', 'red', 'a1', config),
                    movementRemaining: 0,
                    flogAttemptsRemaining: 6,
                },
                'player-2': createShipState('player-2', 'blue', 'b1', config),
            },
        };

        const outcomes: string[] = [];

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const ship = state.ships['player-1'];

            if (!ship || ship.flogAttemptsRemaining <= 0) {
                break;
            }

            if (ship.movementRemaining > 0) {
                state = reduce(state, {
                    type: 'FLOG_DECISION',
                    playerId: 'player-1',
                    flog: false,
                }, rng).state;
            }

            const result = reduce(state, {
                type: 'FLOG_DECISION',
                playerId: 'player-1',
                flog: true,
            }, rng);

            const drawn = result.events.find((event) => event.type === 'FLOGGING_DRAWN');

            if (drawn && drawn.type === 'FLOGGING_DRAWN') {
                outcomes.push(drawn.outcome);
            }

            state = result.state;

            if (state.ships['player-1']?.movementRemaining === 0) {
                continue;
            }

            state = reduce(state, {
                type: 'FLOG_DECISION',
                playerId: 'player-1',
                flog: false,
            }, rng).state;
        }

        expect(outcomes.length).toBeGreaterThan(1);
        expect(new Set(outcomes).size).toBeGreaterThan(1);
    });
});
