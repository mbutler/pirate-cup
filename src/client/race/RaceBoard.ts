import { defaultTrack } from '../../core';
import type { ShipState, DisplacedCrew } from '../../core/entities/types';
import type { MoveDirection, TrackNodeId } from '../../core/track/types';
import { ASSETS, SHIP_FRAME } from '../config';
import {
    TRACK_LAYOUT,
    trackNodeToWorld,
    shortestAngleDelta,
} from '../track/TrackLayout';
import { MovePreview, type MovePreviewOption } from './MovePreview';

export class RaceBoard {
    private readonly dinghies = new Map<string, Phaser.GameObjects.Image>();
    private readonly crewMarkers = new Map<string, Phaser.GameObjects.Text>();
    private readonly shipSprites = new Map<string, Phaser.GameObjects.Sprite>();
    private readonly shipLabels = new Map<string, Phaser.GameObjects.Text>();
    private readonly movePreview: MovePreview;
    private activeRing?: Phaser.GameObjects.Arc;
    private activeRingTween?: Phaser.Tweens.Tween;

    private quick = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches;

    constructor(
        private readonly scene: Phaser.Scene,
        onMove: (index: number) => void,
    ) {
        this.movePreview = new MovePreview(scene, onMove);
    }

    togglePace() {
        this.quick = !this.quick;
    }

    destroy() {
        this.clearMovePreview();
        this.hideActiveRing();
    }

    syncShips(ships: Record<string, ShipState>, activePlayerId: string | null) {
        for (const ship of Object.values(ships)) {
            let sprite = this.shipSprites.get(ship.id);

            if (!sprite) {
                sprite = this.createShipSprite(ship);
                this.shipSprites.set(ship.id, sprite);
            }

            sprite.setTexture(ASSETS.ships.textureKeyForColor(ship.color));
            this.placeShipSprite(sprite, ship.positionId);

            let label = this.shipLabels.get(ship.id);

            if (!label) {
                label = this.scene.add
                    .text(0, 0, '', {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        color: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 3,
                    })
                    .setOrigin(0.5)
                    .setDepth(11);
                this.shipLabels.set(ship.id, label);
            }

            label.setText(ship.color.toUpperCase());
            label.setPosition(
                sprite.x,
                sprite.y - (ship.id === activePlayerId ? 62 : 48),
            );
            label.setVisible(ship.id === activePlayerId);

            if (ship.destroyed) {
                sprite.setFrame(SHIP_FRAME.wreck);
                sprite.setAlpha(0.6);
            } else if (ship.id === activePlayerId) {
                sprite.setFrame(SHIP_FRAME.active);
                sprite.setAlpha(1);
                this.showActiveRing(sprite.x, sprite.y);
            } else {
                sprite.setFrame(SHIP_FRAME.normal);
                sprite.setAlpha(1);
            }
        }

        if (!activePlayerId) {
            this.hideActiveRing();
        }
    }

    syncCrews(crews: Record<string, DisplacedCrew>, activeId: string | null) {
        for (const [id, marker] of this.crewMarkers) {
            if (!crews[id]) {
                marker.destroy();
                this.crewMarkers.delete(id);
                this.dinghies.get(id)?.destroy();
                this.dinghies.delete(id);
            }
        }
        Object.values(crews).forEach((crew, index) => {
            let marker = this.crewMarkers.get(crew.id);
            if (!marker) {
                marker = this.scene.add
                    .text(0, 0, '', {
                        fontFamily: 'Arial',
                        fontSize: '16px',
                        color: '#fff3ca',
                        backgroundColor: '#173e50',
                        padding: { x: 6, y: 4 },
                        stroke: '#091d29',
                        strokeThickness: 2,
                    })
                    .setOrigin(0.5)
                    .setDepth(20);
                this.crewMarkers.set(crew.id, marker);
                this.dinghies.set(
                    crew.id,
                    this.scene.add.image(0, 0, 'dinghySmall1').setDepth(19),
                );
            }
            const world = trackNodeToWorld(
                defaultTrack.getNode(crew.positionId),
            );
            const offset = Object.values(crews)
                .slice(0, index)
                .filter((other) => other.positionId === crew.positionId).length;
            this.dinghies
                .get(crew.id)!
                .setPosition(world.x + 25, world.y + 12 + offset * 26);
            marker.setPosition(world.x, world.y + 38 + offset * 26);
            marker.setText(
                `${crew.id === activeId ? '▶ ' : ''}${crew.color.toUpperCase()} CREW ${crew.captainHp + crew.boarderHp}`,
            );
        });
    }

    showMovePreview(
        fromId: TrackNodeId,
        options: MovePreviewOption[],
        selectedIndex: number,
    ) {
        this.movePreview.show(fromId, options, selectedIndex);
    }

    clearMovePreview() {
        this.movePreview.clear();
    }

