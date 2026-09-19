import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createRng } from '../../src/core/rng/Rng';
import { defaultTrack } from '../../src/core/track/TrackGraph';
import { resolveWallCollisionForShip } from '../../src/core/rules/wallCollision';
import { shortestAngleDelta } from '../../src/client/track/TrackLayout';
import * as decks from '../../src/core/cards/decks';

afterEach(() => vi.restoreAllMocks());

describe('multi-hex drift into a wall', () => {
    it.each([0, 1, 2])(
        'resolves one impact after %i open outward hexes and cancels remaining drift',
        (openHexes) => {
            const origin = [...defaultTrack.nodes.values()].find((node) => {
                let position = node.id;
                for (let i = 0; i < openHexes; i++) {
                    position = defaultTrack.neighbor(position, 'laneOut');
                    if (position === 'wall') return false;
                }
                return defaultTrack.neighbor(position, 'laneOut') === 'wall';
            })!;
            const state = createInitialState('drift', {
                playerCount: 2,
                startingPositions: [origin.id, 'a30'],
            });
            state.phase = 'movement';
            const ship = state.ships['player-1'];
            ship.corneringChecksRemaining = 4;
            ship.movementRemaining = 5;
            vi.spyOn(decks, 'drawCornering').mockReturnValue('drift3');
            const wall = vi
                .spyOn(decks, 'drawWallCollision')
                .mockReturnValue('hull3EndChecks');
            const result = reduce(
                state,
                { type: 'RESOLVE_CORNERING', playerId: ship.id },
                createRng('drift'),
            );
            expect(wall).toHaveBeenCalledTimes(1);
            expect(
                result.events.filter(
                    (event) => event.type === 'WALL_COLLISION',
                ),
            ).toHaveLength(1);
            expect(
                result.events.filter((event) => event.type === 'SHIP_MOVED'),
            ).toHaveLength(openHexes);
            expect(result.state.ships[ship.id]).toMatchObject({
                driftRemaining: 0,
                corneringChecksRemaining: 0,
                movementRemaining: 5,
            });
        },
    );

    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
        'matches reference wall damage, movement and mutiny outcomes for d10=%i',
        (roll) => {
            const state = createInitialState('wall');
            state.ships['player-1'].movementRemaining = 5;
            state.ships['player-1'].rowers.temperament = 'mutiny';
            const rng = createRng('wall');
            vi.spyOn(rng, 'int').mockReturnValue(roll);
            const result = resolveWallCollisionForShip(
                state,
                'player-1',
                'right',
                rng,
            );
            const ship = result.state.ships['player-1'];
            expect(ship.movementRemaining).toBe(roll >= 7 ? 0 : 5);
            expect(ship.rowers.temperament).toBe(roll >= 9 ? 'calm' : 'mutiny');
            expect(ship.hull.right).toBe(
                56 - (roll === 2 ? 0 : roll < 6 ? 3 : 6),
            );
            expect(ship.rowers.hp).toBe(
                60 - (roll === 1 ? 0 : roll < 6 ? 3 : 6),
            );
        },
    );
});

it('rotates through the short arc at the angle seam in both directions', () => {
    expect(shortestAngleDelta(170, -170)).toBe(20);
    expect(shortestAngleDelta(-170, 170)).toBe(-20);
    expect(shortestAngleDelta(350, 10)).toBe(20);
    for (const node of defaultTrack.nodes.values())
        for (const neighbor of Object.values(node.neighbors)) {
            if (neighbor === 'wall') continue;
            const angle = defaultTrack.getNode(neighbor).angle;
            const delta = shortestAngleDelta(node.angle, angle);
            expect(Math.abs(delta)).toBeLessThanOrEqual(180);
            expect(
                Math.abs(shortestAngleDelta(node.angle + delta, angle)),
            ).toBeLessThan(0.000001);
        }
});
