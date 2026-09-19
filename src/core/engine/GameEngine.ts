import type { GameAction } from '../actions/types';
import type { GameEvent } from '../events/types';
import { drawCornering, drawFlogging } from '../cards/decks';
import type { Rng } from '../rng/Rng';
import type { MoveDirection } from '../track/types';
import {
    createInitialState,
    type GameState,
    type TurnInput,
} from '../state/GameState';
import { applyHullDamage, applyMastDamage } from '../rules/damage';
import { applyMove, prepareShipForMovement } from '../rules/movement';
import {
    beginCombat,
    nextCombatCaptain,
    queueAttack,
    resolveCombatPhase,
} from '../rules/combat';
import {
    frenzySpeed,
    integratePostDamage,
    isInFrenzy,
    markFrenzy,
    resolveCleanupPhase,
} from '../rules/frenzy';
import { resolveWallCollisionForShip } from '../rules/wallCollision';
import {
    rescueWreckedCrews,
    beginCrewPhase,
    resolveCrewAction,
} from '../rules/crew';
import { finishRace } from '../rules/race';
import { defaultTrack } from '../track/TrackGraph';

export interface ReduceResult {
    state: GameState;
    events: GameEvent[];
}

/**
 * Pure state transition function.
 * A future online server calls the same reducer; clients replay the event log.
 */
export function reduce(
    state: GameState,
    action: GameAction,
    rng: Rng,
): ReduceResult {
    if (state.phase === 'finished') return { state, events: [] };
    // Validate commands at the rule boundary, not just in the local controls.
    if ('playerId' in action) {
        const ship = state.ships[action.playerId];
        if (!ship || ship.destroyed || state.activePlayerId !== action.playerId)
            return { state, events: [] };
        if (action.type === 'SUBMIT_TURN_INPUT') {
            if (state.phase !== 'input' || !Number.isFinite(action.input.speed))
                return { state, events: [] };
        } else {
            if (state.phase !== 'movement') return { state, events: [] };
            if (
                action.type === 'CHOOSE_MOVE' &&
                (ship.movementRemaining <= 0 ||
                    !['laneIn', 'forward', 'laneOut'].includes(
                        action.direction,
                    ) ||
                    (isInFrenzy(ship) && action.direction !== 'forward'))
            )
                return { state, events: [] };
            if (
                (action.type === 'FLOG_DECISION' ||
                    action.type === 'RESOLVE_FLOGGING') &&
                (ship.movementRemaining > 0 || isInFrenzy(ship))
            )
                return { state, events: [] };
        }
    }
    if (
        [
            'DECLARE_ATTACK',
            'PASS_ATTACK',
            'RESOLVE_COMBAT',
            'END_TURN',
        ].includes(action.type) &&
        state.phase !== 'combat'
    )
        return { state, events: [] };
    const result =
        'crewId' in action
            ? resolveCrewAction(state, action, rng)
            : reduceAction(state, action, rng);
    result.state = rescueWreckedCrews(result.state, result.events);
    if (
        result.state.phase === 'combat' &&
        state.phase !== 'combat' &&
        state.phase !== 'crew'
    ) {
        result.state = beginCrewPhase(result.state);
        if (result.state.phase === 'crew') {
            result.events = result.events.map((event) =>
                event.type === 'PHASE_CHANGED' && event.to === 'combat'
                    ? { ...event, to: 'crew' }
                    : event,
            );
        }
    }
    if (result.state.phase === 'finished') return result;
    const alive = Object.values(result.state.ships).filter(
        (ship) => !ship.destroyed,
    );
    if (
        alive.length === 0 ||
        (alive.length === 1 &&
            Object.keys(result.state.displacedCrew).length === 0)
    ) {
        result.state = finishRace(
            result.state,
            alive[0]?.id ?? null,
            alive.length ? 'last_ship' : 'all_wrecked',
            result.events,
        );
    } else if (
        result.state.activePlayerId &&
        result.state.ships[result.state.activePlayerId].destroyed
    ) {
        return advanceAfterMovement(
            result.state,
            result.state.activePlayerId,
            result.events,
        );
    }
    return result;
}

