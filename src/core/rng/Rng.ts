/** Deterministic RNG — same seed + draw sequence = same results (required for online sync). */
export interface Rng {
    /** Integer in [min, max] inclusive. */
    int(min: number, max: number): number;
    /** Float in [0, 1). */
    next(): number;
    /** Fork for isolated sub-system draws while keeping parent stream intact. */
    fork(label: string): Rng;
}

export function createRng(seed: string): Rng {
    let state = hashSeed(seed);

    const nextUint32 = (): number => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const makeRng = (label: string): Rng => ({
        int(min: number, max: number) {
            const range = max - min + 1;
            return min + Math.floor(nextUint32() * range);
        },
        next: nextUint32,
        fork(childLabel: string) {
            const nonce = nextUint32();
            return createRng(`${seed}:${label}:${childLabel}:${nonce}`);
        },
    });

    return makeRng('root');
}

function hashSeed(seed: string): number {
    let hash = 2166136261;

    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}
