import { describe, expect, it } from 'vitest';
import {
    DEFAULT_HULL,
    MAX_HULL_POINTS,
    hullDamageLook,
    hullPoints,
} from '../../src/core/entities/types';
import { createGameConfig } from '../../src/core/config/GameConfig';
import { createShipState } from '../../src/core/state/GameState';
import { applyHullDamage } from '../../src/core/rules/damage';
import { formatEventMessage, formatShipSummary } from '../../src/client/ui/formatters';

const config = createGameConfig({ playerCount: 2 });

function ship() {
    return createShipState('player-1', 'red', 'a1', config);
}

describe('hull points', () => {
    it('starts at the full five-part total and matches default sides plus structure', () => {
        const hull = { ...DEFAULT_HULL };
        expect(hullPoints(hull)).toBe(MAX_HULL_POINTS);
        expect(MAX_HULL_POINTS).toBe(
            hull.front + hull.rear + hull.left + hull.right + hull.structure,
        );
        expect(hullDamageLook({ hull, destroyed: false })).toBe('none');
    });

    it('applies side hits to the struck quadrant and only then to structure', () => {
        const first = applyHullDamage(ship(), 'front', 3);
        expect(first.overflowToStructure).toBe(0);
        expect(first.destroyed).toBe(false);
        expect(first.ship.hull).toEqual({
            ...DEFAULT_HULL,
            front: DEFAULT_HULL.front - 3,
        });
        expect(hullPoints(first.ship.hull)).toBe(MAX_HULL_POINTS - 3);
        expect(hullDamageLook(first.ship)).toBe('light');

        const stripped = applyHullDamage(
            { ...first.ship, hull: { ...first.ship.hull, front: 2 } },
            'front',
            6,
        );
        expect(stripped.overflowToStructure).toBe(4);
        expect(stripped.ship.hull.front).toBe(0);
        expect(stripped.ship.hull.structure).toBe(DEFAULT_HULL.structure - 4);
        expect(hullPoints(stripped.ship.hull)).toBe(
            hullPoints({ ...first.ship.hull, front: 2 }) - 6,
        );
        expect(stripped.destroyed).toBe(false);

        const wrecked = applyHullDamage(
            {
                ...stripped.ship,
                hull: { ...stripped.ship.hull, structure: 2 },
            },
            'front',
            5,
        );
        expect(wrecked.ship.hull.structure).toBe(0);
        expect(wrecked.destroyed).toBe(true);
        expect(hullDamageLook(wrecked.ship)).toBe('wreck');
    });

    it('lists total hull with the four side stats in the inspect summary', () => {
        const damaged = applyHullDamage(ship(), 'left', 6).ship;
        damaged.hull.structure = 24;
        expect(formatShipSummary(damaged)).toBe(
            `Hull ${hullPoints(damaged.hull)}  ·  Integrity 24  ·  F${damaged.hull.front} R${damaged.hull.rear} L${damaged.hull.left} S${damaged.hull.right}  ·  Sails ${damaged.maxSpeed}  ·  Rowers ${damaged.rowers.hp}`,
        );
        expect(
            formatEventMessage({
                type: 'WALL_COLLISION',
                playerId: 'player-1',
                side: 'right',
                outcome: 'hull3EndChecks',
            }),
        ).toBe('Reef strike (starboard): −3 starboard; corner checks end');
    });
});
