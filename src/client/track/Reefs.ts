import { Math as PhaserMath, type Scene } from 'phaser';
import { defaultTrack } from '../../core/track/TrackGraph';

type Point = { x: number; y: number };

/** Offset a closed shoreline toward its interior (negative distances move out). */
function offsetLoop(points: Point[], distance: number): Point[] {
    const area = points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
    }, 0);
    return points.map((p, i) => {
        const previous = points[(i + points.length - 1) % points.length];
        const next = points[(i + 1) % points.length];
        const dx = next.x - previous.x,
            dy = next.y - previous.y;
        const length = Math.hypot(dx, dy);
        const sign = area > 0 ? 1 : -1;
        return {
            x: p.x - ((sign * dy) / length) * distance,
            y: p.y + ((sign * dx) / length) * distance,
        };
    });
}

/** Rounded, lightly irregular contours keep the boundary from looking engineered. */
function softenLoop(points: Point[]): Point[] {
    return points.flatMap((p, i) => {
        const before = points[(i + points.length - 1) % points.length];
        const next = points[(i + 1) % points.length];
        const after = points[(i + 2) % points.length];
        return Array.from({ length: 10 }, (_, j) => {
            const t = j / 10;
            const curve = (a: number, b: number, c: number, d: number) =>
                0.5 *
                (2 * b +
                    (-a + c) * t +
                    (2 * a - 5 * b + 4 * c - d) * t * t +
                    (-a + 3 * b - 3 * c + d) * t * t * t);
            return {
                x: curve(before.x, p.x, next.x, after.x),
                y: curve(before.y, p.y, next.y, after.y),
            };
        });
    });
}

/** Continuous shallows delineate the outer edge and both islands, leaving the central channel open. */
export function drawReefs(scene: Scene) {
    const nodes = (ids: string[]) => ids.map((id) => defaultTrack.getNode(id));
    const loops = [
        offsetLoop(
            nodes(Array.from({ length: 44 }, (_, i) => `d${i + 1}`)),
            -29,
        ),
        offsetLoop(
            nodes([
                ...Array.from({ length: 12 }, (_, i) => `a${i + 7}`),
                'x11',
                'x7',
                'x4',
            ]),
            32,
        ),
        offsetLoop(
            nodes([
                ...Array.from({ length: 9 }, (_, i) => `a${i + 22}`),
                'a1',
                'a2',
                'a3',
                'x1',
                'x5',
                'x8',
            ]),
            32,
        ),
    ];
    const water = scene.add.graphics().setDepth(1.3);
    const rocks = scene.add.graphics().setDepth(1.4);
    const surf = scene.add.graphics().setDepth(1.5);
    for (const [loopIndex, points] of loops.entries()) {
        // Layered translucent strokes soften the reef edge without obscuring track markings.
        for (const [width, color, alpha] of [
            [56, 0x70baae, 0.1],
            [36, 0x86cbbb, 0.18],
            [20, 0xa2c8b0, 0.22],
        ]) {
            water.lineStyle(width, color, alpha);
            water.strokePoints(
                softenLoop(points).map((p) => new PhaserMath.Vector2(p.x, p.y)),
                true,
            );
        }
        for (let i = 0; i < points.length; i++) {
            const a = points[i],
                b = points[(i + 1) % points.length];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            const count = Math.max(1, Math.round(length / 27));
            for (let j = 0; j < count; j++) {
                const t = (j + 0.5) / count;
                const seed = i * 37 + j * 17 + loopIndex * 103;
                const x = a.x + (b.x - a.x) * t + Math.sin(seed) * 5;
                const y = a.y + (b.y - a.y) * t + Math.cos(seed * 2) * 5;
                // Mostly submerged mottling; only occasional exposed clusters.
                const exposed = seed % 7 === 0;
                const radius = exposed ? 7 + (seed % 5) : 4 + (seed % 6);
                rocks.fillStyle(
                    exposed ? 0x4d6964 : 0x427f77,
                    exposed ? 0.72 : 0.24,
                );
                const shape = Array.from({ length: 6 }, (_, k) => {
                    const angle = (k * Math.PI) / 3;
                    const r = radius * (0.75 + ((seed + k * 3) % 5) * 0.09);
                    return {
                        x: x + Math.cos(angle) * r * 1.4,
                        y: y + Math.sin(angle) * r,
                    };
                });
                rocks.fillPoints(
                    shape.map((p) => new PhaserMath.Vector2(p.x, p.y)),
                    true,
                );
                if (exposed) {
                    rocks.fillStyle(0xa7b2a0, 0.65);
                    rocks.fillEllipse(
                        x - 2,
                        y - 3,
                        radius * 1.6,
                        radius * 0.65,
                    );
                }
                if (seed % 3 === 0) {
                    const dx = (b.x - a.x) / length,
                        dy = (b.y - a.y) / length;
                    surf.lineStyle(1.8, 0xdaeee0, 0.5);
                    surf.beginPath();
                    surf.moveTo(x - dx * 9, y - dy * 9 - 5);
                    surf.lineTo(x + dx * 8, y + dy * 8 - 5);
                    surf.strokePath();
                }
            }
        }
    }
}
