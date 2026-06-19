import type { HitSide } from '../track/types';
import {
    hitSideToHullKey,
    maxSpeedFromRowers,
    type HullState,
    type ShipState,
} from '../entities/types';

export interface DamageResult {
    ship: ShipState;
    overflowToStructure: number;
    destroyed: boolean;
}

export function applyHullDamage(
    ship: ShipState,
    side: HitSide,
    amount: number,
): DamageResult {
    const hull: HullState = { ...ship.hull };
    const key = hitSideToHullKey(side);
    const absorbed = Math.min(hull[key], amount);
    hull[key] -= absorbed;

    const overflow = amount - absorbed;
    hull.structure = Math.max(0, hull.structure - overflow);
    const destroyed = hull.structure <= 0;

    return {
        ship: {
            ...ship,
            hull,
            destroyed,
        },
        overflowToStructure: overflow,
        destroyed,
    };
}

export function applyMastDamage(ship: ShipState, amount: number): ShipState {
    const rowers = {
        ...ship.rowers,
        hp: Math.max(0, ship.rowers.hp - amount),
    };

    return {
        ...ship,
        rowers,
        maxSpeed: maxSpeedFromRowers(rowers),
    };
}

export function applyBoarderDamage(ship: ShipState, amount: number): ShipState {
    return {
        ...ship,
        crew: {
            ...ship.crew,
            boarderHp: Math.max(0, ship.crew.boarderHp - amount),
        },
    };
}

export function applyCaptainDamage(ship: ShipState, amount: number): ShipState {
    return {
        ...ship,
        crew: {
            ...ship.crew,
            captainHp: Math.max(0, ship.crew.captainHp - amount),
        },
    };
}

/** Infer which side of `rammed` was hit based on rammer approach direction. */
export function inferRamHitSide(
    moveIndex: number,
): HitSide {
    switch (moveIndex) {
        case 0:
            return 'right';
        case 1:
            return 'rear';
        case 2:
            return 'left';
        case 5:
            return 'right';
        case 3:
            return 'left';
        default:
            return 'front';
    }
}
