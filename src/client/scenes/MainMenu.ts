import {
    PERSONALITIES,
    PERSONALITY_LABELS,
    type Personality,
} from '../../core/ai/Personality';
import { Scene, Scenes } from 'phaser';
import {
    createLocalSession,
    restoreSession,
    type GameSession,
} from '../GameSession';
import { SAVE_KEY, MAX_SAVE_BYTES, downloadSave } from '../RaceSave';
import { DEFAULT_SHIP_COLORS } from '../../core/config/GameConfig';
import { COMPASS, shipIcon } from '../ui/dom';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        const root = document.createElement('main');
        root.className = 'harbor';
        root.innerHTML = `
            <header class="harbor-header"><a class="wordmark" href="#" aria-label="Pirate Cup home">${COMPASS} PIRATE CUP</a><span class="eyebrow">A game of speed & skulduggery</span></header>
            <section class="harbor-main">
                <div class="harbor-copy"><p class="eyebrow gold">ALL CAPTAINS TO THE STARTING LINE</p>
                <h1>Fortune favors<br>the <em>reckless.</em></h1>
                <p class="intro">Race the islands. Trade a little paint.<br>Push your crew just one move too far.</p>
                <div class="setup"><div class="save-panel"><div class="save-actions"><button class="secondary continue-race" hidden>Continue race →</button><button class="quiet export-race" hidden>Export saved race</button><button class="quiet import-race">Import save</button></div><input class="save-file" type="file" accept=".json,application/json" hidden><p class="save-message menu-hint" role="status"></p></div><div class="setup-label"><span class="eyebrow">ASSEMBLE YOUR FLEET</span><span>Solo or pass & play</span></div>
                <div class="player-picker" role="group" aria-label="Number of captains">${[2, 3, 4, 5, 6].map((n) => `<button data-players="${n}" aria-pressed="${n === 4}">${n}<span>captains</span></button>`).join('')}</div>
                <div class="captain-picker" aria-label="Captain controls"></div>
                <div class="lap-picker"><label for="race-laps">Race distance</label><select id="race-laps"><option value="1">1 lap · Quick race</option><option value="2">2 laps</option><option value="3" selected>3 laps · Full cup</option></select></div>
                <button class="primary set-sail">Set sail <span>↗</span></button>
                <p class="menu-hint">One screen. Rival captains. No fair winds promised.</p></div></div>
                <div class="chart-card"><div class="chart-heading"><span class="eyebrow">THE COURSE</span><span>01 / THE TWIN ISLES</span></div>
                <div class="chart-art"><div class="chart-route"></div><div class="chart-island island-one"></div><div class="chart-island island-two"></div><span class="chart-ship ship-one">${shipIcon('red')}</span><span class="chart-ship ship-two">${shipIcon('blue')}</span><span class="chart-ship ship-three">${shipIcon('yellow')}</span><div class="chart-compass">${COMPASS}</div><span class="chart-sea">THE UNFORGIVING SEA</span></div>
                <div class="chart-caption"><span>Choose your line.<br><strong>Live with the consequences.</strong></span><span class="chart-number">N° 01</span></div></div>
            </section>
            <footer class="harbor-footer"><div><b>01</b><span>Pick your pace<small>Fast water. Tight corners.</small></span></div><div><b>02</b><span>Make your move<small>Find a gap. Or make one.</small></span></div><div><b>03</b><span>Tempt your luck<small>Extra speed has a price.</small></span></div><span class="prototype-note">LOCAL PLAYTEST EDITION</span></footer>`;
        document.querySelector('#app')!.append(root);
        let savedSession: GameSession | null = null;
        let hasStoredSave = false;
        const message = root.querySelector<HTMLElement>('.save-message')!;
        try {
            const text = localStorage.getItem(SAVE_KEY);
            hasStoredSave = text !== null;
            if (text) {
                savedSession = restoreSession(text);
                message.textContent = `Saved race · Round ${savedSession.state.turn} · ${savedSession.state.config.playerCount} captains${savedSession.state.phase === 'finished' ? ' · Finished' : ''}`;
            } else
                message.textContent =
                    'Races save automatically in this browser. Export a file to move between browsers or sites.';
        } catch {
            message.textContent =
                'The browser save could not be loaded. You can import a save file or start a new race.';
        }
        const continueButton =
            root.querySelector<HTMLButtonElement>('.continue-race')!;
        const exportButton =
            root.querySelector<HTMLButtonElement>('.export-race')!;
        continueButton.hidden = !savedSession;
        exportButton.hidden = !savedSession;
        const enterRace = (session: GameSession) => {
            if (starting) return;
            starting = true;
            this.registry.set('session', session);
            this.scene.start('Race');
        };
        const replaceDialog = document.createElement('dialog');
        replaceDialog.className = 'game-dialog';
        replaceDialog.setAttribute('aria-label', 'Replace saved race?');
        replaceDialog.innerHTML =
            '<h2>Replace saved race?</h2><p>Export the current save first if you want to keep a copy.</p><form method="dialog"><button class="secondary" value="cancel" autofocus>Keep saved race</button><button class="primary" value="replace">Replace saved race</button></form>';
        root.append(replaceDialog);
        const replaceAllowed = async (): Promise<boolean> => {
            if (!hasStoredSave) return true;
            if (replaceDialog.open) return false;
            replaceDialog.returnValue = 'cancel';
            replaceDialog.showModal();
            return new Promise((resolve) =>
                replaceDialog.addEventListener(
                    'close',
                    () => resolve(replaceDialog.returnValue === 'replace'),
                    { once: true },
                ),
            );
        };
        continueButton.addEventListener('click', () => {
            if (savedSession) enterRace(savedSession);
        });
        exportButton.addEventListener('click', () => {
            if (savedSession) downloadSave(savedSession.snapshot());
        });
        const fileInput = root.querySelector<HTMLInputElement>('.save-file')!;
        root.querySelector('.import-race')!.addEventListener('click', () =>
            fileInput.click(),
        );
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (!file) return;
            try {
                if (file.size > MAX_SAVE_BYTES)
                    throw new Error('Save file is too large.');
                const session = restoreSession(await file.text());
                if (!root.isConnected || starting) return;
                if (await replaceAllowed()) enterRace(session);
            } catch (error) {
                message.textContent =
                    error instanceof SyntaxError
                        ? 'This file is not valid JSON. Your saved race is unchanged.'
                        : `${error instanceof Error ? error.message : 'Could not import save.'} Your saved race is unchanged.`;
            }
        });
        let players = 4;
        const seats = [
            'human',
            'computer',
            'computer',
            'computer',
            'computer',
            'computer',
        ];
        const renderSeats = () => {
            root.querySelector('.captain-picker')!.innerHTML = seats
                .slice(0, players)
                .map(
                    (kind, index) =>
                        `<label>${DEFAULT_SHIP_COLORS[index]} · P${index + 1}<select data-seat="${index}" aria-label="${DEFAULT_SHIP_COLORS[index]} captain"><option value="human" ${kind === 'human' ? 'selected' : ''}>Human</option><option value="computer" ${kind === 'computer' ? 'selected' : ''}>Computer · Random</option>${PERSONALITIES.map((style) => `<option value="${style}" ${kind === style ? 'selected' : ''}>Computer · ${PERSONALITY_LABELS[style]}</option>`).join('')}</select></label>`,
                )
                .join('');
        };
        root.querySelector('.captain-picker')!.addEventListener(
            'change',
            (event) => {
                const select = event.target as HTMLSelectElement;
                seats[Number(select.dataset.seat)] = select.value;
            },
        );
        renderSeats();
        let starting = false;
        const start = async () => {
            if (starting || !(await replaceAllowed()) || !root.isConnected)
                return;
            starting = true;
            this.registry.set(
                'session',
                createLocalSession(
                    `race-${Date.now()}`,
                    players,
                    Number(
                        root.querySelector<HTMLSelectElement>('#race-laps')!
                            .value,
                    ),
                    seats
                        .slice(0, players)
                        .flatMap((kind, index) =>
                            kind !== 'human' ? [`player-${index + 1}`] : [],
                        ),
                    Object.fromEntries(
                        seats
                            .slice(0, players)
                            .flatMap((kind, index) =>
                                PERSONALITIES.includes(kind as Personality)
                                    ? [
                                          [
                                              `player-${index + 1}`,
                                              kind as Personality,
                                          ],
                                      ]
                                    : [],
                            ),
                    ),
                ),
            );
            this.scene.start('Race');
        };
        root.querySelectorAll<HTMLButtonElement>('[data-players]').forEach(
            (button) => {
                button.addEventListener('click', () => {
                    players = Number(button.dataset.players);
                    renderSeats();
                    root.querySelectorAll('[data-players]').forEach((item) =>
                        item.setAttribute(
                            'aria-pressed',
                            String(item === button),
                        ),
                    );
                });
            },
        );
        root.querySelector('.set-sail')!.addEventListener('click', start);
        const onKey = (event: KeyboardEvent) => {
            if (
                !replaceDialog.open &&
                event.key === 'Enter' &&
                !(event.target instanceof HTMLButtonElement) &&
                !(event.target instanceof HTMLAnchorElement) &&
                !(event.target instanceof HTMLSelectElement)
            )
                start();
        };
        document.addEventListener('keydown', onKey);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            root.remove();
            document.removeEventListener('keydown', onKey);
        });
    }
}
