import type { GameAction } from '../actions/types';
import type { GameEvent } from '../events/types';
import type { GameState } from '../state/GameState';
import type { Rng } from '../rng/Rng';
import { defaultTrack } from '../track/TrackGraph';
import { hijackStrength } from './crewSkill';
import { beginCombat } from './combat';

export function rescueWreckedCrews(
    state: GameState,
    events: GameEvent[],
): GameState {
    let next = state;
    for (const ship of Object.values(state.ships)) {
        if (!ship.destroyed || ship.crew.captainHp + ship.crew.boarderHp <= 0)
            continue;
        next = {
            ...next,
            ships: {
                ...next.ships,
                [ship.id]: { ...ship, crew: { captainHp: 0, boarderHp: 0 } },
            },
            displacedCrew: {
                ...next.displacedCrew,
                [ship.ownerId]: {
                    id: ship.ownerId,
                    color: ship.color,
                    positionId: ship.positionId,
                    ...ship.crew,
                    lapsCompleted: ship.lapsCompleted,
                    actedTurn: 0,
                },
            },
        };
        events.push({
            type: 'CREW_MESSAGE',
            message: `${ship.color} crew escapes ${ship.rowers.hp === 0 && ship.hull.structure > 0 ? 'the disabled ship — no rowers remain' : 'the wreck'} in a dinghy.`,
        });
    }
    return next;
}

export function crewDestinations(state: GameState, crewId: string): string[] {
    const crew = state.displacedCrew[crewId];
    if (!crew) return [];
    return [
        ...new Set(
            Object.values(defaultTrack.getNode(crew.positionId).neighbors),
        ),
    ].filter((id) => id !== 'wall');
}

export function hijackTargets(state: GameState, crewId: string): string[] {
    const crew = state.displacedCrew[crewId];
    if (!crew) return [];
    const reachable = [crew.positionId, ...crewDestinations(state, crewId)];
    return Object.values(state.ships)
        .filter(
            (ship) => !ship.destroyed && reachable.includes(ship.positionId),
        )
        .map((ship) => ship.id);
}

export function beginCrewPhase(state: GameState): GameState {
    const next = Object.values(state.displacedCrew).find(
        (crew) => crew.actedTurn !== state.turn,
    );
    return next
        ? {
              ...state,
              phase: 'crew',
              activePlayerId: null,
              activeCrewId: next.id,
          }
        : beginCombat({ ...state, activeCrewId: null });
}

export function resolveCrewAction(
    state: GameState,
    action: Extract<GameAction, { crewId: string }>,
    rng: Rng,
): { state: GameState; events: GameEvent[] } {
    const crew = state.displacedCrew[action.crewId];
    if (
        state.phase !== 'crew' ||
        state.activeCrewId !== action.crewId ||
        !crew ||
        crew.actedTurn === state.turn
    )
        return { state, events: [] };
    let next: GameState = {
        ...state,
        displacedCrew: {
            ...state.displacedCrew,
            [crew.id]: { ...crew, actedTurn: state.turn },
        },
    };
    const events: GameEvent[] = [];
    const say = (message: string, capturedShipId?: string) =>
        events.push({
            type: 'CREW_MESSAGE',
            message,
            ...(capturedShipId ? { capturedShipId } : {}),
        });
    if (action.type === 'CREW_MOVE') {
        if (!crewDestinations(state, crew.id).includes(action.destinationId))
            return { state, events: [] };
        next.displacedCrew[crew.id] = {
            ...next.displacedCrew[crew.id],
            positionId: action.destinationId,
        };
        say(
            `${crew.color} crew rows to ${action.destinationId.toUpperCase()}.`,
        );
    } else if (action.type === 'CREW_RETIRE') {
        delete next.displacedCrew[crew.id];
        say(`${crew.color} crew retires from the race.`);
    } else if (action.type === 'HIJACK') {
        if (!hijackTargets(state, crew.id).includes(action.targetId))
            return { state, events: [] };
        const target = state.ships[action.targetId];
        const attack = rng.int(1, 10) + hijackStrength(crew);
        const defense = rng.int(1, 10) + hijackStrength(target.crew);
        if (attack > defense) {
            delete next.displacedCrew[crew.id];
            if (target.crew.captainHp + target.crew.boarderHp > 0)
                next.displacedCrew[target.ownerId] = {
                    id: target.ownerId,
                    color: target.color,
                    positionId: target.positionId,
                    ...target.crew,
                    lapsCompleted: target.lapsCompleted,
                    actedTurn: state.turn,
                };
            next.ships = {
                ...state.ships,
                [target.id]: {
                    ...target,
                    ownerId: crew.id,
                    color: crew.color,
                    crew: {
                        captainHp: crew.captainHp,
                        boarderHp: crew.boarderHp,
                    },
                    lapsCompleted: crew.lapsCompleted,
                    nextCheckpoint: 0,
                    hasStarted: true,
                },
            };
            say(
                `${crew.color} hijacks ${target.color}'s ship (${attack} vs ${defense})! ${target.color}'s crew is displaced. Earned laps stay with each captain; the current lap restarts.`,
                target.id,
            );
        } else {
            const captainHp = Math.max(0, crew.captainHp - 4);
            const boarderHp = Math.max(
                0,
                crew.boarderHp - Math.max(0, 4 - crew.captainHp),
            );
            if (captainHp + boarderHp === 0) delete next.displacedCrew[crew.id];
            else
                next.displacedCrew[crew.id] = {
                    ...next.displacedCrew[crew.id],
                    positionId: target.positionId,
                    captainHp,
                    boarderHp,
                };
            say(
                `${crew.color}'s hijack fails (${attack} vs ${defense}; ties defend). Crew loses 4 health${captainHp + boarderHp === 0 ? ' and is eliminated' : ''}.`,
            );
        }
    } else {
        say(`${crew.color} crew waits for a better opportunity.`);
    }
    next = beginCrewPhase(next);
    if (next.phase === 'combat')
        events.push({ type: 'PHASE_CHANGED', from: 'crew', to: 'combat' });
    return { state: next, events };
}
