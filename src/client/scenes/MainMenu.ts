import { Scene } from 'phaser';
import { createLocalSession } from '../GameSession';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, height / 2 - 40, 'Pirate Cup', {
            fontFamily: 'Georgia, serif',
            fontSize: '72px',
            color: '#f2ca02',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 40, 'Press ENTER to start a local race', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 100, 'Hot-seat for up to 6 captains — pass the keyboard each turn', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#b8c4cc',
        }).setOrigin(0.5);

        this.input.keyboard?.once('keydown-ENTER', () => {
            this.registry.set('session', createLocalSession(`race-${Date.now()}`, 6));
            this.scene.start('Race');
        });
    }
}