    async tweenShipTo(
        shipId: string,
        toPositionId: TrackNodeId,
    ): Promise<void> {
        const sprite = this.shipSprites.get(shipId);

        if (!sprite) {
            return;
        }

        const node = defaultTrack.getNode(toPositionId);
        const world = trackNodeToWorld(node);

        sprite.setData('positionId', toPositionId);
        if (
            this.activeRing &&
            Number(sprite.frame.name) === SHIP_FRAME.active
        ) {
            this.scene.tweens.add({
                targets: this.activeRing,
                x: world.x,
                y: world.y,
                duration: this.quick ? 120 : 280,
            });
        }

        const label = this.shipLabels.get(shipId);
        if (label) {
            this.scene.tweens.add({
                targets: label,
                x: world.x,
                y: world.y - 48,
                duration: this.quick ? 120 : 280,
                ease: 'Sine.easeInOut',
            });
        }

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: sprite,
                x: world.x,
                y: world.y,
                rotation:
                    sprite.rotation +
                    (shortestAngleDelta(sprite.angle, world.angle) * Math.PI) /
                        180,
                duration: this.quick ? 120 : 280,
                ease: 'Sine.easeInOut',
                onComplete: () => resolve(),
            });
        });
    }

    flashDamage(shipId: string) {
        const sprite = this.shipSprites.get(shipId);

        if (!sprite) {
            return;
        }

        this.scene.tweens.add({
            targets: sprite,
            alpha: 0.35,
            yoyo: true,
            duration: 120,
            repeat: 2,
        });
    }

    async showCardToast(
        shipId: string,
        kind: string,
        message: string,
        accent = '#f2ca02',
    ): Promise<void> {
        const sprite = this.shipSprites.get(shipId);
        const x = Math.max(165, Math.min(1755, sprite?.x ?? 960));
        const y = Math.max(290, (sprite?.y ?? 540) - 96);

        const container = this.scene.add.container(x, y).setDepth(500);

        const bg = this.scene.add
            .rectangle(0, 0, 300, 88, 0x102c32, 0.97)
            .setStrokeStyle(1, Number.parseInt(accent.replace('#', ''), 16));
        const kindText = this.scene.add
            .text(0, -18, kind.toUpperCase(), {
                fontFamily: 'Arial, sans-serif',
                fontSize: '13px',
                color: accent,
            })
            .setOrigin(0.5);
        const messageText = this.scene.add
            .text(0, 10, message, {
                fontFamily: 'Georgia, serif',
                fontSize: '20px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: 270 },
            })
            .setOrigin(0.5);

        container.add([bg, kindText, messageText]);
        container.setAlpha(0);
        container.setScale(0.88);

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                scale: 1,
                duration: this.quick ? 60 : 160,
                ease: 'Back.easeOut',
                onComplete: () => resolve(),
            });
        });

        await new Promise<void>((resolve) => {
            this.scene.time.delayedCall(this.quick ? 220 : 550, () =>
                resolve(),
            );
        });

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                y: y - 18,
                duration: this.quick ? 80 : 180,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    container.destroy(true);
                    resolve();
                },
            });
        });
    }

    private showActiveRing(x: number, y: number) {
        this.hideActiveRing();

        this.activeRing = this.scene.add
            .circle(x, y, 34, 0xf2ca02, 0)
            .setDepth(9);
        this.activeRing.setStrokeStyle(2, 0xf2ca02, 0.9);

        this.activeRingTween = this.scene.tweens.add({
            targets: this.activeRing,
            scale: { from: 0.9, to: 1.12 },
            alpha: { from: 0.5, to: 1 },
            duration: 700,
            yoyo: true,
            repeat: -1,
        });
    }

    private hideActiveRing() {
        this.activeRingTween?.stop();
        this.activeRingTween = undefined;
        this.activeRing?.destroy();
        this.activeRing = undefined;
    }

    private createShipSprite(ship: ShipState) {
        const node = defaultTrack.getNode(ship.positionId);
        const world = trackNodeToWorld(node);
        const sprite = this.scene.add.sprite(
            world.x,
            world.y,
            ASSETS.ships.textureKeyForColor(ship.color),
            SHIP_FRAME.normal,
        );

        sprite.setOrigin(TRACK_LAYOUT.shipOriginX, TRACK_LAYOUT.shipOriginY);
        sprite.setAngle(world.angle);
        sprite.setDepth(10);
        sprite.setData('shipId', ship.id);
        sprite.setData('positionId', ship.positionId);

        return sprite;
    }

    private placeShipSprite(
        sprite: Phaser.GameObjects.Sprite,
        positionId: TrackNodeId,
    ) {
        const node = defaultTrack.getNode(positionId);
        const world = trackNodeToWorld(node);
        sprite.setData('positionId', positionId);
        sprite.setPosition(world.x, world.y);
        sprite.setAngle(world.angle);
    }
}

export function getMoveOptions(fromPositionId: TrackNodeId): TrackNodeId[] {
    return defaultTrack.playerMoves(fromPositionId);
}

export function directionForMove(
    fromPositionId: TrackNodeId,
    toPositionId: TrackNodeId,
): MoveDirection {
    const node = defaultTrack.getNode(fromPositionId);

    if (node.neighbors.laneIn === toPositionId) return 'laneIn';
    if (node.neighbors.forward === toPositionId) return 'forward';
    return 'laneOut';
}

export function directionLabel(direction: MoveDirection): string {
    switch (direction) {
        case 'laneIn':
            return 'PORT (in)';
        case 'forward':
            return 'AHEAD';
        case 'laneOut':
            return 'STARBOARD (out)';
        default:
            return direction;
    }
}

export function applyPlannedMove(
    positionId: TrackNodeId,
    direction: MoveDirection,
): TrackNodeId {
    const neighbor = defaultTrack.neighbor(positionId, direction);

    if (defaultTrack.isWall(neighbor)) {
        return positionId;
    }

    return neighbor;
}

export function getOccupiedPositions(
    ships: Record<string, ShipState>,
    excludeId?: string,
): Set<string> {
    const occupied = new Set<string>();

    for (const ship of Object.values(ships)) {
        if (!ship.destroyed && ship.id !== excludeId) {
            occupied.add(ship.positionId);
        }
    }

    return occupied;
}

export function buildMovePreviewOptions(
    fromPositionId: TrackNodeId,
    occupied: Set<string>,
): MovePreviewOption[] {
    return getMoveOptions(fromPositionId).map((nodeId) => {
        const direction = directionForMove(fromPositionId, nodeId);
        return {
            nodeId,
            direction,
            label: directionLabel(direction),
            hasShip: occupied.has(nodeId),
        };
    });
}
