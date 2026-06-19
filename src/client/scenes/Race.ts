import { Scene, Scenes } from 'phaser';
import type { GameSession } from '../GameSession';
import { ASSETS, DISPLAY } from '../config';
import { TRACK_LAYOUT } from '../track/TrackLayout';
import { RaceController } from '../race/RaceController';

export class Race extends Scene {
    private controller?: RaceController;

    constructor() {
        super('Race');
    }

    create() {
        const session = this.registry.get('session') as GameSession;

        this.cameras.main.setBackgroundColor(DISPLAY.backgroundColor);
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

        if (islandSets.length > 0) {
            map.createLayer('Islands', islandSets, 0, 0)?.setDepth(1);
        }

        this.add
            .image(0, TRACK_LAYOUT.overlayY, ASSETS.map.trackOverlayKey)
            .setOrigin(0, 0)
            .setAlpha(0.15)
            .setDepth(2);
    }
}
