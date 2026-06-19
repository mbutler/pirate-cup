import type { ShipState } from '../../core/entities/types';
import type { TurnPhase } from '../../core/state/GameState';
import { formatPhase, formatPlayerLabel, formatShipSummary } from './formatters';

const PANEL = {
    bg: 0x000000,
    bgAlpha: 0.72,
    accent: '#f2ca02',
    text: '#ffffff',
    muted: '#b8c4cc',
    hint: '#8ecae6',
};

const BOTTOM_MARGIN = 16;
const STACK_GAP = 10;

export interface HudSnapshot {
    turn: number;
    phase: TurnPhase;
    activePlayerId: string | null;
    activeShip: ShipState | null;
    headline: string;
    detail: string;
    controls: string;
    log: string;
}

export class GameHud {
    private readonly root: Phaser.GameObjects.Container;
    private readonly topBar: Phaser.GameObjects.Rectangle;
    private readonly bottomBar: Phaser.GameObjects.Rectangle;
    private readonly statusText: Phaser.GameObjects.Text;
    private readonly shipText: Phaser.GameObjects.Text;
    private readonly headlineText: Phaser.GameObjects.Text;
    private readonly detailText: Phaser.GameObjects.Text;
    private readonly controlsText: Phaser.GameObjects.Text;
    private readonly logText: Phaser.GameObjects.Text;

    constructor(private readonly scene: Phaser.Scene) {
        const width = scene.scale.width;
        const height = scene.scale.height;

        this.topBar = scene.add.rectangle(width / 2, 0, width, 88, PANEL.bg, PANEL.bgAlpha).setOrigin(0.5, 0);
        this.bottomBar = scene.add
            .rectangle(width / 2, height, width, 220, PANEL.bg, PANEL.bgAlpha)
            .setOrigin(0.5, 1);

        this.statusText = scene.add.text(24, 16, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: PANEL.text,
        });

        this.shipText = scene.add.text(width - 24, 16, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: PANEL.muted,
            align: 'right',
            wordWrap: { width: width * 0.55 },
        }).setOrigin(1, 0);

        this.headlineText = scene.add.text(width / 2, 0, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '30px',
            color: PANEL.accent,
            align: 'center',
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 1);

        this.detailText = scene.add.text(width / 2, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '17px',
            color: PANEL.text,
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: width - 100 },
        }).setOrigin(0.5, 1);

        this.controlsText = scene.add.text(width / 2, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '17px',
            color: PANEL.hint,
            align: 'center',
            wordWrap: { width: width - 80 },
        }).setOrigin(0.5, 1);

        this.logText = scene.add.text(24, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: PANEL.muted,
            wordWrap: { width: width - 48 },
        }).setOrigin(0, 1);

        this.root = scene.add.container(0, 0, [
            this.topBar,
            this.bottomBar,
            this.statusText,
            this.shipText,
            this.headlineText,
            this.detailText,
            this.controlsText,
            this.logText,
        ]);

        this.root.setDepth(200);
        this.root.setScrollFactor(0);
    }

    render(snapshot: HudSnapshot) {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const activeLabel = snapshot.activeShip
            ? formatPlayerLabel(snapshot.activeShip)
            : snapshot.activePlayerId ?? '—';

        this.statusText.setText(
            `Turn ${snapshot.turn}  ·  ${formatPhase(snapshot.phase)}  ·  Active: ${activeLabel}`,
        );

        this.shipText.setText(
            snapshot.activeShip ? formatShipSummary(snapshot.activeShip) : '',
        );

        this.headlineText.setText(snapshot.headline);
        this.detailText.setText(snapshot.detail);
        this.controlsText.setText(snapshot.controls);
        this.logText.setText(snapshot.log);

        let cursorY = height - BOTTOM_MARGIN;

        this.logText.setPosition(24, cursorY);
        cursorY -= this.logText.height + STACK_GAP;

        this.controlsText.setPosition(width / 2, cursorY);
        cursorY -= this.controlsText.height + STACK_GAP;

        this.detailText.setPosition(width / 2, cursorY);
        cursorY -= this.detailText.height + STACK_GAP;

        this.headlineText.setPosition(width / 2, cursorY);
        cursorY -= this.headlineText.height + STACK_GAP;

        const panelTop = Math.max(height - 260, cursorY - 12);
        this.bottomBar.setPosition(width / 2, height);
        this.bottomBar.setSize(width, height - panelTop);
    }

    destroy() {
        this.root.destroy(true);
    }
}
