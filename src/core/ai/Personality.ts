import { createRng } from '../rng/Rng';

export const PERSONALITIES = [
    'racer',
    'bruiser',
    'opportunist',
    'daredevil',
] as const;
export type Personality = (typeof PERSONALITIES)[number];
export type CaptainPersonalities = Partial<Record<string, Personality>>;
export const PERSONALITY_LABELS: Record<Personality, string> = {
    racer: 'Racer',
    bruiser: 'Bruiser',
    opportunist: 'Opportunist',
    daredevil: 'Daredevil',
};
export const STYLES = {
    racer: {
        attack: 0.45,
        caution: 1.35,
        corner: 3.5,
        overspeed: 0,
        pushes: 1,
        boarding: 0.15,
    },
    bruiser: {
        attack: 1.5,
        caution: 1,
        corner: 3,
        overspeed: 0,
        pushes: 1,
        boarding: 0.4,
    },
    opportunist: {
        attack: 0.85,
        caution: 1.4,
        corner: 3.5,
        overspeed: 0,
        pushes: 1,
        boarding: 1.4,
    },
    daredevil: {
        attack: 1,
        caution: 0.8,
        corner: 1.8,
        overspeed: 1,
        pushes: 3,
        boarding: 0.25,
    },
};

export function assignPersonalities(
    seed: string,
    captains: readonly string[],
    choices: CaptainPersonalities = {},
): CaptainPersonalities {
    const rng = createRng(`${seed}:personalities`);
    const pool: Personality[] = [...PERSONALITIES];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return Object.fromEntries(
        captains.map((id, index) => [
            id,
            choices[id] ?? pool[index % pool.length],
        ]),
    );
}
