import type { ShipState, DisplacedCrew } from '../../core/entities/types';
import type { TurnPhase } from '../../core/state/GameState';
import {
    COMPASS,
    escapeHtml,
    replaceContent,
    SHIP_COLORS,
    shipIcon,
} from './dom';

export interface HudChoice {
    label: string;
    detail: string;
    value: number;
    selected: boolean;
    risk?: boolean;
}
export interface HudSnapshot {
    turn: number;
    computerCaptains: readonly string[];
    lapsToWin: number;
    winnerId: string | null;
    phase: TurnPhase;
    activePlayerId: string | null;
    activeShip: ShipState | null;
    ships: ShipState[];
    headline: string;
    detail: string;
    controls: string;
    log: string;
    mode: string;
    speed?: number;
    choices: HudChoice[];
    boardingChoices: HudChoice[];
    crewChoices: HudChoice[];
    displacedCrew: DisplacedCrew[];
    attacksQueued: number;
    locked: boolean;
    chooseFlog?: boolean;
}

export class GameHud {
    readonly root = document.createElement('div');
    private readonly fleet: HTMLElement;
    private readonly command: HTMLElement;
    private readonly status: HTMLElement;
    private readonly log: HTMLElement;
    private readonly dialog: HTMLDialogElement;
    private history: string[] = [];
    private previousLog = '';
    private lastFocus: HTMLElement | null = null;
    private muted: boolean;
    private quick = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches;

    constructor(
        private readonly onAction: (action: string, value?: number) => void,
        muted = false,
    ) {
        this.muted = muted;
        this.root.className = 'race-ui';
        this.root.innerHTML = `<header class="race-header"><div class="wordmark">${COMPASS} PIRATE CUP</div><div class="race-title">THE TWIN ISLES <span>Local playtest</span></div><nav aria-label="Game options"><button class="quiet" data-action="sound" aria-label="${this.muted ? 'Unmute sound' : 'Mute sound'}">${this.muted ? 'Sound off' : 'Sound on'}</button><button class="quiet" data-action="pace" aria-label="${this.quick ? 'Use normal animations' : 'Enable quick animations'}">${this.quick ? '2× pace' : '1× pace'}</button><button class="quiet" data-action="help">How to play</button><button class="quiet" data-action="menu">Harbor ↗</button></nav></header>
            <div class="fleet-strip" aria-label="Fleet status"></div>
            <div class="course-label"><span class="eyebrow">THE TWIN ISLES</span><span>↶ Sail counterclockwise</span></div>
            <div class="course-legend"><span>Numbers = safe corner speed</span><span><i class="legend-dot"></i> Your ship</span><span><i class="legend-dot amber"></i> Collision risk</span></div>
            <section class="command-deck" aria-label="Captain’s controls"></section>
            <footer class="race-footer"><span class="round-status"></span><button data-action="log" class="log-button" aria-label="Open ship’s log"><span class="log-message" aria-live="polite"></span><span>Ship’s log ↗</span></button></footer>
            <dialog class="game-dialog"></dialog>`;
        document.querySelector('#app')!.append(this.root);
        this.fleet = this.root.querySelector('.fleet-strip')!;
        this.command = this.root.querySelector('.command-deck')!;
        this.status = this.root.querySelector('.round-status')!;
        this.log = this.root.querySelector('.log-message')!;
        this.dialog = this.root.querySelector('dialog')!;
        this.dialog.addEventListener('close', () => this.lastFocus?.focus());
        this.root.addEventListener('click', (event) => {
            const button = (event.target as Element).closest<HTMLButtonElement>(
                'button[data-action]',
            );
            if (!button || button.disabled) return;
            const action = button.dataset.action!;
            if (action === 'close') {
                this.dialog.close();
                return;
            }
            if (action === 'help' || action === 'log' || action === 'menu') {
                this.showDialog(action);
                return;
            }
            if (action === 'sound') {
                this.muted = !this.muted;
                button.textContent = this.muted ? 'Sound off' : 'Sound on';
                button.setAttribute(
                    'aria-label',
                    this.muted ? 'Unmute sound' : 'Mute sound',
                );
            }
            if (action === 'pace') {
                this.quick = !this.quick;
                button.textContent = this.quick ? '2× pace' : '1× pace';
                button.setAttribute(
                    'aria-label',
                    this.quick
                        ? 'Use normal animations'
                        : 'Enable quick animations',
                );
            }
            this.onAction(
                action,
                button.dataset.value === undefined
                    ? undefined
                    : Number(button.dataset.value),
            );
        });
    }

