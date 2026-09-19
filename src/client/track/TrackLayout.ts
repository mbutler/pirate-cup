import type { TrackNode } from '../../core/track/types';

/**
 * Layout constants from the original POC.
 * Track node x/y values are absolute world coordinates on the 1920×1080 board.
 * The lane overlay image is shorter than the world and sits below the top margin.
 */
export const TRACK_LAYOUT = {
    worldWidth: 1920,
    worldHeight: 1080,
    /** Original `track.png` sprite Y — aligns the lane grid overlay with node coordinates. */
    overlayY: 265,
    /** Ship sprites are slightly bottom-heavy in their frame; nudge onto the lane center. */
    shipOriginX: 0.5,
    shipOriginY: 0.55,
} as const;

export function trackNodeToWorld(node: TrackNode) {
    return {
        x: node.x,
        y: node.y,
        angle: node.angle,
    };
}

/** Signed shortest turn, including the seam between +180 and -180 degrees. */
export function shortestAngleDelta(from: number, to: number): number {
    return ((((to - from + 180) % 360) + 360) % 360) - 180;
}
