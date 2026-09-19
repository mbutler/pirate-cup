import type { GameEvent } from '../events/types';
import type { ShipState } from '../entities/types';
import type { GameState } from '../state/GameState';
import { defaultTrack, type TrackGraph } from '../track/TrackGraph';

export const FINISH_LINE = { x: 1500, top: 270, bottom: 450 } as const;
export type FinishReason = 'laps' | 'last_ship' | 'all_wrecked';

/** Ordered gates prevent the central channel or a backwards shove from buying a lap. */
export function checkpointAfterMove(
    checkpoint: number,
    x: number,
    y: number,
): number {
    if (checkpoint === 0 && x < 300) return 1;
    if (checkpoint === 1 && x > 900 && y > 600) return 2;
    if (checkpoint === 2 && x > 1650) return 3;
    return checkpoint;
}

export function finishRace(
    state: GameState,
    winnerId: string | null,
    reason: FinishReason,
    events: GameEvent[],
): GameState {
    if (state.phase === 'finished') return state;
    if (winnerId) events.push({ type: 'RACE_WON', playerId: winnerId });
    else events.push({ type: 'RACE_DRAWN' });
    events.push({ type: 'PHASE_CHANGED', from: state.phase, to: 'finished' });
    return {
        ...state,
        phase: 'finished',
        activePlayerId: null,
        activeCrewId: null,
        winnerId,
        finishReason: reason,
        pendingCombat: [],
    };
}

/** Every voluntary move, drift, and ram displacement passes through this function. */
export function moveShip(
    state: GameState,
    playerId: string,
    to: string,
    events: GameEvent[],
    track: TrackGraph = defaultTrack,
): GameState {
    const ship = state.ships[playerId];
    if (
        !ship ||
        ship.destroyed ||
        state.phase === 'finished' ||
        ship.positionId === to
    )
        return state;
    const from = track.getNode(ship.positionId);
    const target = track.getNode(to);
    const crossesFinish =
        from.x >= FINISH_LINE.x &&
        target.x < FINISH_LINE.x &&
        from.y < FINISH_LINE.bottom &&
        target.y < FINISH_LINE.bottom;
    const completedLap = ship.nextCheckpoint === 3 && crossesFinish;
    const updated: ShipState = {
        ...ship,
        positionId: to,
        nextCheckpoint: completedLap
            ? 0
            : checkpointAfterMove(ship.nextCheckpoint, target.x, target.y),
        lapsCompleted: ship.lapsCompleted + (completedLap ? 1 : 0),
        hasStarted: ship.hasStarted || crossesFinish,
    };
    events.push({ type: 'SHIP_MOVED', playerId, from: ship.positionId, to });
    let next = { ...state, ships: { ...state.ships, [playerId]: updated } };
    if (completedLap) {
        events.push({
            type: 'LAP_COMPLETED',
            playerId,
            lap: updated.lapsCompleted,
        });
        if (updated.lapsCompleted >= state.config.lapsToWin)
            next = finishRace(next, playerId, 'laps', events);
    }
    return next;
}

/** Progress only within the next required gate; shortcuts cannot improve a full lap. */
export function raceScore(
    ship: ShipState,
    track: TrackGraph = defaultTrack,
): number {
    const progress = track.raceProgressFromStart(ship.positionId);
    if (!ship.hasStarted && ship.nextCheckpoint === 0)
        return ship.lapsCompleted - (1 - progress);
    const bounds = [0, 0.3, 0.63, 0.83, 1];
    return (
        ship.lapsCompleted +
        Math.max(
            bounds[ship.nextCheckpoint],
            Math.min(bounds[ship.nextCheckpoint + 1] - 0.0001, progress),
        )
    );
}

export function raceStandings(state: GameState): ShipState[] {
    return Object.values(state.ships).sort((a, b) => {
        if (a.id === state.winnerId) return -1;
        if (b.id === state.winnerId) return 1;
        if (a.destroyed !== b.destroyed) return a.destroyed ? 1 : -1;
        return raceScore(b) - raceScore(a);
    });
}
