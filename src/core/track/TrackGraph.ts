import trackData from './data/track.json';
import {
    MOVE,
    type MoveDirection,
    type TrackNeighbor,
    type TrackNode,
    type TrackNodeId,
    type TrackNodeRaw,
    WALL,
} from './types';

const MOVE_DIRECTIONS: MoveDirection[] = [
    'laneIn',
    'forward',
    'laneOut',
    'rearRight',
    'rear',
    'rearLeft',
];

function normalizeNode(raw: TrackNodeRaw): TrackNode {
    const neighbors = {} as Record<MoveDirection, TrackNeighbor>;

    MOVE_DIRECTIONS.forEach((direction, index) => {
        neighbors[direction] = raw.moves[index] ?? WALL;
    });

    return {
        id: raw.name,
        x: raw.x,
        y: raw.y,
        angle: raw.angle,
        safeSpeed: raw.speed,
        neighbors,
    };
}

export class TrackGraph {
    readonly nodes: ReadonlyMap<TrackNodeId, TrackNode>;
    private readonly raceProgress = new Map<TrackNodeId, number>();

    constructor(rawNodes: TrackNodeRaw[] = trackData as TrackNodeRaw[]) {
        this.nodes = new Map(rawNodes.map((raw) => [raw.name, normalizeNode(raw)]));
        this.raceProgress = TrackGraph.buildRaceProgress(this);
    }

    private static buildRaceProgress(track: TrackGraph): Map<TrackNodeId, number> {
        const progress = new Map<TrackNodeId, number>();
        const start: TrackNodeId = 'a1';
        const queue: TrackNodeId[] = [start];

        progress.set(start, 0);

        while (queue.length > 0) {
            const id = queue.shift()!;
            const distance = progress.get(id) ?? 0;

            for (const direction of ['forward', 'laneIn', 'laneOut'] as const) {
                const neighbor = track.neighbor(id, direction);

                if (!track.isWall(neighbor) && !progress.has(neighbor)) {
                    progress.set(neighbor, distance + 1);
                    queue.push(neighbor);
                }
            }
        }

        return progress;
    }

    raceProgressFromStart(id: TrackNodeId): number {
        return this.raceProgress.get(id) ?? 0;
    }

    getNode(id: TrackNodeId): TrackNode {
        const node = this.nodes.get(id);

        if (!node) {
            throw new Error(`Unknown track node: ${id}`);
        }

        return node;
    }

    neighbor(id: TrackNodeId, direction: MoveDirection): TrackNeighbor {
        return this.getNode(id).neighbors[direction];
    }

    isWall(neighbor: TrackNeighbor): neighbor is typeof WALL {
        return neighbor === WALL;
    }

    /** Player movement options: lane in, forward, lane out — excluding walls. */
    playerMoves(from: TrackNodeId): TrackNodeId[] {
        const node = this.getNode(from);

        return ([MOVE.laneIn, MOVE.forward, MOVE.laneOut] as const)
            .map((index) => node.neighbors[MOVE_DIRECTIONS[index]])
            .filter((target): target is TrackNodeId => !this.isWall(target));
    }

    safeSpeedAt(id: TrackNodeId): number | undefined {
        return this.getNode(id).safeSpeed;
    }

    /** How many cornering checks are owed when entering this hex at `speed`. */
    corneringChecksOwed(speed: number, nodeId: TrackNodeId): number {
        const safeSpeed = this.safeSpeedAt(nodeId);

        if (safeSpeed === undefined || speed <= safeSpeed) {
            return 0;
        }

        return speed - safeSpeed;
    }
}

export const defaultTrack = new TrackGraph();
