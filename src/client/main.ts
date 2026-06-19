import { AUTO, Game, Scale } from 'phaser';
import { Boot, Preloader } from './scenes/Boot';
import { MainMenu } from './scenes/MainMenu';
import { Race } from './scenes/Race';
import { DISPLAY } from './config';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: DISPLAY.width,
    height: DISPLAY.height,
    parent: 'game-container',
    backgroundColor: DISPLAY.backgroundColor,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Boot, Preloader, MainMenu, Race],
};

export default function startGame(parent: string) {
    return new Game({ ...config, parent });
}
