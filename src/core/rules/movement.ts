import type { MoveDirection } from '../track/types';
import { defaultTrack, type TrackGraph } from '../track/TrackGraph';
import type { ShipState } from '../entities/types';
import type { GameState } from '../state/GameState';
import type { GameEvent } from '../events/types';
import type { Rng } from '../rng/Rng';
import { resolveRammingChain } from './ramming';

export interface MoveResolution {
    state: GameState;
    events: GameEvent[];
}

export function getOccupyingShipId(
    state: GameState,
    positionId: string,
    excludeId?: string,
): string | undefined {
    return Object.values(state.ships).find(
        (ship) => !ship.destroyed && ship.id !== excludeId && ship.positionId === positionId,
    )?.id;
}

export function applyMove(
    state: GameState,
    playerId: string,
    direction: MoveDirection,
    track: TrackGraph = defaultTrack,
    rng?: Rng,
): MoveResolution {
    const ship = state.ships[playerId];

    if (!ship || ship.destroyed) {
        return { state, events: [] };
    }

    const from = ship.positionId;
    const targetId = track.neighbor(from, direction);

    if (track.isWall(targetId)) {
        return { state, events: [] };
    }

    const rammedId = getOccupyingShipId(state, targetId, playerId);

    if (rammedId && rng) {
        return resolveRammingChain(state, playerId, rammedId, from, targetId, rng, track);
    }

    const updatedShip: ShipState = {
        ...ship,
        positionId: targetId,
        movementRemaining: Math.max(0, ship.movementRemaining - 1),
        corneringChecksRemaining: track.corneringChecksOwed(ship.chosenSpeed, targetId),
    };

    return {
        state: {
            ...state,
            ships: {
                ...state.ships,
                [playerId]: updatedShip,
            },
        },
        events: [{ type: 'SHIP_MOVED', playerId, from, to: targetId }],
    };
}

export function prepareShipForMovement(
    state: GameState,
    playerId: string,
): GameState {
    const input = state.inputs[playerId];
    const ship = state.ships[playerId];

    if (!input || !ship) {
        return state;
    }

    return {
        ...state,
        activePlayerId: playerId,
        ships: {
            ...state.ships,
            [playerId]: {
                ...ship,
                chosenSpeed: input.speed,
                movementRemaining: input.speed,
                flogAttemptsRemaining: state.config.flogAttemptsPerTurn,
            },
        },
    };
}

export function driftDirectionFromOutcome(outcome: string): MoveDirection | null {
    if (outcome === 'drift1' || outcome === 'drift2' || outcome === 'drift3') {
        return 'laneOut';
    }

    if (outcome === 'moveIn1') {
        return 'laneIn';
    }

    return null;
}

export function driftStepsFromOutcome(outcome: string): number {
    switch (outcome) {
        case 'drift1':
        case 'moveIn1':
            return 1;
        case 'drift2':
            return 2;
        case 'drift3':
            return 3;
        default:
            return 0;
    }
}
