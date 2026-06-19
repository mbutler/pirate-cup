import { resolveRamming } from '../cards/decks';
import type { GameEvent } from '../events/types';
import type { Rng } from '../rng/Rng';
import { defaultTrack, type TrackGraph } from '../track/TrackGraph';
import type { HitSide, MoveDirection, TrackNodeId } from '../track/types';
import { applyHullDamage, applyMastDamage } from './damage';
import { getOccupyingShipId } from './movement';
import { integratePostDamage } from './frenzy';
import { resolveWallCollisionForShip, wallSideForPush } from './wallCollision';
import type { GameState } from '../state/GameState';

const MOVE_DIRECTIONS: MoveDirection[] = [
    'laneIn',
    'forward',
    'laneOut',
    'rearRight',
    'rear',
    'rearLeft',
];

export interface RammingResolution {
    state: GameState;
    events: GameEvent[];
}

/** Move index on `fromId` whose neighbor equals `toId` (POC hit-location lookup). */
export function findMoveIndex(
    fromId: TrackNodeId,
    toId: TrackNodeId,
    track: TrackGraph = defaultTrack,
): number {
    const node = track.getNode(fromId);

    for (let index = 0; index < MOVE_DIRECTIONS.length; index++) {
        if (node.neighbors[MOVE_DIRECTIONS[index]] === toId) {
            return index;
        }
    }

    return -1;
}