function reduceAction(
    state: GameState,
    action: GameAction,
    rng: Rng,
): ReduceResult {
    switch (action.type) {
        case 'SUBMIT_TURN_INPUT':
            return submitTurnInput(state, action.playerId, action.input, rng);
        case 'BEGIN_MOVEMENT_PHASE':
            return { state, events: [] }; // Sequential play begins with SUBMIT_TURN_INPUT.
        case 'CHOOSE_MOVE':
            return chooseMove(state, action.playerId, action.direction, rng);
        case 'RESOLVE_CORNERING':
            return resolveCornering(state, action.playerId, rng);
        case 'FLOG_DECISION':
            return flogDecision(state, action.playerId, action.flog, rng);
        case 'RESOLVE_FLOGGING':
            return resolveFlogging(state, action.playerId, rng);
        case 'PASS_ATTACK':
        case 'DECLARE_ATTACK': {
            const targetId =
                action.type === 'PASS_ATTACK' ? null : action.targetId;
            const next = queueAttack(state, action.attackerId, targetId);
            return {
                state: next,
                events:
                    next === state
                        ? []
                        : [
                              {
                                  type: 'ATTACK_DECLARED',
                                  attackerId: action.attackerId,
                                  targetId,
                              },
                          ],
            };
        }
        case 'RESOLVE_COMBAT':
            return endTurn(state, rng);
        case 'END_TURN':
            return endTurn(state, rng);
        default:
            return { state, events: [] };
    }
}

function submitTurnInput(
    state: GameState,
    playerId: string,
    input: TurnInput,
    rng: Rng,
): ReduceResult {
    if (state.phase !== 'input' || state.activePlayerId !== playerId) {
        return { state, events: [] };
    }

    const ship = state.ships[playerId];

    if (!ship || ship.destroyed) {
        return { state, events: [] };
    }

    const frenzyTurn = isInFrenzy(ship);
    const events: GameEvent[] = [];
    let clampedSpeed: number;

    if (frenzyTurn) {
        const rolled = frenzySpeed(ship.maxSpeed, rng);
        clampedSpeed = rolled.speed;
        events.push({
            type: 'MUTINY_SPEED_ROLLED',
            playerId,
            roll: rolled.roll,
            speed: rolled.speed,
        });
    } else {
        clampedSpeed = Math.max(
            0,
            Math.min(Math.floor(input.speed), ship.maxSpeed),
        );
    }

    let nextState: GameState = {
        ...state,
        phase: 'movement',
        inputs: {
            ...state.inputs,
            [playerId]: {
                speed: clampedSpeed,
                moves: [],
            },
        },
    };

    nextState = prepareShipForMovement(nextState, playerId);

    if (frenzyTurn) {
        const prepared = nextState.ships[playerId];

        if (prepared) {
            nextState = {
                ...nextState,
                ships: {
                    ...nextState.ships,
                    [playerId]: {
                        ...prepared,
                        flogAttemptsRemaining: 0,
                    },
                },
            };
        }
    }

    events.push(
        { type: 'TURN_INPUT_RECEIVED', playerId, speed: clampedSpeed },
        { type: 'PHASE_CHANGED', from: 'input', to: 'movement' },
    );

    return {
        state: { ...nextState, activePlayerId: playerId },
        events,
    };
}

function chooseMove(
    state: GameState,
    playerId: string,
    direction: MoveDirection,
    rng: Rng,
): ReduceResult {
    const shipBefore = state.ships[playerId];
    const { state: movedState, events } = applyMove(
        state,
        playerId,
        direction,
        defaultTrack,
        rng,
    );
    const ship = movedState.ships[playerId];

    if (movedState.phase === 'finished') return { state: movedState, events };
    if (ship?.destroyed)
        return advanceAfterMovement(movedState, playerId, events);
    if (!ship) {
        return { state: movedState, events };
    }

    if (
        events.length === 0 &&
        shipBefore &&
        isInFrenzy(shipBefore) &&
        ship.movementRemaining > 0
    ) {
        const stuckShip = { ...ship, movementRemaining: 0 };

        return advanceAfterMovement(
            {
                ...movedState,
                ships: { ...movedState.ships, [playerId]: stuckShip },
            },
            playerId,
            events,
        );
    }

    if (ship.corneringChecksRemaining > 0) {
        return resolveCornering(movedState, playerId, rng, events);
    }

    if (ship.movementRemaining <= 0) {
        return advanceAfterMovement(movedState, playerId, events);
    }

    return { state: movedState, events };
}

