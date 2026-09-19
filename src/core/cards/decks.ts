import type { HitSide } from '../track/types';
import type { Rng } from '../rng/Rng';

export interface WeightedOutcome<T extends string> {
    id: T;
    weight: number;
}

export interface DeckDefinition<T extends string> {
    id: string;
    outcomes: WeightedOutcome<T>[];
}

export function totalWeight<T extends string>(outcomes: WeightedOutcome<T>[]): number {
    return outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
}

export function drawFromDeck<T extends string>(
    deck: DeckDefinition<T>,
    rng: Rng,
): T {
    const roll = rng.int(1, totalWeight(deck.outcomes));
    let cursor = 0;

    for (const outcome of deck.outcomes) {
        cursor += outcome.weight;

        if (roll <= cursor) {
            return outcome.id;
        }
    }

    return deck.outcomes[deck.outcomes.length - 1].id;
}

/** Cornering deck — probabilities preserved from the original POC (d60). */
export type CorneringOutcome =
    | 'hold'
    | 'drift1'
    | 'drift2'
    | 'moveIn1'
    | 'drift3';

export const CORNERING_DECK: DeckDefinition<CorneringOutcome> = {
    id: 'cornering',
    outcomes: [
        { id: 'hold', weight: 30 },
        { id: 'drift1', weight: 15 },
        { id: 'drift2', weight: 6 },
        { id: 'moveIn1', weight: 6 },
        { id: 'drift3', weight: 3 },
    ],
};

/** Flogging deck — probabilities preserved from the original POC (d60). */
export type FloggingOutcome =
    | 'damage3Front1Mast'
    | 'damage3Front'
    | 'damage2Front1Mast'
    | 'move1Damage1Mast'
    | 'damage2Front'
    | 'move1'
    | 'damage1Front'
    | 'move2EndTurn'
    | 'move2'
    | 'move1EndTurn'
    | 'damage1Front1Mast'
    | 'mutiny';

export const FLOGGING_DECK: DeckDefinition<FloggingOutcome> = {
    id: 'flogging',
    outcomes: [
        { id: 'damage3Front1Mast', weight: 3 },
        { id: 'damage3Front', weight: 3 },
        { id: 'damage2Front1Mast', weight: 3 },
        { id: 'move1Damage1Mast', weight: 12 },
        { id: 'damage2Front', weight: 3 },
        { id: 'move1', weight: 15 },
        { id: 'damage1Front', weight: 3 },
        { id: 'move2EndTurn', weight: 3 },
        { id: 'move2', weight: 3 },
        { id: 'move1EndTurn', weight: 3 },
        { id: 'damage1Front1Mast', weight: 3 },
        { id: 'mutiny', weight: 6 },
    ],
};

/** Wall collision table — preserved from the original POC (d10). */
export type WallCollisionOutcome =
    | 'hull3EndChecks'
    | 'mast3EndChecks'
    | 'both3EndChecks'
    | 'both6EndChecks'
    | 'crashKeepFrenzy'
    | 'crash';

export const WALL_COLLISION_DECK: DeckDefinition<WallCollisionOutcome> = {
    id: 'wall-collision',
    outcomes: [
        { id: 'hull3EndChecks', weight: 1 },
        { id: 'mast3EndChecks', weight: 1 },
        { id: 'both3EndChecks', weight: 3 },
        { id: 'both6EndChecks', weight: 1 },
        { id: 'crashKeepFrenzy', weight: 2 },
        { id: 'crash', weight: 2 },
    ],
};

export interface RammingResult {
    rammedSide: HitSide;
    rammedDamage: number;
    rammerSide?: HitSide;
    rammerDamage?: number;
    /** Rear ram splits rammer damage between mast and bow (POC). */
    rammerMastDamage?: number;
}

/** Ramming damage from the original POC. */
export function resolveRamming(hitSide: HitSide): RammingResult {
    if (hitSide === 'left') {
        return {
            rammedSide: 'left',
            rammerSide: 'right',
            rammedDamage: 6,
            rammerDamage: 3,
        };
    }

    if (hitSide === 'right') {
        return {
            rammedSide: 'right',
            rammerSide: 'left',
            rammedDamage: 6,
            rammerDamage: 3,
        };
    }

    return {
        rammedSide: 'rear',
        rammedDamage: 6,
        rammerSide: 'front',
        rammerDamage: 2,
        rammerMastDamage: 4,
    };
}

export function drawCornering(rng: Rng): CorneringOutcome {
    return drawFromDeck(CORNERING_DECK, rng);
}

export function drawFlogging(rng: Rng): FloggingOutcome {
    return drawFromDeck(FLOGGING_DECK, rng);
}

export function drawWallCollision(rng: Rng): WallCollisionOutcome {
    return drawFromDeck(WALL_COLLISION_DECK, rng);
}
