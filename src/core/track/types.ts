/** Named hex on the race course graph (e.g. "a1", "b12"). */
export type TrackNodeId = string;

/** Neighbor index on each track node — matches the original POC layout. */
export const MOVE = {
    laneIn: 0,
    forward: 1,
    laneOut: 2,
    rearRight: 3,
    rear: 4,
    rearLeft: 5,
} as const;

export type MoveIndex = (typeof MOVE)[keyof typeof MOVE];

export type MoveDirection = keyof typeof MOVE;

export const WALL = 'wall' as const;

export type TrackNeighbor = TrackNodeId | typeof WALL;

export interface TrackNodeRaw {
    name: TrackNodeId;
    x: number;
    y: number;
    angle: number;
    moves: TrackNeighbor[];
    speed?: number;
}

export interface TrackNode {
    id: TrackNodeId;
    x: number;
    y: number;
    angle: number;
    /** Safe speed for this hex; unlimited when omitted. */
    safeSpeed?: number;
    neighbors: Record<MoveDirection, TrackNeighbor>;
}

export type HitSide = 'front' | 'rear' | 'left' | 'right';
