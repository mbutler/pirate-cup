import type { HitSide } from '../track/types';
import type { ShipColor } from '../config/GameConfig';

export type RowerTemperament = 'calm' | 'agitated' | 'mutiny';

export interface HullState {
    front: number;
    rear: number;
    left: number;
    right: number;
    /** Hull integrity once quadrant armor is gone. */
    structure: number;
}

export interface CrewState {
    captainHp: number;
    boarderHp: number;
}

export interface RowersState {
    hp: number;
    temperament: RowerTemperament;
}

export interface ShipState {
    id: string;
    ownerId: string;
    color: ShipColor;
    positionId: string;
    lapsCompleted: number;
    /** Next required course gate: west, south, east, finish. */
    nextCheckpoint: number;
    hasStarted: boolean;
    /** Max speed from rower health (hp / 10). */
    maxSpeed: number;
    /** Speed chosen for the current turn. */
    chosenSpeed: number;
    /** Movement points remaining this turn. */
    movementRemaining: number;
    /** Pending cornering deck draws after overspeed. */
    corneringChecksRemaining: number;
    /** Drift hexes still to resolve this movement step. */
    driftRemaining: number;
    /** Bonus movement granted by a flogging card this turn. */
    bonusMovement: number;
    /** Flog attempts left this turn. */
    flogAttemptsRemaining: number;
    /** Hull + rower damage taken this turn (for critical frenzy trigger). */
    turnDamageTaken: number;
    /** Whether hull or rowers are lost; the disabled vessel is out of the race. */
    destroyed: boolean;
    hull: HullState;
    crew: CrewState;
    rowers: RowersState;
}

export const DEFAULT_HULL: HullState = {
    front: 29,
    rear: 28,
    left: 56,
    right: 56,
    structure: 30,
};

export const DEFAULT_CREW: CrewState = {
    captainHp: 10,
    boarderHp: 10,
};

export const DEFAULT_ROWERS: RowersState = {
    hp: 60,
    temperament: 'calm',
};

export function sailsFromMastHp(_mastHp: number): number {
    // Mast HP maps to effective sail count — preserved from the original POC thresholds.
    // Rowers HP doubles as mast/sail capacity in the pirate reskin.
    const mastHp = _mastHp;

    if (mastHp < 1) return 0;
    if (mastHp <= 8) return 1;
    if (mastHp <= 15) return 2;
    if (mastHp <= 21) return 3;
    if (mastHp <= 26) return 4;
    if (mastHp <= 31) return 5;
    if (mastHp <= 40) return 6;
    if (mastHp <= 46) return 7;
    return 8;
}

export function maxSpeedFromRowers(rowers: RowersState): number {
    return sailsFromMastHp(rowers.hp);
}

export function hitSideToHullKey(
    side: HitSide,
): keyof Pick<HullState, 'front' | 'rear' | 'left' | 'right'> {
    return side;
}

/** A captain's surviving party, separate from the physical vessel. */
export interface DisplacedCrew extends CrewState {
    id: string;
    color: ShipColor;
    positionId: string;
    lapsCompleted: number;
    actedTurn: number;
}
