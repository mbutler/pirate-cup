import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng/Rng';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createGameConfig } from '../../src/core/config/GameConfig';
import { createShipState } from '../../src/core/state/GameState';
import {
    findLastPlaceShipId,
    integratePostDamage,
    isInFrenzy,
    markFrenzy,
    resolveCleanupPhase,
} from '../../src/core/rules/frenzy';
import { defaultTrack } from '../../src/core/track/TrackGraph';

describe('frenzy (mutiny)', () => {
    it('tracks race progress from the start line', () => {
        expect(defaultTrack.raceProgressFromStart('a1')).toBe(0);
        expect(defaultTrack.raceProgressFromStart('a10')).toBeGreaterThan(
            defaultTrack.raceProgressFromStart('a1'),
        );
    });

    it('finds the last-place ship by lap and progress', () => {
        const config = createGameConfig({ playerCount: 2 });
        const state = createInitialState('last-place', { playerCount: 2 });

        state.ships['player-1'] = {
            ...createShipState('player-1', 'red', 'a10', config),
            lapsCompleted: 1,
        };
        state.ships['player-2'] = {
            ...createShipState('player-2', 'blue', 'a3', config),
            lapsCompleted: 0,
        };

        expect(findLastPlaceShipId(state)).toBe('player-2');
    });

    it('triggers frenzy from critical damage taken in one turn', () => {
        const config = createGameConfig({ playerCount: 2 });
        const base = createShipState('player-1', 'red', 'a1', config);
        let state = createInitialState('critical', { playerCount: 2 });
        const events: Array<{ type: 'MUTINY_STARTED'; playerId: string; reason?: 'critical_damage' }> = [];

        state = integratePostDamage(
            {
                ...state,
                ships: {
                    ...state.ships,
                    'player-1': { ...base, turnDamageTaken: 14 },
                },
            },
            'player-1',
            2,
            events,
        );

        expect(events.some((event) => event.type === 'MUTINY_STARTED')).toBe(true);
        expect(isInFrenzy(state.ships['player-1'])).toBe(true);
        expect(state.ships['player-1'].turnDamageTaken).toBe(16);
    });

    it('runs cleanup with arena laser and cooldown rolls', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('cleanup-phase');
        let state = createInitialState('cleanup-phase', { playerCount: 2 });

        state = {
            ...state,
            phase: 'cleanup',
            ships: {
                'player-1': {
                    ...createShipState('player-1', 'red', 'a10', config),
                    lapsCompleted: 1,
                },
                'player-2': {
                    ...markFrenzy(createShipState('player-2', 'blue', 'a3', config)),
                    lapsCompleted: 0,
                },
            },
        };

        const result = resolveCleanupPhase(state, rng);

        expect(result.events.some((event) => event.type === 'FRENZY_COOLDOWN_ROLL')).toBe(true);
        expect(result.events.some((event) => event.type === 'ARENA_LASER')).toBe(true);
        expect(isInFrenzy(result.state.ships['player-2'])).toBe(true);
    });

    it('fires the arena laser on last place during cleanup', () => {
        const config = createGameConfig({ playerCount: 2 });
        const rng = createRng('arena-laser');
        let state = createInitialState('arena-laser', { playerCount: 2 });

        state = {
            ...state,
            phase: 'cleanup',
            ships: {
                'player-1': createShipState('player-1', 'red', 'a10', config),
                'player-2': createShipState('player-2', 'blue', 'a3', config),
            },
        };

        const result = resolveCleanupPhase(state, rng);

        expect(result.events.some((event) => event.type === 'ARENA_LASER')).toBe(true);
        expect(result.events.some(
            (event) => event.type === 'MUTINY_STARTED' && event.playerId === 'player-2',
        )).toBe(true);
        expect(isInFrenzy(result.state.ships['player-2'])).toBe(true);
    });

    it('resolves cleanup when ending a turn from combat', () => {
        const rng = createRng('end-turn-cleanup');
        let state = createInitialState('end-turn-cleanup', { playerCount: 2 });
        state = { ...state, phase: 'combat' };

        const result = reduce(state, { type: 'END_TURN' }, rng);

        expect(result.events.some((event) => event.type === 'FRENZY_COOLDOWN_ROLL')).toBe(false);
        expect(result.events.some((event) => event.type === 'PHASE_CHANGED' && event.to === 'input')).toBe(true);
        expect(result.state.turn).toBe(2);
    });
});
