import { Scene } from 'phaser';
import { ASSETS, ISLAND_TILESETS } from '../config';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.scene.start('Preloader');
    }
}

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.load.tilemapTiledJSON(ASSETS.map.tilemapKey, ASSETS.map.tilemapPath);
        this.load.image(ASSETS.map.oceanImageKey, ASSETS.map.oceanImagePath);
        this.load.image(ASSETS.map.trackOverlayKey, ASSETS.map.trackOverlayPath);

        for (const tilesetName of ISLAND_TILESETS) {
            this.load.image(tilesetName, ASSETS.map.islandImagePath(tilesetName));
        }

        for (const ship of ASSETS.ships.roster) {
            this.load.spritesheet(ship.textureKey, ship.path, {
                frameWidth: ASSETS.ships.frameWidth,
                frameHeight: ASSETS.ships.frameHeight,
            });
        }

        ASSETS.props.dinghyLarge.forEach((path, index) => {
            this.load.image(`dinghyLarge${index}`, path);
        });

        ASSETS.props.dinghySmall.forEach((path, index) => {
            this.load.image(`dinghySmall${index}`, path);
        });

        Object.values(ASSETS.audio).forEach((key) => {
            this.load.audio(key, `assets/audio/${key}.wav`);
        });
    }

    create() {
        this.scene.start('MainMenu');
    }
}
