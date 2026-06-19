import { describe, expect, it } from 'vitest';
import {
    CORNERING_DECK,
    drawCornering,
    drawFlogging,
    FLOGGING_DECK,
    WALL_COLLISION_DECK,
    totalWeight,
} from '../../src/core/cards/decks';
import { createRng } from '../../src/core/rng/Rng';

describe('card deck weights', () => {
    it('cornering deck sums to 60 (original d60 table)', () => {
        expect(totalWeight(CORNERING_DECK.outcomes)).toBe(60);
    });

    it('flogging deck sums to 60 (original d60 table)', () => {
        expect(totalWeight(FLOGGING_DECK.outcomes)).toBe(60);
    });

    it('wall collision deck sums to 10 (original d10 table)', () => {
        expect(totalWeight(WALL_COLLISION_DECK.outcomes)).toBe(10);
    });

    it('preserves hold-the-corner probability at 50%', () => {
        const hold = CORNERING_DECK.outcomes.find((o) => o.id === 'hold');
        expect(hold?.weight).toBe(30);
    });

    it('preserves mutiny probability at 10%', () => {
        const mutiny = FLOGGING_DECK.outcomes.find((o) => o.id === 'mutiny');
        expect(mutiny?.weight).toBe(6);
    });

    it('produces varied cornering outcomes across sequential draws', () => {
        const rng = createRng('cornering-variety');
        const outcomes = new Set(Array.from({ length: 24 }, () => drawCornering(rng)));

        expect(outcomes.size).toBeGreaterThan(1);
        expect(outcomes.has('hold')).toBe(true);
        expect([...outcomes].some((outcome) => outcome !== 'hold')).toBe(true);
    });

    it('produces varied flogging outcomes across sequential draws', () => {
        const rng = createRng('flogging-variety');
        const outcomes = new Set(Array.from({ length: 30 }, () => drawFlogging(rng)));

        expect(outcomes.size).toBeGreaterThan(1);
        expect([...outcomes].some((outcome) => outcome !== 'move1')).toBe(true);
    });
});
