import { defaultTrack } from '../../core';
import type { ShipState } from '../../core/entities/types';
import type { MoveDirection, TrackNodeId } from '../../core/track/types';
import { ASSETS, SHIP_FRAME } from '../config';
import { TRACK_LAYOUT, trackNodeToWorld } from '../track/TrackLayout';
import { MovePreview, type MovePreviewOption } from './MovePreview';

export class RaceBoard {
    private readonly shipSprites = new Map<string, Phaser.GameObjects.Sprite>();
    private readonly shipLabels = new Map<string, Phaser.GameObjects.Text>();
    private readonly movePreview: MovePreview;
    private activeRing?: Phaser.GameObjects.Arc;
    private activeRingTween?: Phaser.Tweens.Tween;

    constructor(private readonly scene: Phaser.Scene) {
        this.movePreview = new MovePreview(scene);
    }

    syncShips(
        ships: Record<string, ShipState>,
        activePlayerId: string | null,
    ) {
        for (const ship of Object.values(ships)) {
            let sprite = this.shipSprites.get(ship.id);

            if (!sprite) {
                sprite = this.createShipSprite(ship);
                this.shipSprites.set(ship.id, sprite);
            }

            this.placeShipSprite(sprite, ship.positionId);

            let label = this.shipLabels.get(ship.id);

            if (!label) {
                label = this.scene.add.text(0, 0, '', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '14px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5).setDepth(11);
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

    async tweenShipTo(shipId: string, toPositionId: TrackNodeId): Promise<void> {
        const sprite = this.shipSprites.get(shipId);

        if (!sprite) {
            return;
        }

        const node = defaultTrack.getNode(toPositionId);
        const world = trackNodeToWorld(node);

        sprite.setData('positionId', toPositionId);

        const label = this.shipLabels.get(shipId);
        if (label) {
            this.scene.tweens.add({
                targets: label,
                x: world.x,
                y: world.y - 48,
                duration: 320,
                ease: 'Sine.easeInOut',
            });
        }

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: sprite,
                x: world.x,
                y: world.y,
                angle: world.angle,
                duration: 320,
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
        const x = sprite?.x ?? this.scene.scale.width / 2;
        const y = (sprite?.y ?? this.scene.scale.height / 2) - 96;

        const container = this.scene.add.container(x, y).setDepth(500);

        const bg = this.scene.add
            .rectangle(0, 0, 300, 78, 0x000000, 0.88)
            .setStrokeStyle(2, accent);
        const kindText = this.scene.add.text(0, -18, kind.toUpperCase(), {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: accent,
        }).setOrigin(0.5);
        const messageText = this.scene.add.text(0, 10, message, {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 270 },
        }).setOrigin(0.5);

        container.add([bg, kindText, messageText]);
        container.setAlpha(0);
        container.setScale(0.88);

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                scale: 1,
                duration: 180,
                ease: 'Back.easeOut',
                onComplete: () => resolve(),
            });
        });

        await new Promise<void>((resolve) => {
            this.scene.time.delayedCall(650, () => resolve());
        });

        await new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                y: y - 18,
                duration: 220,
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

        this.activeRing = this.scene.add.circle(x, y, 34, 0xf2ca02, 0).setDepth(9);
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

    private placeShipSprite(sprite: Phaser.GameObjects.Sprite, positionId: TrackNodeId) {
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

export function directionForMove(fromPositionId: TrackNodeId, toPositionId: TrackNodeId): MoveDirection {
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
    }
}

export function applyPlannedMove(positionId: TrackNodeId, direction: MoveDirection): TrackNodeId {
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
