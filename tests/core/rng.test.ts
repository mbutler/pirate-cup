import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng/Rng';

describe('Rng', () => {
    it('fork with the same label still advances and does not repeat the first draw', () => {
        const rng = createRng('fork-repeat');
        const rolls = Array.from({ length: 6 }, () => rng.fork('cornering').int(1, 60));

        expect(new Set(rolls).size).toBeGreaterThan(1);
    });

    it('sequential ints on one stream do not repeat trivially', () => {
        const rng = createRng('int-stream');
        const values = Array.from({ length: 8 }, () => rng.int(1, 60));

        expect(new Set(values).size).toBeGreaterThan(1);
    });
});
