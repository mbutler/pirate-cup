import type { TrackNodeId } from '../track/types';

export type ShipColor = 'red' | 'blue' | 'black' | 'green' | 'yellow' | 'white';

export interface GameConfig {
    /** Ships in the race (2–6). */
    playerCount: number;
    /** Laps required to win. */
    lapsToWin: number;
    /** Flog-the-rowers attempts allowed after movement each turn. */
    flogAttemptsPerTurn: number;
    /** Grid positions for each ship slot, in player order. */
    startingPositions: TrackNodeId[];
    /** Which hull palette each slot uses. */
    shipColors: ShipColor[];
}

export const DEFAULT_STARTING_POSITIONS: TrackNodeId[] = [
    'a1',
    'b1',
    'c2',
    'c3',
    'b3',
    'a21',
];

export const DEFAULT_SHIP_COLORS: ShipColor[] = [
    'red',
    'blue',
    'green',
    'yellow',
    'white',
    'black',
];

export function createGameConfig(overrides: Partial<GameConfig> = {}): GameConfig {
    const playerCount = overrides.playerCount ?? 6;

    return {
        playerCount,
        lapsToWin: overrides.lapsToWin ?? 3,
        flogAttemptsPerTurn: overrides.flogAttemptsPerTurn ?? 6,
        startingPositions:
            overrides.startingPositions ?? DEFAULT_STARTING_POSITIONS.slice(0, playerCount),
        shipColors: overrides.shipColors ?? DEFAULT_SHIP_COLORS.slice(0, playerCount),
    };
}
