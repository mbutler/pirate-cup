import { describe, expect, it } from 'vitest';
import { defaultTrack } from '../../src/core/track/TrackGraph';

describe('TrackGraph', () => {
    it('loads all 161 nodes from the original track', () => {
        expect(defaultTrack.nodes.size).toBe(161);
    });

    it('returns player moves excluding walls', () => {
        const moves = defaultTrack.playerMoves('a1');
        expect(moves).toContain('a2');
        expect(moves).toContain('b2');
        expect(moves).not.toContain('wall');
    });

    it('computes cornering checks from safe speed', () => {
        expect(defaultTrack.corneringChecksOwed(5, 'b12')).toBe(0);
        expect(defaultTrack.corneringChecksOwed(8, 'b12')).toBe(2);
    });

    it('exposes safe speed on corner hexes', () => {
        expect(defaultTrack.safeSpeedAt('a12')).toBe(3);
        expect(defaultTrack.safeSpeedAt('c12')).toBe(7);
    });
});
