import { downloadSave, writeSave } from '../RaceSave';
import { chooseComputerAction } from '../../core/ai/Captain';
import type { GameEvent } from '../../core/events/types';
import { defaultTrack } from '../../core/track/TrackGraph';
import {
    createLocalSession,
    isComputerTurn,
    type GameSession,
} from '../GameSession';
import { boardingTargets, BOARDER_MELEE_DAMAGE } from '../../core/rules/combat';
import { crewDestinations, hijackTargets } from '../../core/rules/crew';
import type { GameAction } from '../../core/actions/types';
import { hijackChance, hijackStrength } from '../../core/rules/crewSkill';
import { raceStandings } from '../../core/rules/race';
import { ASSETS } from '../config';
import { isConfirmKey, clearKeyboardHistory } from '../input/keyboard';
import { GameHud } from '../ui/GameHud';
import {
    formatCorneringOutcome,
    formatHitSide,
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
    | { kind: 'boarding'; selectedIndex: number }
    | { kind: 'crew' }
    | { kind: 'combat' }
    | { kind: 'finished' }
    | { kind: 'busy' };

export class RaceController {
    private readonly hud: GameHud;
    private readonly board: RaceBoard;
    private mode: ControllerMode = { kind: 'pick_speed', speed: 0 };
    private eventLog =
        'Welcome aboard. Pick speed, then move one hex at a time.';
    private presentingEvent: GameEvent | null = null;
    private locked = false;
    private disposed = false;
    private computerTimer?: ReturnType<typeof setTimeout>;
    private readonly keyHandler = (event: KeyboardEvent) => {
        if (this.locked || this.hud.modalOpen || event.repeat) return;
        if (event.target instanceof HTMLElement) {
            if (event.target.closest('input, select, a, dialog')) return;
            const button = event.target.closest<HTMLButtonElement>('button');
            if (
                button &&
                !['speed', 'direction', 'target'].includes(
                    button.dataset.action ?? '',
                )
            ) {
                if (isConfirmKey(event) || event.code === 'Space') return;
                button.blur();
            }
        }
        if (
            [
                'ArrowUp',
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'Enter',
                'NumpadEnter',
                'Space',
            ].includes(event.code)
        )
            event.preventDefault();
        if (isConfirmKey(event) || event.code === 'Space')
            void this.handleConfirm();
        else void this.handleKey(event);
    };

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly session: GameSession,
    ) {
        this.hud = new GameHud((action, value) => {
            void this.handleHudAction(action, value);
        }, scene.sound.mute);
        this.board = new RaceBoard(scene, (index) => {
            if (
                this.locked ||
                this.hud.modalOpen ||
                this.mode.kind !== 'choose_move'
            )
                return;
            this.mode.selectedIndex = index;
            void this.handleConfirm();
        });
    }

    start() {
        const save = () =>
            this.hud.setSaveStatus(writeSave(this.session.snapshot()));
        this.session.setSaveHandler(save);
        save();
        this.bindKeyboard();
        void this.resumeAfterAction();
    }

    destroy() {
        this.disposed = true;
        this.session.setSaveHandler(null);
        clearTimeout(this.computerTimer);
        document.removeEventListener('keydown', this.keyHandler);
        this.hud.destroy();
        this.board.destroy();
    }

    private bindKeyboard() {
        document.addEventListener('keydown', this.keyHandler);
    }

    private async handleHudAction(action: string, value?: number) {
        if (action === 'export') {
            downloadSave(this.session.snapshot());
            return;
        }
        if (action === 'sound') {
            this.scene.sound.mute = !this.scene.sound.mute;
            return;
        }
        if (action === 'pace') {
            this.board.togglePace();
            return;
        }
        if (action === 'rematch' && this.session.state.phase === 'finished') {
            const config = this.session.state.config;
            this.scene.registry.set(
                'session',
                createLocalSession(
                    `race-${Date.now()}`,
                    config.playerCount,
                    config.lapsToWin,
                    this.session.computerCaptains,
                    this.session.personalities,
                ),
            );
            this.scene.scene.restart();
            return;
        }
        if (action === 'leave') {
            this.scene.scene.start('MainMenu');
            return;
        }
        if (this.locked || this.hud.modalOpen) return;
        if (
            action === 'target' &&
            this.mode.kind === 'boarding' &&
            value !== undefined
        ) {
            this.mode.selectedIndex = value;
            this.refreshHud();
            return;
        }
        if (this.mode.kind === 'crew') {
            const choice = this.crewChoices()[value ?? -1];
            const crewId = this.session.state.activeCrewId!;
            const command =
                action === 'crew-choice'
                    ? choice?.action
                    : action === 'crew-wait'
                      ? { type: 'CREW_WAIT' as const, crewId }
                      : action === 'crew-retire'
                        ? { type: 'CREW_RETIRE' as const, crewId }
                        : null;
            if (command) {
                this.mode = { kind: 'busy' };
                this.locked = true;
                this.refreshHud();
                await this.playEvents(this.session.dispatch(command));
                await this.resumeAfterAction();
            }
            return;
        }
        if (action === 'pass' && this.mode.kind === 'boarding') {
            await this.submitBoarding(true);
            return;
        }
        if (
            action === 'speed' &&
            this.mode.kind === 'pick_speed' &&
            value !== undefined
        ) {
            this.mode.speed = value;
            this.refreshHud();
        } else if (
            action === 'direction' &&
            this.mode.kind === 'choose_move' &&
            value !== undefined
        ) {
            this.mode.selectedIndex = value;
            this.updateMovePreview();
            this.refreshHud();
        } else if (
            (action === 'flog' || action === 'rest') &&
            this.mode.kind === 'flog_prompt'
        ) {
            this.mode.chooseFlog = action === 'flog';
            await this.handleConfirm();
        } else if (action === 'confirm') {
            await this.handleConfirm();
        }
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
            case 'boarding':
                await this.submitBoarding(false);
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
            case 'boarding': {
                if (code === 'KeyN') {
                    await this.submitBoarding(true);
                    break;
                }
                const targets = boardingTargets(
                    this.session.state,
                    this.session.state.activePlayerId!,
                );
                if (code === 'ArrowLeft' || code === 'ArrowRight') {
                    this.mode.selectedIndex =
                        (this.mode.selectedIndex +
                            (code === 'ArrowLeft' ? -1 : 1) +
                            targets.length) %
                        targets.length;
                    this.refreshHud();
                }
                break;
            }
            default:
                break;
        }
    }

    private async handlePickSpeed(code: string) {
        const ship = this.activeShip();

        if (
            !ship ||
            this.mode.kind !== 'pick_speed' ||
            this.session.state.phase !== 'input'
        ) {
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
        this.refreshHud();

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
        this.refreshHud();

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
        this.refreshHud();

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
            selectedIndex: Math.max(
                0,
                options.indexOf(
                    defaultTrack.neighbor(ship.positionId, 'forward'),
                ),
            ),
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
        if (this.disposed) return;
        if (isComputerTurn(this.session)) return;
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
            this.mode.selectedIndex =
                (this.mode.selectedIndex - 1 + options.length) % options.length;
            this.updateMovePreview();
            this.refreshHud();
            return;
        }

        if (code === 'ArrowRight') {
            this.mode.selectedIndex =
                (this.mode.selectedIndex + 1) % options.length;
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
        this.refreshHud();

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
        if (this.disposed) return;
        this.board.syncShips(
            this.session.state.ships,
            this.session.state.activePlayerId,
        );

        const ship = this.activeShip();
        const phase = this.session.state.phase;

        if (phase === 'finished') {
            this.mode = { kind: 'finished' };
            this.board.clearMovePreview();
            this.unlockInput();
            this.refreshHud();
            return;
        }

        if (isComputerTurn(this.session)) {
            this.mode = { kind: 'busy' };
            this.locked = true;
            this.board.clearMovePreview();
            this.refreshHud();
            clearTimeout(this.computerTimer);
            this.computerTimer = setTimeout(() => {
                void this.runComputerAction();
            }, 300);
            return;
        }

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

        if (phase === 'crew') {
            this.mode = { kind: 'crew' };
            this.board.clearMovePreview();
            this.unlockInput();
            this.refreshHud();
            return;
        }

        if (phase === 'combat') {
            this.mode = this.session.state.activePlayerId
                ? { kind: 'boarding', selectedIndex: 0 }
                : { kind: 'combat' };
            this.unlockInput();
            this.board.clearMovePreview();
            this.refreshHud();
            return;
        }

        this.unlockInput();
        this.refreshHud();
    }

    private async runComputerAction() {
        if (this.disposed) return;
        if (!this.hud.modalOpen) {
            const action = chooseComputerAction(this.session.state, this.session.personalities);
            if (action) await this.playEvents(this.session.dispatch(action));
        }
        await this.resumeAfterAction();
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
        this.refreshHud();

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

    private async submitBoarding(pass: boolean) {
        if (this.mode.kind !== 'boarding' || !this.session.state.activePlayerId)
            return;
        const attackerId = this.session.state.activePlayerId;
        const targetId = boardingTargets(this.session.state, attackerId)[
            this.mode.selectedIndex
        ];
        if (!pass && !targetId) return;
        this.locked = true;
        this.refreshHud();
        const events = this.session.dispatch(
            pass
                ? { type: 'PASS_ATTACK', attackerId }
                : { type: 'DECLARE_ATTACK', attackerId, targetId },
        );
        await this.playEvents(events);
        await this.resumeAfterAction();
    }

    private async resolveCombat() {
        this.locked = true;
        this.refreshHud();

        const events = this.session.dispatch({ type: 'END_TURN' });
        await this.playEvents(events);

        await this.resumeAfterAction();
    }

    private async playEvents(events: GameEvent[]) {
        try {
            for (const event of events) {
                if (this.disposed) return;
                this.presentingEvent = event;
                if (event.type !== 'PHASE_CHANGED') {
                    this.eventLog = formatEventMessage(event);
                    for (const racer of Object.values(
                        this.session.state.ships,
                    )) {
                        this.eventLog = this.eventLog
                            .split(racer.id)
                            .join(
                                racer.color.charAt(0).toUpperCase() +
                                    racer.color.slice(1),
                            );
                    }
                }

                // Publish the explanation before animating its consequence.
                this.refreshHud();

                if (event.type === 'SHIP_MOVED') {
                    await this.board.tweenShipTo(event.playerId, event.to);
                }

                if (event.type === 'COMBAT_RESOLVED') {
                    this.scene.sound.play(ASSETS.audio.boardingClash, {
                        volume: 0.4,
                    });
                    const clear = this.board.highlightExchange(
                        event.attackerId,
                        event.targetId,
                    );
                    try {
                        await this.board.showDamage(
                            event.targetId,
                            `−${event.damage} boarder health`,
                        );
                    } finally {
                        clear();
                    }
                }

                if (event.type === 'WALL_COLLISION') {
                    this.board.flashDamage(event.playerId);
                    this.scene.sound.play(ASSETS.audio.hullImpact, {
                        volume: 0.55,
                    });
                    await this.board.showCardToast(
                        event.playerId,
                        'Reef strike',
                        formatEventMessage(event).replace(/^Reef strike /, ''),
                        '#ff9977',
                    );
                }
                if (event.type === 'RAMMING') {
                    const clear = this.board.highlightExchange(
                        event.rammerId,
                        event.rammedId,
                    );
                    this.scene.sound.play(ASSETS.audio.hullImpact, {
                        volume: 0.55,
                    });
                    try {
                        const losses = [];
                        if (event.rammerHullDamage)
                            losses.push(
                                `−${event.rammerHullDamage} ${event.rammerHullSide ? formatHitSide(event.rammerHullSide) : 'hull'}`,
                            );
                        if (event.rammerMastDamage)
                            losses.push(`−${event.rammerMastDamage} rowers`);
                        await Promise.all([
                            this.board.showDamage(
                                event.rammedId,
                                `−${event.rammedDamage} ${formatHitSide(event.rammedSide)}`,
                                true,
                            ),
                            losses.length
                                ? this.board.showDamage(
                                      event.rammerId,
                                      losses.join('\n'),
                                  )
                                : Promise.resolve(),
                        ]);
                    } finally {
                        clear();
                    }
                }
                if (event.type === 'SHIP_DESTROYED') {
                    this.scene.sound.play(ASSETS.audio.shipWreck, {
                        volume: 0.55,
                    });
                    await this.board.showCardToast(
                        event.playerId,
                        'Ship lost',
                        'Vessel out of the race.',
                        '#ff9977',
                        true,
                    );
                }
                if (event.type === 'CREW_MESSAGE' && event.capturedShipId) {
                    this.scene.sound.play(ASSETS.audio.shipBell, {
                        volume: 0.35,
                    });
                    this.board.syncShips(
                        this.session.state.ships,
                        this.session.state.activePlayerId,
                    );
                    const color =
                        this.session.state.ships[event.capturedShipId].color;
                    await this.board.showCardToast(
                        event.capturedShipId,
                        'Hijacked!',
                        `${color.toUpperCase()} takes the helm. Defenders escape.`,
                        '#e4be77',
                        true,
                    );
                }
                if (event.type === 'BOARDER_DEFEATED') {
                    await this.board.showCardToast(
                        event.playerId,
                        'Boarder defeated',
                        'This ship can still race.',
                        '#ff9977',
                        true,
                    );
                }
                if (event.type === 'LAP_COMPLETED') {
                    this.scene.sound.play(ASSETS.audio.shipBell, {
                        volume: 0.35,
                    });
                    await this.board.showCardToast(
                        event.playerId,
                        'Lap complete',
                        `Lap ${event.lap} of ${this.session.state.config.lapsToWin}`,
                        '#a7d9ca',
                    );
                }
                if (event.type === 'RACE_WON' || event.type === 'RACE_DRAWN') {
                    await this.board.showCardToast(
                        event.type === 'RACE_WON' ? event.playerId : '',
                        'Race finished',
                        event.type === 'RACE_WON'
                            ? `${this.session.state.ships[event.playerId].color.toUpperCase()} wins the cup!`
                            : 'No vessels remain in the race.',
                        '#e4be77',
                        true,
                    );
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
                    this.scene.sound.play(ASSETS.audio.mutinyBell, {
                        volume: 0.4,
                    });
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
                        `Speed ${event.speed} — max speed + d10 (${event.roll})`,
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

                if (
                    event.type === 'ARENA_LASER' ||
                    event.type === 'FRENZY_COOLDOWN_ROLL'
                ) {
                    await this.board.showCardToast(
                        event.playerId,
                        event.type === 'ARENA_LASER'
                            ? 'Warning shot'
                            : 'Crew recovery',
                        formatEventMessage(event),
                        event.type === 'ARENA_LASER' ? '#ff4444' : '#8ecae6',
                    );
                }

                this.refreshHud();
            }
        } finally {
            this.presentingEvent = null;
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

        const occupied = getOccupiedPositions(
            this.session.state.ships,
            ship.id,
        );
        const options = buildMovePreviewOptions(ship.positionId, occupied);

        this.board.syncShips(this.session.state.ships, ship.id);
        this.board.showMovePreview(
            ship.positionId,
            options,
            this.mode.selectedIndex,
        );
    }

    private crewChoices(): {
        label: string;
        detail: string;
        action: GameAction;
    }[] {
        const state = this.session.state;
        const crewId = state.activeCrewId;
        if (!crewId) return [];
        return [
            ...hijackTargets(state, crewId).map((targetId) => ({
                label: `Hijack ${state.ships[targetId].color}`,
                detail: `${hijackChance(state.displacedCrew[crewId], state.ships[targetId].crew)}% success · defense ${hijackStrength(state.ships[targetId].crew)} + d10`,
                action: { type: 'HIJACK' as const, crewId, targetId },
            })),
            ...crewDestinations(state, crewId).map((destinationId) => ({
                label: `Row to ${destinationId.toUpperCase()}`,
                detail: 'One hex · ends crew turn',
                action: { type: 'CREW_MOVE' as const, crewId, destinationId },
            })),
        ];
    }

    private refreshHud() {
        if (this.disposed) return;
        const ship = this.activeShip();

        this.board.syncCrews(
            this.session.state.displacedCrew,
            this.session.state.activeCrewId,
        );
        this.hud.render({
            computerCaptains: this.session.computerCaptains,
            personalities: this.session.personalities,
            displacedCrew: Object.values(this.session.state.displacedCrew),
            crewChoices: this.crewChoices().map((choice, value) => ({
                ...choice,
                value,
                selected: false,
            })),
            turn: this.session.state.turn,
            phase: this.session.state.phase,
            activePlayerId: this.session.state.activePlayerId,
            activeShip: ship,
            ships: raceStandings(this.session.state),
            lapsToWin: this.session.state.config.lapsToWin,
            winnerId: this.session.state.winnerId,
            mode: this.presentingEvent ? 'busy' : this.mode.kind,
            speed:
                this.mode.kind === 'pick_speed' ? this.mode.speed : undefined,
            locked: this.locked,
            chooseFlog:
                this.mode.kind === 'flog_prompt'
                    ? this.mode.chooseFlog
                    : undefined,
            boardingChoices:
                this.mode.kind === 'boarding' && ship
                    ? boardingTargets(this.session.state, ship.id).map(
                          (id, index) => ({
                              label: this.session.state.ships[id].color,
                              detail: `Boarder ${this.session.state.ships[id].crew.boarderHp}/10 · ${BOARDER_MELEE_DAMAGE} damage`,
                              value: index,
                              selected:
                                  this.mode.kind === 'boarding' &&
                                  this.mode.selectedIndex === index,
                          }),
                      )
                    : [],
            attacksQueued: this.session.state.pendingCombat.filter(
                (attack) => attack.targetId !== null,
            ).length,
            choices:
                this.mode.kind === 'choose_move' && ship
                    ? getMoveOptions(ship.positionId).map((id, index) => {
                          const direction = directionForMove(
                              ship.positionId,
                              id,
                          );
                          const safe = defaultTrack.safeSpeedAt(id);
                          const checks = defaultTrack.corneringChecksOwed(
                              ship.chosenSpeed,
                              id,
                          );
                          const occupied = getOccupiedPositions(
                              this.session.state.ships,
                              ship.id,
                          ).has(id);
                          return {
                              label:
                                  direction === 'laneIn'
                                      ? '↖ Port'
                                      : direction === 'laneOut'
                                        ? '↗ Starboard'
                                        : '↑ Ahead',
                              detail: occupied
                                  ? 'Ram a rival'
                                  : checks > 0
                                    ? `${checks} corner check${checks === 1 ? '' : 's'}`
                                    : safe !== undefined
                                      ? `Safe speed ${safe}`
                                      : 'Open water',
                              value: index,
                              selected:
                                  this.mode.kind === 'choose_move' &&
                                  this.mode.selectedIndex === index,
                              risk: occupied || checks > 0,
                          };
                      })
                    : [],
            headline: this.headline(),
            detail: this.detail(),
            controls: this.controls(),
            log: this.eventLog,
        });
    }

    private headline(): string {
        if (this.presentingEvent) {
            switch (this.presentingEvent.type) {
                case 'COMBAT_RESOLVED':
                    return 'Boarding strikes land together.';
                case 'RAMMING':
                    return 'Ships collide!';
                case 'WALL_COLLISION':
                    return 'Reef strike!';
                case 'SHIP_DESTROYED':
                    return 'Ship lost!';
                case 'RACE_WON':
                case 'RACE_DRAWN':
                    return 'The race is over.';
                default:
                    return 'Action underway…';
            }
        }
        switch (this.mode.kind) {
            case 'crew': {
                const crew =
                    this.session.state.displacedCrew[
                        this.session.state.activeCrewId!
                    ];
                return `${crew.color.toUpperCase()} crew: seize a second chance.`;
            }
            case 'pick_speed':
                return 'How fast, captain?';
            case 'choose_move':
                return 'Choose your next move.';
            case 'flog_prompt':
                return 'One more push?';
            case 'mutiny_run':
                return 'Mutiny aboard!';
            case 'finished': {
                const winner = this.session.state.winnerId;
                return winner
                    ? `${this.session.state.ships[winner].color.toUpperCase()} wins the cup!`
                    : 'The sea takes the cup.';
            }
            case 'boarding':
                return 'Choose your boarding target.';
            case 'combat':
                return this.session.state.pendingCombat.some(
                    (attack) => attack.targetId,
                )
                    ? 'All strikes are locked in.'
                    : 'The fleet stands down.';
            case 'busy':
                return isComputerTurn(this.session)
                    ? 'Computer captain at the helm…'
                    : 'Stand by…';
            default:
                return 'Pirate Cup';
        }
    }

    private detail(): string {
        if (this.presentingEvent) return this.eventLog;
        switch (this.mode.kind) {
            case 'crew': {
                const crew =
                    this.session.state.displacedCrew[
                        this.session.state.activeCrewId!
                    ];
                return `At ${crew.positionId.toUpperCase()} · Captain ${crew.captainHp} + boarder ${crew.boarderHp}. Row one hex or hijack a ship within one hex. Your boarding strength ${hijackStrength(crew)} + d10; ties defend. Failure costs 4 health.`;
            }
            case 'pick_speed':
                return 'Each point buys a move. Take corners too fast and you risk drifting into trouble.';
            case 'choose_move': {
                const ship = this.activeShip();

                if (!ship) {
                    return '';
                }

                return `At ${ship.positionId.toUpperCase()} · Select a direction below, or click a marked destination to move immediately.`;
            }
            case 'flog_prompt':
                return this.mode.chooseFlog
                    ? 'Push the crew for extra movement. The draw may cost you hull, rowers, or control.'
                    : 'Give the crew a rest. End your turn and pass the helm to the next captain.';
            case 'mutiny_run':
                return 'Rowers are frenzied — straight ahead only. Overspeed corner checks and rams still apply.';
            case 'finished':
                return this.session.state.finishReason === 'laps'
                    ? `First to complete ${this.session.state.config.lapsToWin} lap${this.session.state.config.lapsToWin === 1 ? '' : 's'}. Race finished in round ${this.session.state.turn}.`
                    : this.session.state.finishReason === 'last_ship'
                      ? 'The last ship afloat takes the victory.'
                      : 'Every ship was wrecked. No winner this time.';
            case 'boarding':
                return 'Strike one neighboring boarder for 4 damage, or pass. All declared attacks land together.';
            case 'combat':
                return 'Resolve declared strikes, then crew recovery and the last-place penalty.';
            default:
                return '';
        }
    }

    private controls(): string {
        if (this.presentingEvent)
            return 'Playing out the action · Ship panels show the resolved outcome';
        switch (this.mode.kind) {
            case 'crew':
                return 'Choose an order · Wait preserves your chance · Retire permanently leaves the race';
            case 'pick_speed':
                return '↑ ↓ adjust speed   ·   Enter confirm';
            case 'choose_move':
                return '← → choose direction   ·   Enter to move   ·   Click the course to sail directly';
            case 'flog_prompt':
                return '← or N = No   ·   → or Y = Yes   ·   Enter confirm';
            case 'mutiny_run':
                return 'No input — rowers are in control';
            case 'finished':
                return 'Race complete · Rematch keeps your captains and race distance';
            case 'boarding':
                return '← → choose target · Enter lock attack · N pass';
            case 'combat':
                return 'Enter to resolve combat and begin the next round';
            default:
                return '';
        }
    }

    private activeShip() {
        const id =
            this.session.state.activePlayerId ?? this.session.state.winnerId;
        return id ? this.session.state.ships[id] : null;
    }
}
