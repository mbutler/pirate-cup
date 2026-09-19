import type { WallCollisionOutcome } from '../cards/decks';
import type { GameEvent } from '../events/types';
import type { ShipState } from '../entities/types';
import type { Rng } from '../rng/Rng';
import type { GameState } from '../state/GameState';
import { helmSkill } from './crewSkill';
import { raceStandings } from './race';

/** Pirate reskin name for Circus Imperium Frenzy — rowers seize the ship. */
export const FRENZY_TEMPERAMENT = 'mutiny' as const;

export interface FrenzyConfig {
    /** Total hull + rower damage in one turn that snaps rowers into frenzy. */
    criticalTurnDamage: number;
    /** Rower HP at or below this after damage triggers frenzy. */
    criticalRowersHp: number;
}

export const DEFAULT_FRENZY_CONFIG: FrenzyConfig = {
    criticalTurnDamage: 15,
    criticalRowersHp: 20,
};

export function isInFrenzy(ship: ShipState): boolean {
    return !ship.destroyed && ship.rowers.temperament === FRENZY_TEMPERAMENT;
}

export function frenzySpeed(
    maxSpeed: number,
    rng: Rng,
): { roll: number; speed: number } {
    const roll = rng.int(1, 10);
    return { roll, speed: maxSpeed + roll };
}

export function markFrenzy(ship: ShipState): ShipState {
    if (ship.destroyed || isInFrenzy(ship)) {
        return ship;
    }

    return {
        ...ship,
        rowers: { ...ship.rowers, temperament: FRENZY_TEMPERAMENT },
        flogAttemptsRemaining: 0,
    };
}

export function calmFrenzy(ship: ShipState): ShipState {
    if (!isInFrenzy(ship)) {
        return ship;
    }

    return {
        ...ship,
        rowers: { ...ship.rowers, temperament: 'calm' },
    };
}

export function recordTurnDamage(ship: ShipState, amount: number): ShipState {
    if (amount <= 0) {
        return ship;
    }

    return {
        ...ship,
        turnDamageTaken: ship.turnDamageTaken + amount,
    };
}

export function shouldTriggerCriticalFrenzy(
    ship: ShipState,
    config: FrenzyConfig = DEFAULT_FRENZY_CONFIG,
): boolean {
    if (ship.destroyed || isInFrenzy(ship)) {
        return false;
    }

    return (
        ship.turnDamageTaken >= config.criticalTurnDamage ||
        ship.rowers.hp <= config.criticalRowersHp
    );
}

export function wallOutcomeEndsFrenzy(outcome: WallCollisionOutcome): boolean {
    return outcome === 'crash' || outcome === 'both6EndChecks';
}

export function rollFrenzyCooldown(
    ship: ShipState,
    rng: Rng,
): { ship: ShipState; roll: number; skill: number; calmed: boolean } {
    const roll = rng.int(1, 10);
    const skill = helmSkill(ship.crew);
    const calmed = roll <= skill;

    return {
        roll,
        skill,
        calmed,
        ship: calmed ? calmFrenzy(ship) : ship,
    };
}

/** Last-place ship by laps then distance around the course from the start line. */
export function findLastPlaceShipId(state: GameState): string | null {
    const racers = raceStandings(state).filter((ship) => !ship.destroyed);
    return racers.length > 1 ? racers[racers.length - 1].id : null;
}

export function resetTurnDamage(ship: ShipState): ShipState {
    return { ...ship, turnDamageTaken: 0 };
}

export function integratePostDamage(
    state: GameState,
    playerId: string,
    damageDealt: number,
    events: GameEvent[],
): GameState {
    let ship = state.ships[playerId];

    if (!ship) {
        return state;
    }

    if (damageDealt > 0) {
        ship = recordTurnDamage(ship, damageDealt);
    }

    if (ship.destroyed) {
        const wasMutinous = ship.rowers.temperament === 'mutiny';
        ship = {
            ...ship,
            movementRemaining: 0,
            driftRemaining: 0,
            corneringChecksRemaining: 0,
            flogAttemptsRemaining: 0,
            bonusMovement: 0,
            rowers: { ...ship.rowers, temperament: 'calm' },
        };
        if (wasMutinous)
            events.push({ type: 'MUTINY_ENDED', playerId, reason: 'wreck' });
    } else if (shouldTriggerCriticalFrenzy(ship)) {
        ship = markFrenzy(ship);
        events.push({
            type: 'MUTINY_STARTED',
            playerId,
            reason: 'critical_damage',
        });
    }

    return {
        ...state,
        ships: { ...state.ships, [playerId]: ship },
    };
}

export interface CleanupResolution {
    state: GameState;
    events: GameEvent[];
}

/** End-of-round cleanup: frenzy cooldown rolls, then arena laser on last place. */
export function resolveCleanupPhase(
    state: GameState,
    rng: Rng,
): CleanupResolution {
    const events: GameEvent[] = [];
    let ships = { ...state.ships };

    for (const [playerId, ship] of Object.entries(ships)) {
        if (isInFrenzy(ship)) {
            const cooldown = rollFrenzyCooldown(ship, rng);
            ships[playerId] = resetTurnDamage(cooldown.ship);
            events.push({
                type: 'FRENZY_COOLDOWN_ROLL',
                playerId,
                roll: cooldown.roll,
                skill: cooldown.skill,
                calmed: cooldown.calmed,
            });

            if (cooldown.calmed) {
                events.push({
                    type: 'MUTINY_ENDED',
                    playerId,
                    reason: 'cooldown',
                });
            }
        } else {
            ships[playerId] = resetTurnDamage(ship);
        }
    }

    const lastPlaceId = findLastPlaceShipId({ ...state, ships });

    if (lastPlaceId) {
        const lastPlace = ships[lastPlaceId];

        if (lastPlace && !isInFrenzy(lastPlace)) {
            ships[lastPlaceId] = markFrenzy(lastPlace);
            events.push({ type: 'ARENA_LASER', playerId: lastPlaceId });
            events.push({
                type: 'MUTINY_STARTED',
                playerId: lastPlaceId,
                reason: 'arena_laser',
            });
        }
    }

    return {
        state: { ...state, ships, phase: 'cleanup' },
        events,
    };
}