/** Which side of the rammed ship was struck, from the rammer's approach vector. */
export function inferRamHitSideFromApproach(
    rammerFrom: TrackNodeId,
    collisionHex: TrackNodeId,
    track: TrackGraph = defaultTrack,
): HitSide {
    const moveIndex = findMoveIndex(rammerFrom, collisionHex, track);

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

/** Front hits bounce off the nearest wall on the rammed hex (POC behavior). */
export function resolveFrontHitBounce(
    hitSide: HitSide,
    rammedAt: TrackNodeId,
    track: TrackGraph = defaultTrack,
): HitSide {
    if (hitSide !== 'front') {
        return hitSide;
    }

    const node = track.getNode(rammedAt);

    if (track.isWall(node.neighbors.rearRight)) {
        return 'right';
    }

    if (track.isWall(node.neighbors.rearLeft)) {
        return 'left';
    }

    return hitSide;
}

function pushSideForDisplacement(
    hitSide: HitSide,
    rng: Rng,
): 'left' | 'right' {
    if (hitSide === 'left') {
        return 'left';
    }

    if (hitSide === 'right') {
        return 'right';
    }

    return rng.int(0, 1) === 0 ? 'left' : 'right';
}

function displacementDirection(
    pushSide: 'left' | 'right',
): MoveDirection {
    return pushSide === 'left' ? 'rearRight' : 'rearLeft';
}

function applyRammingDamage(
    state: GameState,
    rammerId: string,
    rammedId: string,
    hitSide: HitSide,
    events: GameEvent[],
): GameState {
    const result = resolveRamming(hitSide);
    let nextState = { ...state, ships: { ...state.ships } };

    const rammed = nextState.ships[rammedId];
    const rammer = nextState.ships[rammerId];

    if (!rammed || !rammer || rammed.destroyed || rammer.destroyed) {
        return nextState;
    }

    events.push({
        type: 'RAMMING',
        rammerId,
        rammedId,
        hitSide,
        rammedSide: result.rammedSide,
        rammedDamage: result.rammedDamage,
        rammerHullSide: result.rammerSide,
        rammerHullDamage: result.rammerDamage,
        rammerMastDamage: result.rammerMastDamage,
    });

    let updatedRammed = applyHullDamage(rammed, result.rammedSide, result.rammedDamage).ship;
    let updatedRammer = rammer;

    if (result.rammerMastDamage) {
        updatedRammer = applyMastDamage(updatedRammer, result.rammerMastDamage);
    }

    if (result.rammerSide && result.rammerDamage) {
        updatedRammer = applyHullDamage(updatedRammer, result.rammerSide, result.rammerDamage).ship;
    }

    nextState.ships[rammedId] = updatedRammed;
    nextState.ships[rammerId] = updatedRammer;

    if (updatedRammed.destroyed) {
        events.push({ type: 'SHIP_DESTROYED', playerId: rammedId });
    }

    if (updatedRammer.destroyed) {
        events.push({ type: 'SHIP_DESTROYED', playerId: rammerId });
    }

    const rammedDamage = result.rammedDamage;
    const rammerDamage = (result.rammerDamage ?? 0) + (result.rammerMastDamage ?? 0);

    nextState = integratePostDamage(nextState, rammedId, rammedDamage, events);
    nextState = integratePostDamage(nextState, rammerId, rammerDamage, events);

    return nextState;
}

function forcedMove(
    state: GameState,
    playerId: string,
    from: TrackNodeId,
    to: TrackNodeId,
    events: GameEvent[],
): GameState {
    const ship = state.ships[playerId];

    if (!ship || ship.destroyed) {
        return state;
    }

    events.push({ type: 'SHIP_MOVED', playerId, from, to });

    return {
        ...state,
        ships: {
            ...state.ships,
            [playerId]: { ...ship, positionId: to },
        },
    };
}

/**
 * Resolve a ram and any chain pushes. The rammer ends on `collisionHex`;
 * the rammed ship is knocked to a side/rear hex and may ram the next ship.
 */
export function resolveRammingChain(
    state: GameState,
    rammerId: string,
    rammedId: string,
    rammerFrom: TrackNodeId,
    collisionHex: TrackNodeId,
    rng: Rng,
    track: TrackGraph = defaultTrack,
): RammingResolution {
    const events: GameEvent[] = [];

    let hitSide = inferRamHitSideFromApproach(rammerFrom, collisionHex, track);
    hitSide = resolveFrontHitBounce(hitSide, collisionHex, track);

    let nextState = applyRammingDamage(state, rammerId, rammedId, hitSide, events);

    const rammed = nextState.ships[rammedId];

    if (!rammed || rammed.destroyed) {
        nextState = voluntaryMoveRammer(nextState, rammerId, rammerFrom, collisionHex, track, events);
        return { state: nextState, events };
    }

    const pushSide = pushSideForDisplacement(hitSide, rng);
    let pushDirection = displacementDirection(pushSide);
    let pushTarget = track.neighbor(collisionHex, pushDirection);

    if (track.isWall(pushTarget)) {
        const wallHit = resolveWallCollisionForShip(
            nextState,
            rammedId,
            wallSideForPush(pushSide),
            rng,
        );
        nextState = wallHit.state;
        events.push(...wallHit.events);

        pushDirection = 'rear';
        pushTarget = track.neighbor(collisionHex, pushDirection);
    }

    if (track.isWall(pushTarget)) {
        const crushHit = resolveWallCollisionForShip(nextState, rammedId, 'rear', rng);
        nextState = crushHit.state;
        events.push(...crushHit.events);
    } else {
        const rammedAfterWall = nextState.ships[rammedId];

        if (rammedAfterWall && !rammedAfterWall.destroyed) {
            const occupantId = getOccupyingShipId(nextState, pushTarget, rammedId);

            if (occupantId) {
                const chain = resolveRammingChain(
                    nextState,
                    rammedId,
                    occupantId,
                    collisionHex,
                    pushTarget,
                    rng,
                    track,
                );
                nextState = chain.state;
                events.push(...chain.events);
            }

            nextState = forcedMove(nextState, rammedId, collisionHex, pushTarget, events);
        }
    }

    nextState = voluntaryMoveRammer(nextState, rammerId, rammerFrom, collisionHex, track, events);

    return { state: nextState, events };
}

function voluntaryMoveRammer(
    state: GameState,
    rammerId: string,
    from: TrackNodeId,
    to: TrackNodeId,
    track: TrackGraph,
    events: GameEvent[],
): GameState {
    const ship = state.ships[rammerId];

    if (!ship || ship.destroyed) {
        return state;
    }

    events.push({ type: 'SHIP_MOVED', playerId: rammerId, from, to });

    return {
        ...state,
        ships: {
            ...state.ships,
            [rammerId]: {
                ...ship,
                positionId: to,
                movementRemaining: Math.max(0, ship.movementRemaining - 1),
                corneringChecksRemaining: track.corneringChecksOwed(ship.chosenSpeed, to),
            },
        },
    };
}