    get modalOpen() {
        return this.dialog.open;
    }

    render(snapshot: HudSnapshot) {
        const ship = snapshot.activeShip;
        replaceContent(
            this.fleet,
            snapshot.ships
                .filter(
                    (racer) =>
                        !racer.destroyed ||
                        (!snapshot.displacedCrew.some(
                            (crew) => crew.id === racer.ownerId,
                        ) &&
                            !snapshot.ships.some(
                                (other) =>
                                    !other.destroyed &&
                                    other.ownerId === racer.ownerId,
                            )),
                )
                .map(
                    (racer, i) =>
                        `<div class="fleet-ship ${racer.id === snapshot.activePlayerId ? 'is-active' : ''} ${racer.destroyed ? 'is-wrecked' : ''}" style="--ship-color:${SHIP_COLORS[racer.color]}">${shipIcon(racer.color)}<div><strong>${racer.color} <small>${racer.ownerId.replace('player-', 'P')}${snapshot.computerCaptains.includes(racer.ownerId) ? ' · Computer' : ''}</small></strong><span>${racer.destroyed ? (snapshot.displacedCrew.some((crew) => crew.id === racer.ownerId) ? 'Crew afloat' : 'Wrecked') : racer.id === snapshot.winnerId ? 'Winner' : `#${i + 1} · Lap ${Math.min(racer.lapsCompleted + 1, snapshot.lapsToWin)}/${snapshot.lapsToWin}${racer.rowers.temperament === 'mutiny' ? ' · Mutiny' : ''}`}</span></div><i></i></div>`,
                )
                .join('') +
                snapshot.displacedCrew
                    .map(
                        (crew) =>
                            `<div class="fleet-ship" style="--ship-color:${SHIP_COLORS[crew.color]}">${shipIcon(crew.color)}<div><strong>${crew.color} <small>${crew.id.replace('player-', 'P')}${snapshot.computerCaptains.includes(crew.id) ? ' · Computer' : ''}</small></strong><span>Crew afloat · ${crew.captainHp + crew.boarderHp} health · ${crew.lapsCompleted} laps</span></div></div>`,
                    )
                    .join(''),
        );
        this.status.textContent = `ROUND ${String(snapshot.turn).padStart(2, '0')}`;
        if (snapshot.log !== this.previousLog) {
            this.previousLog = snapshot.log;
            this.history.unshift(snapshot.log);
            this.history = this.history.slice(0, 40);
            this.log.textContent = snapshot.log;
        }
        const disabled = snapshot.locked ? 'disabled' : '';
        const actionButtons =
            snapshot.mode === 'crew'
                ? `<div class="boarding-choices" role="group" aria-label="Surviving crew orders">${snapshot.crewChoices.map((choice) => `<button data-action="crew-choice" data-value="${choice.value}" ${disabled}><strong>${choice.label}</strong><small>${choice.detail}</small></button>`).join('')}</div><button class="secondary" data-action="crew-wait" ${disabled}>Wait</button><button class="secondary" data-action="crew-retire" ${disabled}>Retire crew</button>`
                : snapshot.mode === 'finished'
                  ? `<button class="secondary" data-action="leave">Return to harbor</button><button class="primary" data-action="rematch">Race again <span>↗</span></button>`
                  : snapshot.mode === 'boarding'
                    ? `<div class="boarding-choices" role="group" aria-label="Boarding targets">${snapshot.boardingChoices.map((choice) => `<button data-action="target" data-value="${choice.value}" aria-pressed="${choice.selected}" ${disabled}><strong>${choice.label}</strong><small>${choice.detail}</small></button>`).join('')}</div><button class="secondary" data-action="pass" ${disabled}>Pass</button><button class="primary" data-action="confirm" ${disabled}>Lock attack →</button>`
                    : snapshot.mode === 'pick_speed'
                      ? `<div class="speed-picker" role="group" aria-label="Choose speed">${Array.from({ length: (ship?.maxSpeed ?? 0) + 1 }, (_, n) => `<button data-action="speed" data-value="${n}" aria-pressed="${snapshot.speed === n}" ${disabled}>${n}</button>`).join('')}</div><button class="primary" data-action="confirm" ${disabled}>${snapshot.speed === 0 ? 'Hold position' : 'Confirm speed'} <span>→</span></button>`
                      : snapshot.mode === 'choose_move'
                        ? `<div class="move-choices" role="group" aria-label="Choose direction">${snapshot.choices.map((choice) => `<button data-action="direction" data-value="${choice.value}" aria-pressed="${choice.selected}" class="${choice.risk ? 'risky' : ''}" ${disabled}><strong>${choice.label}</strong><small>${choice.detail}</small></button>`).join('')}</div><button class="primary" data-action="confirm" ${disabled}>Move ship <span>→</span></button>`
                        : snapshot.mode === 'flog_prompt'
                          ? `<div class="decision-buttons"><button class="secondary ${snapshot.chooseFlog === false ? 'is-chosen' : ''}" data-action="rest" ${disabled}>End turn <span>→</span></button><button class="primary risk-button ${snapshot.chooseFlog ? 'is-chosen' : ''}" data-action="flog" ${disabled}>Flog the rowers <span>↗</span></button></div><p class="risk-note">${ship?.flogAttemptsRemaining ?? 0} attempts left · 10% chance of mutiny per draw</p>`
                          : snapshot.mode === 'combat'
                            ? `<button class="primary" data-action="confirm" ${disabled}>${snapshot.attacksQueued ? 'Resolve combat' : 'Next round'} <span>→</span></button><p class="risk-note">${snapshot.attacksQueued} boarding strike${snapshot.attacksQueued === 1 ? '' : 's'} queued.</p>`
                            : `<div class="underway"><span class="signal"></span> ${snapshot.mode === 'mutiny_run' ? 'The crew has the helm' : 'Resolving your move…'}</div>`;
        replaceContent(
            this.command,
            `<div class="captain-status" style="--ship-color:${SHIP_COLORS[ship?.color ?? 'red']}"><div class="captain-heading">${ship ? shipIcon(ship.color) : COMPASS}<div><span class="eyebrow">${ship ? `CAPTAIN ${ship.ownerId.replace('player-', '0')}` : 'ALL HANDS'}</span><h2>${ship ? `${ship.color} fleet` : snapshot.mode === 'crew' ? 'Crew afloat' : snapshot.mode === 'finished' ? 'All ships lost' : 'Round complete'}</h2></div></div>${ship ? `<div class="hull-meter"><span>Hull integrity <b>${ship.hull.structure} / 30</b></span><div class="meter-track"><i style="width:${Math.max(0, (ship.hull.structure / 30) * 100)}%"></i></div></div><div class="ship-stats"><span>Bow <b>${ship.hull.front}</b></span><span>Port <b>${ship.hull.left}</b></span><span>Starboard <b>${ship.hull.right}</b></span><span>Stern <b>${ship.hull.rear}</b></span></div><div class="crew-line"><span>Rowers <b>${ship.rowers.hp}</b></span><span>Max speed <b>${ship.maxSpeed}</b></span><span>Boarder <b>${ship.crew.boarderHp}/10</b></span><span class="temperament">${ship.rowers.temperament}</span></div>` : snapshot.mode === 'crew' ? '<p class="round-note">Your race is still alive.<br>Find a ship and take the helm.</p>' : snapshot.mode === 'finished' ? '<p class="round-note">A hard-fought race.<br>A fresh start awaits.</p>' : '<p class="round-note">The fleet regroups.<br>Prepare for the next round.</p>'}</div>
            <div class="command-main"><div class="command-heading"><div><span class="eyebrow gold">${snapshot.mode === 'pick_speed' ? '01 / SET YOUR PACE' : snapshot.mode === 'choose_move' ? '02 / CHOOSE YOUR LINE' : snapshot.mode === 'flog_prompt' ? '03 / TEMPT YOUR LUCK' : snapshot.mode === 'boarding' ? '04 / BOARDING ORDERS' : snapshot.mode === 'finished' ? 'THE PIRATE CUP / FINAL RESULT' : 'THE RACE CONTINUES'}</span><h2>${escapeHtml(snapshot.headline)}</h2></div>${snapshot.mode === 'pick_speed' ? `<span class="speed-readout">${snapshot.speed}<small> / ${ship?.maxSpeed}</small></span>` : snapshot.mode === 'choose_move' ? `<span class="speed-readout">${ship?.movementRemaining}<small> left</small></span>` : ''}</div><p class="command-detail">${escapeHtml(snapshot.detail)}</p><div class="command-actions">${actionButtons}</div><p class="keyboard-hint">${escapeHtml(snapshot.controls)}</p></div>`,
        );
    }