function resolveCornering(
    state: GameState,
    playerId: string,
    rng: Rng,
    priorEvents: GameEvent[] = [],
): ReduceResult {
    const ship = state.ships[playerId];

    if (
        state.phase === 'finished' ||
        !ship ||
        ship.destroyed ||
        ship.corneringChecksRemaining <= 0
    ) {
        return { state, events: priorEvents };
    }

    const outcome = drawCornering(rng);
    const events: GameEvent[] = [
        ...priorEvents,
        { type: 'CORNERING_DRAWN', playerId, outcome },
    ];

    let nextShip = {
        ...ship,
        corneringChecksRemaining: ship.corneringChecksRemaining - 1,
    };

    const nextState: GameState = {
        ...state,
        ships: { ...state.ships, [playerId]: nextShip },
    };

    if (outcome === 'hold' && nextShip.corneringChecksRemaining > 0) {
        return resolveCornering(nextState, playerId, rng, events);
    }

    if (outcome.startsWith('drift') || outcome === 'moveIn1') {
        const steps =
            outcome === 'drift1' || outcome === 'moveIn1'
                ? 1
                : outcome === 'drift2'
                  ? 2
                  : 3;
        const driftDirection: MoveDirection =
            outcome === 'moveIn1' ? 'laneIn' : 'laneOut';

        nextShip = { ...nextShip, driftRemaining: steps };

        return resolveDrift(
            {
                ...nextState,
                ships: { ...nextState.ships, [playerId]: nextShip },
            },
            playerId,
            driftDirection,
            rng,
            events,
        );
    }

    if (nextShip.corneringChecksRemaining > 0) {
        return resolveCornering(nextState, playerId, rng, events);
    }

    if (nextShip.movementRemaining <= 0) {
        return advanceAfterMovement(nextState, playerId, events);
    }

    return { state: nextState, events };
}

function resolveDrift(
    state: GameState,
    playerId: string,
    direction: MoveDirection,
    rng: Rng,
    priorEvents: GameEvent[] = [],
): ReduceResult {
    const ship = state.ships[playerId];

    if (
        state.phase === 'finished' ||
        !ship ||
        ship.destroyed ||
        ship.driftRemaining <= 0
    ) {
        return { state, events: priorEvents };
    }

    const target = defaultTrack.neighbor(ship.positionId, direction);

    if (defaultTrack.isWall(target)) {
        const side = direction === 'laneIn' ? 'left' : 'right';
        const resolved = resolveWallCollisionForShip(
            state,
            playerId,
            side,
            rng,
        );

        const events = [...priorEvents, ...resolved.events];
        const afterWall = resolved.state.ships[playerId];
        return afterWall.destroyed || afterWall.movementRemaining <= 0
            ? advanceAfterMovement(resolved.state, playerId, events)
            : { state: resolved.state, events };
    }

    const { state: movedState, events: moveEvents } = applyMove(
        state,
        playerId,
        direction,
        defaultTrack,
        rng,
        true,
    );
    const movedShip = movedState.ships[playerId];

    if (movedState.phase === 'finished')
        return { state: movedState, events: [...priorEvents, ...moveEvents] };
    if (movedShip?.destroyed)
        return advanceAfterMovement(movedState, playerId, [
            ...priorEvents,
            ...moveEvents,
        ]);
    if (!movedShip) {
        return { state: movedState, events: [...priorEvents, ...moveEvents] };
    }

    const nextShip = {
        ...movedShip,
        driftRemaining: Math.max(0, movedShip.driftRemaining - 1),
    };

    const nextState = {
        ...movedState,
        ships: { ...movedState.ships, [playerId]: nextShip },
    };

    const events = [...priorEvents, ...moveEvents];

    if (nextShip.driftRemaining > 0) {
        return resolveDrift(nextState, playerId, direction, rng, events);
    }

    if (nextShip.corneringChecksRemaining > 0) {
        return resolveCornering(nextState, playerId, rng, events);
    }

    if (nextShip.movementRemaining <= 0) {
        return advanceAfterMovement(nextState, playerId, events);
    }

    return { state: nextState, events };
}

function flogDecision(
    state: GameState,
    playerId: string,
    flog: boolean,
    rng: Rng,
): ReduceResult {
    if (!flog) {
        const ship = state.ships[playerId];

        if (!ship) {
            return advanceAfterMovement(state, playerId);
        }

        const nextState: GameState = {
            ...state,
            ships: {
                ...state.ships,
                [playerId]: {
                    ...ship,
                    flogAttemptsRemaining: 0,
                },
            },
        };

        return advanceAfterMovement(nextState, playerId);
    }

    return resolveFlogging(state, playerId, rng);
}

