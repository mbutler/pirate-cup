import { Scene, Scenes } from 'phaser';
import type { GameSession } from '../GameSession';
import { ASSETS, DISPLAY } from '../config';
import { TRACK_LAYOUT } from '../track/TrackLayout';
import { FINISH_LINE } from '../../core/rules/race';
import { defaultTrack } from '../../core/track/TrackGraph';
import { RaceController } from '../race/RaceController';

export class Race extends Scene {
    private controller?: RaceController;

    constructor() {
        super('Race');
    }

    create() {
        const session = this.registry.get('session') as GameSession;

        this.cameras.main.setBackgroundColor(DISPLAY.backgroundColor);
        this.cameras.main.setScroll(0, 180);
        this.drawTrack();

        this.controller = new RaceController(this, session);
        this.controller.start();

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.controller?.destroy();
        });
    }

    private drawTrack() {
        const map = this.add.tilemap(ASSETS.map.tilemapKey);

        if (!map) {
            this.add.text(40, 40, 'Race course tilemap failed to load.', {
                fontSize: '24px',
                color: '#ffcc00',
            });
            return;
        }

        for (const tileset of map.tilesets) {
            if (tileset.name === ASSETS.map.oceanTilesetName) {
                map.addTilesetImage(tileset.name, ASSETS.map.oceanImageKey);
            } else {
                map.addTilesetImage(tileset.name, tileset.name);
            }
        }

        const waterSet = map.getTileset(ASSETS.map.oceanTilesetName);
        const islandSets = map.tilesets.filter(
            (tileset) => tileset.name !== ASSETS.map.oceanTilesetName,
        );

        if (waterSet) {
            map.createLayer('Water', waterSet, 0, 0)?.setDepth(0);
        }

        this.add.rectangle(960, 540, 1920, 1080, 0x102c32, 0.25).setDepth(0.5);

        if (islandSets.length > 0) {
            map.createLayer('Islands', islandSets, 0, 0)?.setDepth(1);
        }

        this.add
            .image(0, TRACK_LAYOUT.overlayY, ASSETS.map.trackOverlayKey)
            .setOrigin(0, 0)
            .setAlpha(0.3)
            .setDepth(2);

        const finish = this.add.graphics().setDepth(4);
        for (let y = FINISH_LINE.top; y < FINISH_LINE.bottom; y += 12) {
            for (let col = 0; col < 2; col++) {
                finish.fillStyle(
                    (Math.floor((y - FINISH_LINE.top) / 12) + col) % 2
                        ? 0x17383d
                        : 0xeee8d4,
                    0.75,
                );
                finish.fillRect(FINISH_LINE.x - 12 + col * 12, y, 12, 12);
            }
        }
        this.add
            .text(FINISH_LINE.x, FINISH_LINE.top - 20, 'START / FINISH', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                color: '#eee8d4',
            })
            .setOrigin(0.5)
            .setDepth(4);

        // Put safe speeds on the water, where the decision actually happens.
        for (const node of defaultTrack.nodes.values()) {
            if (node.safeSpeed === undefined) continue;
            this.add
                .text(node.x, node.y, String(node.safeSpeed), {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '17px',
                    color: '#e6e2bb',
                })
                .setOrigin(0.5)
                .setAlpha(0.6)
                .setDepth(3);
        }
        this.add
            .text(510, 552, 'THE WESTERN ISLE', {
                fontFamily: 'Georgia, serif',
                fontSize: '17px',
                color: '#847651',
                letterSpacing: 3,
            })
            .setOrigin(0.5)
            .setDepth(3);
        this.add
            .text(1480, 552, 'THE EASTERN ISLE', {
                fontFamily: 'Georgia, serif',
                fontSize: '17px',
                color: '#847651',
                letterSpacing: 3,
            })
            .setOrigin(0.5)
            .setDepth(3);
    }
}