    private showDialog(kind: string) {
        this.lastFocus = document.activeElement as HTMLElement;
        const content =
            kind === 'help'
                ? `<p class="eyebrow gold">A CAPTAIN’S FIELD GUIDE</p><h2>Keep your nerve.<br>Mind the corners.</h2><ol class="help-list"><li><strong>Win the cup.</strong> Complete the chosen number of laps, or command the last ship with no rival crews left. Sail past the western end, along the south straight, around the eastern end, then cross the finish line heading west. Cutting through the center does not complete a lap.</li><li><strong>Choose your speed.</strong> Each point buys one move. A damaged crew lowers your maximum.</li><li><strong>Pick your line.</strong> Select port, ahead, or starboard, then move. You can also click a marked destination on the course to sail there immediately.</li><li><strong>Read the water.</strong> Enter a corner above its safe speed and draw one cornering card per excess point. Drift can send you into another ship or the shore.</li><li><strong>Make contact.</strong> Sail into a rival to ram them. Both ships take damage; the impact can start a chain collision.</li><li><strong>Board a rival.</strong> After movement, each surviving boarder with a neighboring opponent can strike once for 4 boarder damage or pass. All strikes land simultaneously, even if an attacker falls. At zero health a boarder cannot fight; the ship can still race. Mutiny does not prevent boarding.</li><li><strong>Push your luck.</strong> Flog for bonus movement, or end your turn. A mutinous crew chooses its own speed and sails straight ahead.</li></ol><p class="playtest-disclosure">Races can now be completed. A ship is disabled when its hull or rowers reach zero. Survivors take one action per round before boarding: row to any neighboring hex, attempt a hijack within one hex, wait, or retire. Hijacks roll d10 plus boarding strength against the defending crew. Captain skill is 8 (a replacement boarder uses 7), reduced by 1 per 3 health lost, with +1 support when both survive; ties defend. Failure costs 4 health, captain first. Success displaces the defenders until next round, keeps the vessel’s damage, preserves each captain’s completed laps, and restarts the current lap. The last vessel only wins by survival once no rival crews remain; if every vessel sinks, the race is a draw. Mutiny recovery rolls d10 against helm skill. A warning shot enrages the last-place crew after each round while at least two ships remain.</p>`
                : kind === 'log'
                  ? `<p class="eyebrow gold">RECENT EVENTS</p><h2>The ship’s log</h2><ol class="history-list">${this.history.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ol>`
                  : `<p class="eyebrow gold">RETURN TO PORT</p><h2>Leave this race?</h2><p>Your current race will be lost. You can assemble a new fleet at the harbor.</p><button class="primary" data-action="leave">Return to harbor →</button>`;
        this.dialog.innerHTML = `<button class="dialog-close quiet" data-action="close" aria-label="Close dialog">✕</button>${content}<button class="secondary dialog-done" data-action="close">${kind === 'menu' ? 'Keep sailing' : 'Back to the race'}</button>`;
        this.dialog.setAttribute(
            'aria-label',
            kind === 'help'
                ? 'How to play'
                : kind === 'log'
                  ? 'Ship’s log'
                  : 'Leave this race?',
        );
        this.dialog.showModal();
    }

    destroy() {
        this.dialog.close();
        this.root.remove();
    }
}
