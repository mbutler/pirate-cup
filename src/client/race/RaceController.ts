import type { GameEvent } from '../../core/events/types';
import type { MoveDirection } from '../../core/track/types';
import type { GameSession } from '../GameSession';
import { ASSETS } from '../config';
import { isConfirmKey, clearKeyboardHistory } from '../input/keyboard';
import { GameHud } from '../ui/GameHud';
import {
    formatCorneringOutcome,
    formatEventMessage,
    formatFloggingOutcome,
    formatMoveDirection,
    formatPlayerLabel,
} from '../ui/formatters';
import {
    RaceBoard,
    buildMovePreviewOptions,
    directionForMove,
    getMoveOptions,
    getOccupiedPositions,
} from './RaceBoard';

type ControllerMode =
    | { kind: 'pick_speed'; speed: number }
    | { kind: 'choose_move'; selectedIndex: number }
    | { kind: 'flog_prompt'; chooseFlog: boolean }
    | { kind: 'mutiny_run' }
    | { kind: 'combat' }
    | { kind: 'busy' };

export class RaceController {
    private readonly hud: GameHud;
    private readonly board: RaceBoard;
    private mode: ControllerMode = { kind: 'pick_speed', speed: 0 };
    private eventLog = 'Welcome aboard. Pick speed, then move one hex at a time.';
    private locked = false;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly session: GameSession,
    ) {
        this.hud = new GameHud(scene);
        this.board = new RaceBoard(scene);
    }

    start() {
        this.board.syncShips(this.session.state.ships, this.session.state.activePlayerId);
        this.bindKeyboard();

        const ship = this.activeShip();

        if (ship?.rowers.temperament === 'mutiny' && this.session.state.phase === 'input') {
            void this.beginMutinyTurn();
            return;
        }

        if (ship) {
            this.mode = { kind: 'pick_speed', speed: ship.maxSpeed };
        }

        this.refreshHud();
    }

    destroy() {
        this.hud.destroy();
        this.board.clearMovePreview();
    }

    private bindKeyboard() {
        const keyboard = this.scene.input.keyboard;

        if (!keyboard) {
            return;
        }

        keyboard.on('keydown', (event: KeyboardEvent) => {
            if (this.locked || isConfirmKey(event)) {
                return;
            }

            void this.handleKey(event);
        });

        keyboard.on('keyup', (event: KeyboardEvent) => {
            if (this.locked || !isConfirmKey(event)) {
                return;
            }

            void this.handleConfirm();
        });
    }

    private async handleConfirm() {
        switch (this.mode.kind) {
            case 'pick_speed':
                await this.handlePickSpeed('Enter');
                break;
            case 'choose_move':
                await this.handleChooseMove('Enter');
                break;
            case 'flog_prompt':
                await this.handleFlogPrompt('Enter');
                break;
            case 'combat':
                await this.resolveCombat();
                break;
            default:
                break;
        }
    }

    private async handleKey(event: KeyboardEvent) {
        const code = event.code;

        switch (this.mode.kind) {
            case 'pick_speed':
                await this.handlePickSpeed(code);
                break;
            case 'choose_move':
                await this.handleChooseMove(code);
                break;
            case 'flog_prompt':
                await this.handleFlogPrompt(code);
                break;
            default:
                break;
        }
    }

    private async handlePickSpeed(code: string) {
        const ship = this.activeShip();

        if (!ship || this.session.state.phase !== 'input') {
            return;
        }

        if (code === 'ArrowUp') {
            this.mode = {
                kind: 'pick_speed',
                speed: Math.min(ship.maxSpeed, this.mode.speed + 1),
            };
        } else if (code === 'ArrowDown') {
            this.mode = {
                kind: 'pick_speed',
                speed: Math.max(0, this.mode.speed - 1),
            };
        } else if (code === 'Enter') {
            await this.submitSpeed(this.mode.speed);
            return;
        } else {
            return;
        }

        this.refreshHud();
    }

    private async submitSpeed(speed: number) {
        const playerId = this.session.state.activePlayerId;

        if (!playerId) {
            return;
        }

        this.board.clearMovePreview();
        this.locked = true;

        try {
            const events = this.session.dispatch({
                type: 'SUBMIT_TURN_INPUT',
                playerId,
                input: { speed, moves: [] },
            });

            await this.playEvents(events);
            await this.resumeAfterAction();
        } finally {
            if (this.locked) {
                this.unlockInput();
            }
        }
    }

    private async beginMutinyTurn() {
        const playerId = this.session.state.activePlayerId;

        if (!playerId) {
            return;
        }

        this.mode = { kind: 'mutiny_run' };
        this.board.clearMovePreview();
        this.locked = true;

        try {
            const events = this.session.dispatch({
                type: 'SUBMIT_TURN_INPUT',
                playerId,
                input: { speed: 0, moves: [] },
            });

            await this.playEvents(events);
            await this.resumeAfterAction();
        } finally {
            if (this.locked) {
                this.unlockInput();
            }
        }
    }

    private async runMutinyStep() {
        const ship = this.activeShip();
        const playerId = this.session.state.activePlayerId;

        if (
            !ship ||
            !playerId ||
            ship.rowers.temperament !== 'mutiny' ||
            this.session.state.phase !== 'movement' ||
            ship.movementRemaining <= 0
        ) {
            return;
        }

        this.mode = { kind: 'mutiny_run' };
        this.board.clearMovePreview();
        this.locked = true;

        this.eventLog = `${formatPlayerLabel(ship)} surges ahead under mutiny…`;
        this.refreshHud();

        try {
            const events = this.session.dispatch({
                type: 'CHOOSE_MOVE',
                playerId,
                direction: 'forward',
            });

            await this.playEvents(events);
            await this.resumeAfterAction();
        } finally {
            if (this.locked) {
                this.unlockInput();
            }
        }
    }

    private beginChooseMove() {
        const ship = this.activeShip();

        if (!ship) {
            return;
        }

        const options = getMoveOptions(ship.positionId);

        this.mode = {
            kind: 'choose_move',
            selectedIndex: Math.min(1, Math.max(0, options.length - 1)),
        };

        this.unlockInput();
        this.updateMovePreview();
        this.refreshHud();
    }

    private beginFlogPrompt() {
        this.mode = { kind: 'flog_prompt', chooseFlog: true };
        this.unlockInput();
        this.refreshHud();
    }

    private unlockInput() {
        this.locked = false;
        clearKeyboardHistory(this.scene);
    }

    private async handleChooseMove(code: string) {
        if (this.mode.kind !== 'choose_move') {
            return;
        }

        const ship = this.activeShip();

        if (!ship || this.session.state.phase !== 'movement') {
            return;
        }

        const options = getMoveOptions(ship.positionId);

        if (code === 'ArrowLeft') {
            this.mode.selectedIndex = (this.mode.selectedIndex - 1 + options.length) % options.length;
            this.updateMovePreview();
            this.refreshHud();
            return;
        }

        if (code === 'ArrowRight') {
            this.mode.selectedIndex = (this.mode.selectedIndex + 1) % options.length;
            this.updateMovePreview();
            this.refreshHud();
            return;
        }

        if (code !== 'Enter') {
            return;
        }

        const targetId = options[this.mode.selectedIndex];
        const direction = directionForMove(ship.positionId, targetId);
        const playerId = this.session.state.activePlayerId;

        if (!playerId) {
            return;
        }

        this.board.clearMovePreview();
        this.locked = true;

        this.eventLog = `${formatPlayerLabel(ship)} moving ${formatMoveDirection(direction)}…`;
        this.refreshHud();

        try {
            const events = this.session.dispatch({
                type: 'CHOOSE_MOVE',
                playerId,
                direction,
            });

            await this.playEvents(events);
            await this.resumeAfterAction();
        } finally {
            if (this.locked) {
                this.unlockInput();
            }
        }
    }

    private async resumeAfterAction() {
        this.board.syncShips(
            this.session.state.ships,
            this.session.state.activePlayerId,
        );

        const ship = this.activeShip();
        const phase = this.session.state.phase;

        if (phase === 'movement' && ship) {
            if (ship.movementRemaining > 0) {
                if (ship.rowers.temperament === 'mutiny') {
                    await this.runMutinyStep();
                    return;
                }

                this.beginChooseMove();
                return;
            }

            if (
                ship.flogAttemptsRemaining > 0 &&
                ship.rowers.temperament !== 'mutiny'
            ) {
                this.beginFlogPrompt();
                return;
            }

            const playerId = this.session.state.activePlayerId;

            if (playerId) {
                const events = this.session.dispatch({
                    type: 'FLOG_DECISION',
                    playerId,
                    flog: false,
                });
                await this.playEvents(events);
                await this.resumeAfterAction();
                return;
            }
        }

        if (phase === 'input') {
            const nextShip = this.activeShip();

            if (nextShip?.rowers.temperament === 'mutiny') {
                await this.beginMutinyTurn();
                return;
            }

            this.mode = { kind: 'pick_speed', speed: nextShip?.maxSpeed ?? 0 };
            this.unlockInput();
            this.board.clearMovePreview();
            this.refreshHud();
            return;
        }

        if (phase === 'combat') {
            this.mode = { kind: 'combat' };
            this.unlockInput();
            this.board.clearMovePreview();
            this.refreshHud();
            return;
        }

        this.unlockInput();
        this.refreshHud();
    }

    private async handleFlogPrompt(code: string) {
        if (this.mode.kind !== 'flog_prompt') {
            return;
        }

        if (code === 'ArrowLeft' || code === 'KeyN') {
            this.mode = { kind: 'flog_prompt', chooseFlog: false };
            this.refreshHud();
            return;
        }

        if (code === 'ArrowRight' || code === 'KeyY') {
            this.mode = { kind: 'flog_prompt', chooseFlog: true };
            this.refreshHud();
            return;
        }

        if (code !== 'Enter') {
            return;
        }

        const playerId = this.session.state.activePlayerId;

        if (!playerId) {
            return;
        }

        this.locked = true;

        try {
            const events = this.session.dispatch({
                type: 'FLOG_DECISION',
                playerId,
                flog: this.mode.chooseFlog,
            });

            await this.playEvents(events);
            await this.resumeAfterAction();
        } finally {
            if (this.locked) {
                this.unlockInput();
            }
        }
    }

    private async resolveCombat() {
        this.locked = true;

        const events = this.session.dispatch({ type: 'END_TURN' });
        await this.playEvents(events);

        const ship = this.activeShip();
        this.mode = { kind: 'pick_speed', speed: ship?.maxSpeed ?? 0 };
        this.unlockInput();
        this.board.syncShips(this.session.state.ships, this.session.state.activePlayerId);
        this.refreshHud();
    }

    private async playEvents(events: GameEvent[]) {
        for (const event of events) {
            this.eventLog = formatEventMessage(event);

            if (event.type === 'SHIP_MOVED') {
                await this.board.tweenShipTo(event.playerId, event.to);
            }

            if (event.type === 'WALL_COLLISION' || event.type === 'RAMMING') {
                this.scene.cameras.main.shake(120, 0.012);
                this.scene.sound.play(ASSETS.audio.uiBeepKey, { volume: 0.45 });

                if (event.type === 'WALL_COLLISION') {
                    this.board.flashDamage(event.playerId);
                } else {
                    this.board.flashDamage(event.rammerId);
                    this.board.flashDamage(event.rammedId);
                }
            }

            if (event.type === 'CORNERING_DRAWN') {
                await this.board.showCardToast(
                    event.playerId,
                    'Cornering',
                    formatCorneringOutcome(event.outcome),
                    '#8ecae6',
                );
            }

            if (event.type === 'FLOGGING_DRAWN') {
                await this.board.showCardToast(
                    event.playerId,
                    'Flogging',
                    formatFloggingOutcome(event.outcome),
                    '#f2ca02',
                );
            }

            if (event.type === 'MUTINY_STARTED') {
                this.scene.cameras.main.shake(200, 0.018);
                this.scene.sound.play(ASSETS.audio.uiBeepKey, { volume: 0.55 });
                await this.board.showCardToast(
                    event.playerId,
                    'Mutiny',
                    'Rowers seize the ship!',
                    '#ff5555',
                );
            }

            if (event.type === 'MUTINY_SPEED_ROLLED') {
                await this.board.showCardToast(
                    event.playerId,
                    'Mutiny',
                    `Speed ${event.speed} — sails + d10 (${event.roll})`,
                    '#ff8844',
                );
            }

            if (event.type === 'MUTINY_ENDED') {
                await this.board.showCardToast(
                    event.playerId,
                    'Mutiny over',
                    formatEventMessage(event),
                    '#8ecae6',
                );
            }

            if (event.type === 'ARENA_LASER' || event.type === 'FRENZY_COOLDOWN_ROLL') {
                await this.board.showCardToast(
                    event.playerId,
                    event.type === 'ARENA_LASER' ? 'Arena laser' : 'Frenzy check',
                    formatEventMessage(event),
                    event.type === 'ARENA_LASER' ? '#ff4444' : '#8ecae6',
                );
            }

            this.refreshHud();
        }
    }

    private updateMovePreview() {
        if (this.mode.kind !== 'choose_move') {
            return;
        }

        const ship = this.activeShip();

        if (!ship) {
            return;
        }

        const occupied = getOccupiedPositions(this.session.state.ships, ship.id);
        const options = buildMovePreviewOptions(ship.positionId, occupied);

        this.board.syncShips(this.session.state.ships, ship.id);
        this.board.showMovePreview(ship.positionId, options, this.mode.selectedIndex);
    }

    private refreshHud() {
        const ship = this.activeShip();

        this.hud.render({
            turn: this.session.state.turn,
            phase: this.session.state.phase,
            activePlayerId: this.session.state.activePlayerId,
            activeShip: ship,
            headline: this.headline(),
            detail: this.detail(),
            controls: this.controls(),
            log: this.eventLog,
        });
    }

    private headline(): string {
        const ship = this.activeShip();
        const label = ship ? formatPlayerLabel(ship) : 'All hands';

        switch (this.mode.kind) {
            case 'pick_speed':
                return `${label} — choose speed`;
            case 'choose_move':
                return `${label} — move ${this.movesRemainingLabel()}`;
            case 'flog_prompt':
                return `${label} — flog the rowers?`;
            case 'mutiny_run':
                return `${label} — MUTINY!`;
            case 'combat':
                return 'Boarders may strike';
            case 'busy':
                return 'Stand by…';
            default:
                return 'Pirate Cup';
        }
    }

    private movesRemainingLabel(): string {
        const ship = this.activeShip();

        if (!ship) {
            return '';
        }

        const total = ship.chosenSpeed;
        const left = ship.movementRemaining;
        const used = total - left;

        return `${used + 1} of ${total}`;
    }

    private detail(): string {
        switch (this.mode.kind) {
            case 'pick_speed':
                return `Speed ${this.mode.speed} of max ${this.activeShip()?.maxSpeed ?? 0}. You'll pick each direction as you go — rams happen immediately.`;
            case 'choose_move': {
                const ship = this.activeShip();

                if (!ship) {
                    return '';
                }

                return `At hex ${ship.positionId} · ${ship.movementRemaining} move${ship.movementRemaining === 1 ? '' : 's'} left · labels fan out from your ship`;
            }
            case 'flog_prompt':
                return this.mode.chooseFlog
                    ? 'Yes — draw from the flogging deck for extra speed (risky).'
                    : 'No — end this ship\'s turn and pass to the next captain.';
            case 'mutiny_run':
                return 'Rowers are frenzied — straight ahead only. Overspeed corner checks and rams still apply. Boarders may still fight in combat.';
            case 'combat':
                return 'Ships on the same hex may trade boarder blows. Press Enter to resolve and start the next turn.';
            default:
                return '';
        }
    }

    private controls(): string {
        switch (this.mode.kind) {
            case 'pick_speed':
                return '↑ ↓ adjust speed   ·   Enter confirm';
            case 'choose_move':
                return '← → choose direction   ·   Enter move now';
            case 'flog_prompt':
                return '← or N = No   ·   → or Y = Yes   ·   Enter confirm';
            case 'mutiny_run':
                return 'No input — rowers are in control';
            case 'combat':
                return 'Enter resolve combat and begin next turn';
            default:
                return '';
        }
    }

    private activeShip() {
        const id = this.session.state.activePlayerId;
        return id ? this.session.state.ships[id] : null;
    }

    private wait(ms: number) {
        return new Promise<void>((resolve) => {
            this.scene.time.delayedCall(ms, () => resolve());
        });
    }
}
