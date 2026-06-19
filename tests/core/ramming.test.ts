import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng/Rng';
import { createShipState } from '../../src/core/state/GameState';
import { createGameConfig } from '../../src/core/config/GameConfig';
import { defaultTrack } from '../../src/core/track/TrackGraph';
import {
    findMoveIndex,
    inferRamHitSideFromApproach,
    resolveRammingChain,
} from '../../src/core/rules/ramming';
import { applyMove } from '../../src/core/rules/movement';
import type { GameState } from '../../src/core/state/GameState';

function stateWithShips(positions: Record<string, string>): GameState {
    const config = createGameConfig({ playerCount: 3 });
    const ships: GameState['ships'] = {};

    for (const [id, positionId] of Object.entries(positions)) {
        ships[id] = createShipState(id, 'red', positionId, config);
    }

    return {
        config,
        seed: 'ram-test',
        turn: 1,
        phase: 'movement',
        activePlayerId: 'player-1',
        movementOrder: Object.keys(positions),
        movementIndex: 0,
        ships,
        inputs: {},
        pendingCombat: [],
        winnerId: null,
    };
}

describe('ramming', () => {
    it('infers rear hit when approaching from astern', () => {
        expect(inferRamHitSideFromApproach('a1', 'a2', defaultTrack)).toBe('rear');
        expect(findMoveIndex('a1', 'a2', defaultTrack)).toBe(1);
    });

    it('displaces the rammed ship and places the rammer on the hex', () => {
        const state = stateWithShips({
            'player-1': 'a1',
            'player-2': 'a2',
        });
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            chosenSpeed: 3,
            movementRemaining: 3,
        };

        const rng = createRng('push-left');
        const { state: next, events } = applyMove(state, 'player-1', 'forward', defaultTrack, rng);

        expect(next.ships['player-1'].positionId).toBe('a2');
        expect(next.ships['player-2'].positionId).not.toBe('a2');
        expect(events.some((e) => e.type === 'RAMMING')).toBe(true);
        expect(events.filter((e) => e.type === 'SHIP_MOVED')).toHaveLength(2);
        expect(next.ships['player-2'].hull.rear).toBeLessThan(28);
    });

    it('chains when a displaced ship rams another', () => {
        const state = stateWithShips({
            'player-1': 'a1',
            'player-2': 'a2',
            'player-3': 'b2',
        });
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            chosenSpeed: 2,
            movementRemaining: 2,
        };

        const rng = createRng('chain-left');
        const { state: next, events } = resolveRammingChain(
            state,
            'player-1',
            'player-2',
            'a1',
            'a2',
            rng,
        );

        expect(next.ships['player-1'].positionId).toBe('a2');
        expect(next.ships['player-2'].positionId).toBe('b2');
        expect(next.ships['player-3'].positionId).not.toBe('b2');
        expect(events.filter((e) => e.type === 'RAMMING')).toHaveLength(2);
    });

    it('applies side damage on a starboard-side ram', () => {
        const state = stateWithShips({
            'player-1': 'a2',
            'player-2': 'b3',
        });
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            chosenSpeed: 1,
            movementRemaining: 1,
        };

        const rng = createRng('starboard-ram');
        const { state: next } = applyMove(state, 'player-1', 'laneOut', defaultTrack, rng);

        expect(inferRamHitSideFromApproach('a2', 'b3', defaultTrack)).toBe('left');
        expect(next.ships['player-2'].hull.left).toBeLessThan(56);
        expect(next.ships['player-1'].hull.right).toBeLessThan(56);
    });

    it('applies wall damage when a ram shoves a ship into the outer wall', () => {
        const state = stateWithShips({
            'player-1': 'c11',
            'player-2': 'd12',
        });
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            chosenSpeed: 1,
            movementRemaining: 1,
        };

        const rng = createRng('ram-outer-wall');
        const { state: next, events } = applyMove(state, 'player-1', 'laneOut', defaultTrack, rng);

        expect(events.some((event) => event.type === 'WALL_COLLISION')).toBe(true);
        expect(events.some((event) => event.type === 'RAMMING')).toBe(true);
        expect(next.ships['player-2'].positionId).toBe('d11');
        expect(next.ships['player-2'].hull.right).toBeLessThan(56);
    });

    it('applies wall damage when a ram pins a ship against the wall with no escape', () => {
        const state = stateWithShips({
            'player-1': 'a3',
            'player-2': 'x1',
        });
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            chosenSpeed: 1,
            movementRemaining: 1,
        };

        const rng = createRng('ram-wall-pin');
        const { state: next, events } = applyMove(state, 'player-1', 'laneIn', defaultTrack, rng);

        expect(events.filter((event) => event.type === 'WALL_COLLISION').length).toBeGreaterThanOrEqual(1);
        expect(events.some((event) => event.type === 'RAMMING')).toBe(true);
        expect(next.ships['player-2'].positionId).toBe('x1');
        expect(next.ships['player-2'].hull.left).toBeLessThan(56);
    });
});
