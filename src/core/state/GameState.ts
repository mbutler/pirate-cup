import {
    createGameConfig,
    DEFAULT_SHIP_COLORS,
    type GameConfig,
} from '../config/GameConfig';
import {
    DEFAULT_CREW,
    DEFAULT_HULL,
    DEFAULT_ROWERS,
    maxSpeedFromRowers,
    type ShipState,
    type DisplacedCrew,
} from '../entities/types';

import type { FinishReason } from '../rules/race';

export type TurnPhase =
    'crew' | 'input' | 'movement' | 'combat' | 'cleanup' | 'finished';

export interface TurnInput {
    speed: number;
    /** Ordered move directions for each movement point. */
    moves: ('laneIn' | 'forward' | 'laneOut')[];
    /** Locked combat target, resolved in combat phase. */
    attackTargetId?: string;
}

export interface PendingCombat {
    attackerId: string;
    targetId: string | null;
}

export interface GameState {
    config: GameConfig;
    seed: string;
    turn: number;
    phase: TurnPhase;
    /** Physical vessel id whose client UI is active; captain identity is ship.ownerId. */
    activePlayerId: string | null;
    /** Movement resolution order for the current turn (highest speed first). */
    movementOrder: string[];
    /** Index into movementOrder during movement phase. */
    movementIndex: number;
    ships: Record<string, ShipState>;
    displacedCrew: Record<string, DisplacedCrew>;
    activeCrewId: string | null;
    /** Secret inputs keyed by player/ship id. */
    inputs: Record<string, TurnInput | undefined>;
    /** Combat declarations queued for simultaneous resolution. */
    pendingCombat: PendingCombat[];
    winnerId: string | null;
    finishReason: FinishReason | null;
}

export function createShipState(
    id: string,
    color: ShipState['color'],
    positionId: string,
    config: GameConfig,
): ShipState {
    const rowers = { ...DEFAULT_ROWERS };

    return {
        id,
        ownerId: id,
        color,
        positionId,
        lapsCompleted: 0,
        nextCheckpoint: 0,
        hasStarted: false,
        maxSpeed: maxSpeedFromRowers(rowers),
        chosenSpeed: 0,
        movementRemaining: 0,
        corneringChecksRemaining: 0,
        driftRemaining: 0,
        bonusMovement: 0,
        flogAttemptsRemaining: config.flogAttemptsPerTurn,
        turnDamageTaken: 0,
        destroyed: false,
        hull: { ...DEFAULT_HULL },
        crew: { ...DEFAULT_CREW },
        rowers,
    };
}

export function createInitialState(
    seed: string,
    configOverrides: Partial<GameConfig> = {},
): GameState {
    const config = createGameConfig(configOverrides);
    const ships: Record<string, ShipState> = {};

    for (let i = 0; i < config.playerCount; i++) {
        const id = `player-${i + 1}`;
        ships[id] = createShipState(
            id,
            config.shipColors[i] ?? DEFAULT_SHIP_COLORS[i],
            config.startingPositions[i],
            config,
        );
    }

    const firstPlayerId = Object.keys(ships)[0] ?? null;

    return {
        config,
        seed,
        turn: 1,
        phase: 'input',
        activePlayerId: firstPlayerId,
        movementOrder: [],
        movementIndex: 0,
        ships,
        displacedCrew: {},
        activeCrewId: null,
        inputs: {},
        pendingCombat: [],
        winnerId: null,
        finishReason: null,
    };
}

export function allInputsSubmitted(state: GameState): boolean {
    const activeShips = Object.values(state.ships).filter(
        (ship) => !ship.destroyed,
    );

    return activeShips.every((ship) => state.inputs[ship.id] !== undefined);
}

export function computeMovementOrder(state: GameState): string[] {
    return Object.values(state.ships)
        .filter((ship) => !ship.destroyed && state.inputs[ship.id])
        .sort((a, b) => {
            const speedA = state.inputs[a.id]?.speed ?? 0;
            const speedB = state.inputs[b.id]?.speed ?? 0;
            return speedB - speedA;
        })
        .map((ship) => ship.id);
}