function resolveFlogging(
    state: GameState,
    playerId: string,
    rng: Rng,
): ReduceResult {
    const ship = state.ships[playerId];

    if (!ship || ship.flogAttemptsRemaining <= 0) {
        return advanceAfterMovement(state, playerId);
    }

    const outcome = drawFlogging(rng);
    const events: GameEvent[] = [{ type: 'FLOGGING_DRAWN', playerId, outcome }];
    let nextShip = {
        ...ship,
        flogAttemptsRemaining: ship.flogAttemptsRemaining - 1,
    };
    let flogDamage = 0;

    switch (outcome) {
        case 'damage3Front1Mast':
            nextShip = applyHullDamage(nextShip, 'front', 3).ship;
            nextShip = applyMastDamage(nextShip, 1);
            flogDamage = 4;
            break;
        case 'damage3Front':
            nextShip = applyHullDamage(nextShip, 'front', 3).ship;
            flogDamage = 3;
            break;
        case 'damage2Front1Mast':
            nextShip = applyHullDamage(nextShip, 'front', 2).ship;
            nextShip = applyMastDamage(nextShip, 1);
            flogDamage = 3;
            break;
        case 'move1Damage1Mast':
            nextShip = applyMastDamage(nextShip, 1);
            nextShip = { ...nextShip, bonusMovement: 1 };
            flogDamage = 1;
            break;
        case 'damage2Front':
            nextShip = applyHullDamage(nextShip, 'front', 2).ship;
            flogDamage = 2;
            break;
        case 'move1':
            nextShip = { ...nextShip, bonusMovement: 1 };
            break;
        case 'damage1Front':
            nextShip = applyHullDamage(nextShip, 'front', 1).ship;
            flogDamage = 1;
            break;
        case 'move2EndTurn':
            nextShip = {
                ...nextShip,
                bonusMovement: 2,
                flogAttemptsRemaining: 0,
            };
            break;
        case 'move2':
            nextShip = { ...nextShip, bonusMovement: 2 };
            break;
        case 'move1EndTurn':
            nextShip = {
                ...nextShip,
                bonusMovement: 1,
                flogAttemptsRemaining: 0,
            };
            break;
        case 'damage1Front1Mast':
            nextShip = applyHullDamage(nextShip, 'front', 1).ship;
            nextShip = applyMastDamage(nextShip, 1);
            flogDamage = 2;
            break;
        case 'mutiny':
            nextShip = markFrenzy({
                ...nextShip,
                movementRemaining: 0,
                bonusMovement: 0,
            });
            events.push({ type: 'MUTINY_STARTED', playerId, reason: 'flog' });
            break;
    }

    nextShip = {
        ...nextShip,
        movementRemaining: nextShip.movementRemaining + nextShip.bonusMovement,
        bonusMovement: 0,
    };

    let nextState: GameState = {
        ...state,
        ships: { ...state.ships, [playerId]: nextShip },
    };

    if (nextShip.destroyed) events.push({ type: 'SHIP_DESTROYED', playerId });
    if (flogDamage > 0) {
        nextState = integratePostDamage(
            nextState,
            playerId,
            flogDamage,
            events,
        );
    }

    const resolvedShip = nextState.ships[playerId];
    if (
        !resolvedShip.destroyed &&
        (resolvedShip.movementRemaining > 0 ||
            (resolvedShip.flogAttemptsRemaining > 0 &&
                !isInFrenzy(resolvedShip)))
    ) {
        return { state: nextState, events };
    }

    return advanceAfterMovement(nextState, playerId, events);
}

function advanceAfterMovement(
    state: GameState,
    playerId: string,
    priorEvents: GameEvent[] = [],
): ReduceResult {
    const ship = state.ships[playerId];

    if (
        ship &&
        !ship.destroyed &&
        ship.movementRemaining <= 0 &&
        ship.flogAttemptsRemaining > 0 &&
        !isInFrenzy(ship)
    ) {
        return {
            state: { ...state, activePlayerId: playerId },
            events: priorEvents,
        };
    }

    if (state.phase === 'finished') return { state, events: priorEvents };
    const playerIds = Object.keys(state.ships);
    const currentIndex = playerIds.indexOf(playerId);
    const nextPlayerId = playerIds
        .slice(currentIndex + 1)
        .find((id) => !state.ships[id].destroyed);

    if (!nextPlayerId) {
        return {
            state: beginCombat(state),
            events: [
                ...priorEvents,
                { type: 'PHASE_CHANGED', from: 'movement', to: 'combat' },
            ],
        };
    }

    return {
        state: {
            ...state,
            phase: 'input',
            activePlayerId: nextPlayerId,
        },
        events: [
            ...priorEvents,
            { type: 'PHASE_CHANGED', from: 'movement', to: 'input' },
        ],
    };
}

function endTurn(state: GameState, rng: Rng): ReduceResult {
    if (state.phase !== 'combat' || nextCombatCaptain(state) !== null) {
        return { state, events: [] };
    }

    const combat = resolveCombatPhase(state);
    const cleanup = resolveCleanupPhase(combat.state, rng);
    const firstPlayerId =
        Object.values(cleanup.state.ships).find((ship) => !ship.destroyed)
            ?.id ?? null;

    return {
        state: {
            ...cleanup.state,
            turn: state.turn + 1,
            phase: 'input',
            inputs: {},
            movementOrder: [],
            movementIndex: 0,
            activePlayerId: firstPlayerId,
        },
        events: [
            ...combat.events,
            { type: 'PHASE_CHANGED', from: 'combat', to: 'cleanup' },
            ...cleanup.events,
            { type: 'PHASE_CHANGED', from: 'cleanup', to: 'input' },
        ],
    };
}

export { createInitialState };
