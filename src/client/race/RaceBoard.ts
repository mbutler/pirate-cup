import { defaultTrack, hullDamageLook } from '../../core';
import type { ShipState, DisplacedCrew } from '../../core/entities/types';
import type { MoveDirection, TrackNodeId } from '../../core/track/types';
import { ASSETS, SHIP_FRAME } from '../config';
import { formatShipSummary } from '../ui/formatters';
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
    private activeRingShipId: string | null = null;
    private ships: Record<string, ShipState> = {};
    private hoveredShipId: string | null = null;
    private shipTip?: Phaser.GameObjects.Text;

    private readonly hideShipTip = () => {
        this.hoveredShipId = null;
        this.shipTip?.setVisible(false);
    };

    private readonly inspectPointer = (pointer: Phaser.Input.Pointer) => {
        const point = this.scene.cameras.main.getWorldPoint(
            pointer.x,
            pointer.y,
        );
        let nearestId: string | null = null;
        let nearest = 40 * 40;
        for (const [id, sprite] of this.shipSprites) {
            const dx = sprite.x - point.x;
            const dy = sprite.y - point.y;
            const squared = dx * dx + dy * dy;
            if (squared < nearest) {
                nearest = squared;
                nearestId = id;
            }
        }
        if (!nearestId) {
            this.hideShipTip();
            return;
        }
        this.hoveredShipId = nearestId;
        this.refreshShipTip();
    };

    private refreshShipTip() {
        const ship = this.hoveredShipId
            ? this.ships[this.hoveredShipId]
            : undefined;
        const sprite = this.hoveredShipId
            ? this.shipSprites.get(this.hoveredShipId)
            : undefined;
        if (!ship || !sprite) {
            this.hideShipTip();
            return;
        }
        if (!this.shipTip) {
            this.shipTip = this.scene.add
                .text(0, 0, '', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '18px',
                    color: '#fff3ca',
                    backgroundColor: '#102c32',
                    padding: { x: 10, y: 6 },
                    wordWrap: { width: 420 },
                })
                .setDepth(110)
                .setVisible(false);
        }
        this.shipTip
            .setText(`${ship.color.toUpperCase()}\n${formatShipSummary(ship)}`)
            .setPosition(
                Math.min(1820, Math.max(20, sprite.x + 28)),
                Math.max(190, sprite.y - this.shipTip.height - 18),
            )
            .setVisible(true);
    }

    private quick = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches;

    constructor(
        private readonly scene: Phaser.Scene,
        onMove: (index: number) => void,
    ) {
        this.movePreview = new MovePreview(scene, onMove);
        scene.input.on('pointermove', this.inspectPointer);
        scene.input.on('pointerdown', this.inspectPointer);
        scene.input.on('gameout', this.hideShipTip);
    }

    hoveringShip(): boolean {
        return this.hoveredShipId !== null;
    }

    togglePace() {
        this.quick = !this.quick;
    }

    destroy() {
        this.scene.input.off('pointermove', this.inspectPointer);
        this.scene.input.off('pointerdown', this.inspectPointer);
        this.scene.input.off('gameout', this.hideShipTip);
        this.clearMovePreview();
        this.hideActiveRing();
        this.hideShipTip();
        this.shipTip?.destroy();
        this.shipTip = undefined;
    }

    /**
     * `relocate` snaps sprites onto current hexes. Leave it false while move
     * tweens are playing — game state is already at the destination.
     */
    syncShips(
        ships: Record<string, ShipState>,
        activePlayerId: string | null,
        relocate = true,
    ) {
        this.ships = ships;
        for (const ship of Object.values(ships)) {
            let sprite = this.shipSprites.get(ship.id);

            if (!sprite) {
                sprite = this.createShipSprite(ship);
                this.shipSprites.set(ship.id, sprite);
            }

            const textureKey = ASSETS.ships.textureKeyForColor(ship.color);
            if (sprite.texture.key !== textureKey) {
                sprite.setTexture(textureKey);
            }
            if (relocate) {
                this.scene.tweens.killTweensOf(sprite);
                this.placeShipSprite(sprite, ship.positionId);
            }

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
            if (relocate) {
                this.scene.tweens.killTweensOf(label);
                label.setPosition(
                    sprite.x,
                    sprite.y - (ship.id === activePlayerId ? 62 : 48),
                );
            }
            label.setVisible(ship.id === activePlayerId);

            const look = hullDamageLook(ship);
            if (look === 'wreck') {
                sprite.setFrame(SHIP_FRAME.wreck);
                if (relocate) sprite.setAlpha(0.6);
            } else if (look === 'heavy') {
                sprite.setFrame(SHIP_FRAME.damageHeavy);
                if (relocate) sprite.setAlpha(1);
            } else if (look === 'light') {
                sprite.setFrame(SHIP_FRAME.damageLight);
                if (relocate) sprite.setAlpha(1);
            } else if (ship.id === activePlayerId) {
                sprite.setFrame(SHIP_FRAME.active);
                if (relocate) sprite.setAlpha(1);
            } else {
                sprite.setFrame(SHIP_FRAME.normal);
                if (relocate) sprite.setAlpha(1);
            }

            if (relocate && ship.id === activePlayerId && look !== 'wreck') {
                this.showActiveRing(sprite.x, sprite.y, ship.id);
            }
        }

        if (!activePlayerId) {
            this.hideActiveRing();
        }
        if (this.hoveredShipId) this.refreshShipTip();
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
        if (this.activeRing && this.activeRingShipId === shipId) {
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

    /** Connect the acting vessel to its target while its result is explained. */
    highlightExchange(attackerId: string, targetId: string): () => void {
        const attacker = this.shipSprites.get(attackerId);
        const target = this.shipSprites.get(targetId);
        if (!attacker || !target) return () => {};
        const ink = this.scene.add.graphics().setDepth(30);
        ink.lineStyle(3, 0xe4be77, 0.95);
        ink.strokeCircle(attacker.x, attacker.y, 34);
        ink.lineBetween(attacker.x, attacker.y, target.x, target.y);
        ink.lineStyle(4, 0xff8f74, 1);
        ink.strokeCircle(target.x, target.y, 37);
        const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
        const tipX = target.x - Math.cos(angle) * 38;
        const tipY = target.y - Math.sin(angle) * 38;
        ink.fillStyle(0xff8f74, 1);
        ink.fillTriangle(
            tipX,
            tipY,
            tipX - Math.cos(angle - 0.5) * 18,
            tipY - Math.sin(angle - 0.5) * 18,
            tipX - Math.cos(angle + 0.5) * 18,
            tipY - Math.sin(angle + 0.5) * 18,
        );
        return () => ink.destroy();
    }

    async showDamage(
        shipId: string,
        message: string,
        below = false,
    ): Promise<void> {
        const sprite = this.shipSprites.get(shipId);
        if (!sprite) return;
        const label = this.scene.add
            .text(
                Math.max(100, Math.min(1820, sprite.x)),
                Math.min(840, Math.max(240, sprite.y + (below ? 55 : -55))),
                message,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '19px',
                    fontStyle: 'bold',
                    color: '#ffd4bc',
                    backgroundColor: '#34262a',
                    padding: { x: 8, y: 5 },
                    align: 'center',
                },
            )
            .setOrigin(0.5)
            .setDepth(510);
        await new Promise<void>((resolve) => {
            this.scene.time.delayedCall(this.quick ? 650 : 1100, () => {
                label.destroy();
                resolve();
            });
        });
    }

    async showCardToast(
        shipId: string,
        kind: string,
        message: string,
        accent = '#f2ca02',
        major = false,
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

        const height = Math.max(88, messageText.height + 54);
        bg.setSize(300, height);
        kindText.setY(-height / 2 + 18);
        messageText.setY(10);
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
            this.scene.time.delayedCall(
                major ? (this.quick ? 1100 : 1800) : this.quick ? 500 : 900,
                () => resolve(),
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

    private showActiveRing(x: number, y: number, shipId: string) {
        this.hideActiveRing();

        this.activeRingShipId = shipId;
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
        this.activeRingShipId = null;
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
