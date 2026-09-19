import { drawWallCollision } from '../cards/decks';
import type { GameEvent } from '../events/types';
import type { HitSide } from '../track/types';
import type { Rng } from '../rng/Rng';
import type { GameState } from '../state/GameState';
import { applyHullDamage, applyMastDamage } from './damage';
import {
    calmFrenzy,
    integratePostDamage,
    isInFrenzy,
    wallOutcomeEndsFrenzy,
} from './frenzy';

export interface WallCollisionResolution {
    state: GameState;
    events: GameEvent[];
}

/** Resolve a wall hit using the standard wall collision table (drift or ram pin). */
export function resolveWallCollisionForShip(
    state: GameState,
    playerId: string,
    side: HitSide,
    rng: Rng,
): WallCollisionResolution {
    const ship = state.ships[playerId];

    if (!ship || ship.destroyed) {
        return { state, events: [] };
    }

    const outcome = drawWallCollision(rng);
    const events: GameEvent[] = [
        { type: 'WALL_COLLISION', playerId, side, outcome },
    ];
    let nextShip = {
        ...ship,
        corneringChecksRemaining: 0,
        driftRemaining: 0,
    };

    switch (outcome) {
        case 'hull3EndChecks':
            nextShip = applyHullDamage(nextShip, side, 3).ship;
            break;
        case 'mast3EndChecks':
            nextShip = applyMastDamage(nextShip, 3);
            break;
        case 'both3EndChecks':
            nextShip = applyHullDamage(nextShip, side, 3).ship;
            nextShip = applyMastDamage(nextShip, 3);
            break;
        case 'both6EndChecks':
            nextShip = applyHullDamage(nextShip, side, 6).ship;
            nextShip = applyMastDamage(nextShip, 6);
            break;
        default:
            nextShip = applyHullDamage(nextShip, side, 6).ship;
            nextShip = applyMastDamage(nextShip, 6);
            nextShip = { ...nextShip, movementRemaining: 0 };
            break;
    }

    if (nextShip.destroyed) {
        events.push({ type: 'SHIP_DESTROYED', playerId });
    }

    let nextState: GameState = {
        ...state,
        ships: { ...state.ships, [playerId]: nextShip },
    };

    const hullDamage =
        outcome === 'hull3EndChecks'
            ? 3
            : outcome === 'both3EndChecks'
              ? 3
              : outcome === 'both6EndChecks' ||
                  outcome === 'crashKeepFrenzy' ||
                  outcome === 'crash'
                ? 6
                : 0;
    const rowerDamage =
        outcome === 'mast3EndChecks'
            ? 3
            : outcome === 'both3EndChecks'
              ? 3
              : outcome === 'both6EndChecks' ||
                  outcome === 'crashKeepFrenzy' ||
                  outcome === 'crash'
                ? 6
                : 0;

    nextState = integratePostDamage(
        nextState,
        playerId,
        hullDamage + rowerDamage,
        events,
    );

    nextShip = nextState.ships[playerId] ?? nextShip;

    if (isInFrenzy(nextShip) && wallOutcomeEndsFrenzy(outcome)) {
        nextShip = calmFrenzy(nextShip);
        events.push({ type: 'MUTINY_ENDED', playerId, reason: 'crash' });
        nextState = {
            ...nextState,
            ships: { ...nextState.ships, [playerId]: nextShip },
        };
    }

    return {
        state: nextState,
        events,
    };
}

/** Which hull side strikes the track wall on a lateral ram displacement. */
export function wallSideForPush(pushSide: 'left' | 'right'): HitSide {
    return pushSide === 'left' ? 'right' : 'left';
}
