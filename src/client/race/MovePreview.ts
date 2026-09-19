import { Math as PhaserMath } from 'phaser';
import type { MoveDirection, TrackNodeId } from '../../core/track/types';
import { defaultTrack } from '../../core';
import { trackNodeToWorld } from '../track/TrackLayout';

export interface MovePreviewOption {
    nodeId: TrackNodeId;
    direction: MoveDirection;
    label: string;
    /** Another ship occupies this hex — a ram, not a wall. */
    hasShip: boolean;
}

interface LabelSlot {
    x: number;
    y: number;
}

const COLORS = {
    selected: 0x4ade80,
    option: 0x60a5fa,
    ram: 0xfbbf24,
    arrow: 0xffffff,
    leader: 0xffffff,
};

const LABEL_RADIUS = 76;
const MIN_ANGLE_GAP = 0.42;

function shortDirectionLabel(direction: MoveDirection): string {
    switch (direction) {
        case 'laneIn':
            return 'PORT';
        case 'forward':
            return 'AHEAD';
        case 'laneOut':
            return 'STBD';
        default:
            return direction;
    }
}

function spreadAngles(angles: number[]): number[] {
    if (angles.length <= 1) {
        return [...angles];
    }

    const order = angles.map((angle, index) => ({ angle, index }));
    order.sort((a, b) => a.angle - b.angle);
    const spread = order.map((entry) => entry.angle);

    for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < spread.length - 1; i++) {
            const gap = spread[i + 1] - spread[i];

            if (gap < MIN_ANGLE_GAP) {
                const push = (MIN_ANGLE_GAP - gap) / 2;
                spread[i] -= push;
                spread[i + 1] += push;
            }
        }
    }

    const restored = new Array<number>(angles.length);

    order.forEach((entry, sortedIndex) => {
        restored[entry.index] = spread[sortedIndex];
    });

    return restored;
}

function slotFromAngle(
    from: { x: number; y: number },
    angle: number,
): LabelSlot {
    return {
        x: from.x + Math.cos(angle) * LABEL_RADIUS,
        y: from.y + Math.sin(angle) * LABEL_RADIUS,
    };
}

export class MovePreview {
    private layer?: Phaser.GameObjects.Container;
    private pulseTween?: Phaser.Tweens.Tween;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly onMove: (index: number) => void,
    ) {}

    show(
        fromId: TrackNodeId,
        options: MovePreviewOption[],
        selectedIndex: number,
    ) {
        this.clear();

        this.layer = this.scene.add.container(0, 0).setDepth(12);

        const layer = this.layer;
        const from = trackNodeToWorld(defaultTrack.getNode(fromId));
        const angles = options.map((option) => {
            const to = trackNodeToWorld(defaultTrack.getNode(option.nodeId));
            return PhaserMath.Angle.Between(from.x, from.y, to.x, to.y);
        });
        const slots = spreadAngles(angles).map((angle) => {
            const slot = slotFromAngle(from, angle);
            return {
                x: Math.max(65, Math.min(1855, slot.x)),
                y: Math.max(245, Math.min(845, slot.y)),
            };
        });

        options.forEach((option, index) => {
            const to = trackNodeToWorld(defaultTrack.getNode(option.nodeId));
            const selected = index === selectedIndex;
            const color = option.hasShip
                ? selected
                    ? COLORS.ram
                    : 0xd97706
                : selected
                  ? COLORS.selected
                  : COLORS.option;
            const ringRadius = selected ? 26 : 18;
            const moveAngle = angles[index];
            const slot = slots[index];

            const ring = this.scene.add.circle(
                to.x,
                to.y,
                ringRadius,
                color,
                selected ? 0.28 : 0.1,
            );
            ring.setStrokeStyle(selected ? 4 : 2, color, selected ? 1 : 0.65);
            ring.setInteractive({ useHandCursor: true });
            ring.on('pointerdown', () => this.onMove(index));
            layer.add(ring);

            const ringEdgeX = to.x - Math.cos(moveAngle) * ringRadius;
            const ringEdgeY = to.y - Math.sin(moveAngle) * ringRadius;

            const leader = this.scene.add.graphics();
            leader.lineStyle(
                selected ? 2 : 1,
                COLORS.leader,
                selected ? 0.55 : 0.28,
            );
            leader.beginPath();
            leader.moveTo(slot.x, slot.y);
            leader.lineTo(ringEdgeX, ringEdgeY);
            leader.strokePath();
            layer.add(leader);

            if (selected) {
                this.pulseTween = this.scene.tweens.add({
                    targets: ring,
                    scale: { from: 1, to: 1.15 },
                    alpha: { from: 1, to: 0.75 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1,
                });

                const arrow = this.scene.add.graphics();
                arrow.lineStyle(3, COLORS.arrow, 0.8);
                arrow.beginPath();
                arrow.moveTo(from.x, from.y);
                arrow.lineTo(ringEdgeX, ringEdgeY);
                arrow.strokePath();
                layer.add(arrow);
            }

            const text = selected
                ? `${shortDirectionLabel(option.direction)}${option.hasShip ? ' · RAM' : ''}`
                : shortDirectionLabel(option.direction);

            if (selected) {
                const pad = this.scene.add.rectangle(
                    slot.x,
                    slot.y,
                    text.length * 8.5 + 18,
                    24,
                    0x000000,
                    0.75,
                );
                pad.setStrokeStyle(1, color, 0.95);
                layer.add(pad);
            }

            const label = this.scene.add
                .text(slot.x, slot.y, text, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: selected ? '15px' : '13px',
                    fontStyle: selected ? 'bold' : 'normal',
                    color: option.hasShip
                        ? selected
                            ? '#fde68a'
                            : '#fbbf24'
                        : selected
                          ? '#bbf7d0'
                          : '#cbd5e1',
                    stroke: '#000000',
                    strokeThickness: selected ? 3 : 2,
                    align: 'center',
                })
                .setOrigin(0.5)
                .setAlpha(selected ? 1 : 0.78);
            layer.add(label);
        });
    }

    clear() {
        this.pulseTween?.stop();
        this.pulseTween = undefined;
        this.layer?.destroy(true);
        this.layer = undefined;
    }
}
