import { boardingTargets } from '../../src/core/rules/combat';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createRng, type Rng } from '../../src/core/rng/Rng';
import { defaultTrack } from '../../src/core/track/TrackGraph';
import { moveShip, raceStandings } from '../../src/core/rules/race';
import type { GameEvent } from '../../src/core/events/types';
import type { GameState } from '../../src/core/state/GameState';
import * as decks from '../../src/core/cards/decks';

function sail(state: GameState, playerId: string, steps: number) {
    const events: GameEvent[] = [];
    for (let i = 0; i < steps && state.phase !== 'finished'; i++) {
        const id = state.ships[playerId].positionId;
        const lane = id[0];
        const counts: Record<string, number> = { a: 30, b: 36, c: 40, d: 44 };
        const next = `${lane}${(Number(id.slice(1)) % counts[lane]) + 1}`;
        expect(Object.values(defaultTrack.getNode(id).neighbors)).toContain(
            next,
        );
        state = moveShip(state, playerId, next, events);
    }
    return { state, events };
}

function movementState(playerCount = 2) {
    let state = createInitialState('test', { playerCount });
    state = { ...state, phase: 'movement' };
    state.ships['player-1'] = {
        ...state.ships['player-1'],
        chosenSpeed: 3,
        movementRemaining: 3,
    };
    return state;
}

describe('race completion', () => {
    it.each([
        ['a30', 30],
        ['b36', 36],
        ['c40', 40],
        ['d44', 44],
    ] as const)(
        'counts full circuits in lane %s, not the initial crossing',
        (positionId, steps) => {
            let state = createInitialState('laps', { lapsToWin: 2 });
            state.ships['player-1'].positionId = positionId;
            state = sail(state, 'player-1', 1).state;
            expect(state.ships['player-1'].lapsCompleted).toBe(0);
            const lap1 = sail(state, 'player-1', steps);
            expect(lap1.state.ships['player-1'].lapsCompleted).toBe(1);
            expect(
                lap1.events.filter((e) => e.type === 'LAP_COMPLETED'),
            ).toHaveLength(1);
            const lap2 = sail(lap1.state, 'player-1', steps);
            expect(lap2.state.phase).toBe('finished');
            expect(lap2.state.winnerId).toBe('player-1');
            expect(lap2.state.finishReason).toBe('laps');
        },
    );

    it('does not count a central-channel shortcut or repeated finish crossings', () => {
        let state = createInitialState('shortcut');
        const events: GameEvent[] = [];
        for (const to of [
            'a1',
            'a2',
            'a3',
            'x1',
            'x5',
            'x9',
            'x8',
            'a22',
            'a23',
            'a24',
            'a25',
            'a26',
            'a27',
            'a28',
            'a29',
            'a30',
            'a1',
        ]) {
            expect(
                Object.values(
                    defaultTrack.getNode(state.ships['player-1'].positionId)
                        .neighbors,
                ),
            ).toContain(to);
            state = moveShip(state, 'player-1', to, events);
        }
        expect(state.ships['player-1'].lapsCompleted).toBe(0);
        state = moveShip(state, 'player-1', 'a30', events);
        state = moveShip(state, 'player-1', 'a1', events);
        expect(state.ships['player-1'].lapsCompleted).toBe(0);
    });

    it('awards a final lap on a lane-changing crossing and ignores all subsequent commands', () => {
        let state = movementState();
        state.config.lapsToWin = 1;
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            positionId: 'a30',
            hasStarted: true,
            nextCheckpoint: 3,
        };
        state.ships['player-2'].positionId = 'b10';
        const result = reduce(
            state,
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'laneOut' },
            createRng('win'),
        );
        expect(result.state.winnerId).toBe('player-1');
        expect(result.state.activePlayerId).toBeNull();
        expect(result.events.filter((e) => e.type === 'RACE_WON')).toHaveLength(
            1,
        );
        const later = reduce(
            result.state,
            { type: 'END_TURN' },
            createRng('later'),
        );
        expect(later.state).toBe(result.state);
        expect(later.events).toEqual([]);
    });

    it('counts a forced finish crossing once, then requires all gates again', () => {
        let state = movementState();
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            positionId: 'a30',
            nextCheckpoint: 3,
            hasStarted: true,
            corneringChecksRemaining: 1,
        };
        vi.spyOn(decks, 'drawCornering').mockReturnValue('drift1');
        state = reduce(
            state,
            { type: 'RESOLVE_CORNERING', playerId: 'player-1' },
            createRng('finish-drift'),
        ).state;
        vi.restoreAllMocks();
        expect(state.ships['player-1'].positionId).toBe('b1');
        expect(state.ships['player-1'].lapsCompleted).toBe(1);
        const events: GameEvent[] = [];
        state = moveShip(state, 'player-1', 'a30', events);
        state = moveShip(state, 'player-1', 'b1', events);
        expect(state.ships['player-1'].lapsCompleted).toBe(1);
        expect(events.some((e) => e.type === 'LAP_COMPLETED')).toBe(false);
    });

    it('ranks the starting grid and actual progress without treating outside lanes as nearly a lap ahead', () => {
        let state = createInitialState('order', { playerCount: 2 });
        expect(raceStandings(state)[0].id).toBe('player-1');
        state = sail(state, 'player-2', 3).state;
        expect(raceStandings(state)[0].id).toBe('player-2');
        state.ships['player-2'].destroyed = true;
        expect(raceStandings(state)[0].id).toBe('player-1');
    });
});

describe('turn safety', () => {
    it('keeps a blocked rear ram finite and never stacks surviving ships', () => {
        const state = movementState();
        state.ships['player-1'].positionId = 'a1';
        state.ships['player-2'].positionId = 'a2';
        const result = reduce(
            state,
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'forward' },
            createRng('ram-last-move'),
        );
        expect(result.events.filter((e) => e.type === 'RAMMING')).toHaveLength(
            1,
        );
        expect(result.state.ships['player-1'].positionId).not.toBe(
            result.state.ships['player-2'].positionId,
        );
        expect(result.state.ships['player-1'].movementRemaining).toBe(2);
    });

    it('does not debit a displaced rival’s movement budget', () => {
        const state = movementState(3);
        state.ships['player-1'].positionId = 'a1';
        state.ships['player-2'].positionId = 'a2';
        state.ships['player-3'].positionId = 'b2';
        state.ships['player-2'].movementRemaining = 5;
        const result = reduce(
            state,
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'forward' },
            createRng('chain-left'),
        );
        expect(result.state.ships['player-2'].movementRemaining).toBe(5);
        const moves = result.events.filter(
            (e) => e.type === 'SHIP_MOVED' && e.playerId === 'player-2',
        );
        expect(moves).toHaveLength(1);
    });

    it('can pass a zero-speed ship with no flogging attempts', () => {
        let state = createInitialState('no-speed', {
            playerCount: 2,
            flogAttemptsPerTurn: 0,
        });
        state.ships['player-1'].maxSpeed = 0;
        const rng = createRng('no-speed');
        state = reduce(
            state,
            {
                type: 'SUBMIT_TURN_INPUT',
                playerId: 'player-1',
                input: { speed: 0, moves: [] },
            },
            rng,
        ).state;
        state = reduce(
            state,
            { type: 'FLOG_DECISION', playerId: 'player-1', flog: false },
            rng,
        ).state;
        expect(state.activePlayerId).toBe('player-2');
    });

    it('rejects non-finite speed and forces mutinous captains straight ahead', () => {
        let state = createInitialState('invalid-speed');
        const rng = createRng('invalid-speed');
        expect(
            reduce(
                state,
                {
                    type: 'SUBMIT_TURN_INPUT',
                    playerId: 'player-1',
                    input: { speed: NaN, moves: [] },
                },
                rng,
            ).state,
        ).toBe(state);
        state.ships['player-1'].rowers.temperament = 'mutiny';
        state = reduce(
            state,
            {
                type: 'SUBMIT_TURN_INPUT',
                playerId: 'player-1',
                input: { speed: 1, moves: [] },
            },
            rng,
        ).state;
        expect(
            reduce(
                state,
                {
                    type: 'CHOOSE_MOVE',
                    playerId: 'player-1',
                    direction: 'laneOut',
                },
                rng,
            ).state,
        ).toBe(state);
    });

    it('rejects out-of-turn moves, backwards moves, extra movement, and flogging before movement ends', () => {
        const state = movementState();
        const rng = createRng('invalid');
        for (const action of [
            { type: 'CHOOSE_MOVE', playerId: 'player-2', direction: 'forward' },
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'rear' },
            { type: 'FLOG_DECISION', playerId: 'player-1', flog: true },
        ] as const)
            expect(reduce(state, action, rng).state).toBe(state);
        state.ships['player-1'].movementRemaining = 0;
        expect(
            reduce(
                state,
                {
                    type: 'CHOOSE_MOVE',
                    playerId: 'player-1',
                    direction: 'forward',
                },
                rng,
            ).state,
        ).toBe(state);
    });

    it('skips an eliminated first captain at the beginning of a round', () => {
        const state = createInitialState('skip', { playerCount: 3 });
        state.phase = 'combat';
        state.ships['player-1'].destroyed = true;
        const next = reduce(
            state,
            { type: 'END_TURN' },
            createRng('skip'),
        ).state;
        expect(next.phase).toBe('input');
        expect(next.activePlayerId).toBe('player-2');
    });

    it('passes forward when the active captain wrecks during flogging, without restarting the round', () => {
        const state = movementState(4);
        state.activePlayerId = 'player-2';
        const ship = state.ships['player-2'];
        ship.movementRemaining = 0;
        ship.hull.front = 0;
        ship.hull.structure = 1;
        vi.spyOn(decks, 'drawFlogging').mockReturnValue('damage3Front');
        const result = reduce(
            state,
            { type: 'FLOG_DECISION', playerId: 'player-2', flog: true },
            createRng('wreck'),
        );
        vi.restoreAllMocks();
        expect(result.state.ships['player-2'].destroyed).toBe(true);
        expect(result.state.activePlayerId).toBe('player-3');
        expect(result.state.phase).toBe('input');
    });

    it('finishes when the last rival is wrecked without survivors', () => {
        const state = movementState();
        state.ships['player-1'].crew = { captainHp: 0, boarderHp: 0 };
        state.ships['player-1'].movementRemaining = 0;
        state.ships['player-1'].hull.front = 0;
        state.ships['player-1'].hull.structure = 1;
        vi.spyOn(decks, 'drawFlogging').mockReturnValue('damage3Front');
        const result = reduce(
            state,
            { type: 'FLOG_DECISION', playerId: 'player-1', flog: true },
            createRng('wreck'),
        );
        vi.restoreAllMocks();
        expect(result.state.winnerId).toBe('player-2');
        expect(result.state.finishReason).toBe('last_ship');
    });

    it('ends in a draw when a ram wrecks both remaining ships', () => {
        const state = movementState();
        state.ships['player-1'].positionId = 'a1';
        state.ships['player-2'].positionId = 'a2';
        for (const ship of Object.values(state.ships))
            ship.hull = { front: 0, rear: 0, left: 0, right: 0, structure: 1 };
        const result = reduce(
            state,
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'forward' },
            createRng('draw'),
        );
        expect(result.state.phase).toBe('finished');
        expect(result.state.winnerId).toBeNull();
        expect(result.state.finishReason).toBe('all_wrecked');
    });

    it('resolves cornering without replenishing checks on every drift', () => {
        const state = movementState();
        state.ships['player-1'] = {
            ...state.ships['player-1'],
            positionId: 'b12',
            chosenSpeed: 7,
        };
        const draw = vi.spyOn(decks, 'drawCornering').mockReturnValue('drift1');
        const result = reduce(
            state,
            { type: 'CHOOSE_MOVE', playerId: 'player-1', direction: 'forward' },
            createRng('drift'),
        );
        expect(draw.mock.calls.length).toBeLessThanOrEqual(2);
        expect(result.state.ships['player-1'].corneringChecksRemaining).toBe(0);
        expect(result.state.ships['player-1'].movementRemaining).toBe(2);
        vi.restoreAllMocks();
    });
});

function playRace(
    seed: string,
    playerCount: number,
    lapsToWin = 1,
    separated = false,
): { state: GameState; actions: number } {
    let state = createInitialState(seed, {
        playerCount,
        lapsToWin,
        ...(separated ? { startingPositions: ['a30', 'd44'] } : {}),
    });
    const rng: Rng = createRng(seed);
    let actions = 0;
    for (; actions < 3000 && state.phase !== 'finished'; actions++) {
        const ship = state.activePlayerId
            ? state.ships[state.activePlayerId]
            : null;
        if (state.phase === 'input' && ship) {
            state = reduce(
                state,
                {
                    type: 'SUBMIT_TURN_INPUT',
                    playerId: ship.id,
                    input: { speed: 3, moves: [] },
                },
                rng,
            ).state;
        } else if (state.phase === 'movement' && ship) {
            if (ship.movementRemaining > 0) {
                const direction =
                    defaultTrack.isWall(
                        defaultTrack.neighbor(ship.positionId, 'forward'),
                    ) && ship.rowers.temperament !== 'mutiny'
                        ? 'laneOut'
                        : 'forward';
                state = reduce(
                    state,
                    { type: 'CHOOSE_MOVE', playerId: ship.id, direction },
                    rng,
                ).state;
            } else {
                state = reduce(
                    state,
                    { type: 'FLOG_DECISION', playerId: ship.id, flog: false },
                    rng,
                ).state;
            }
        } else if (state.phase === 'crew') {
            state = reduce(state, { type: 'CREW_WAIT', crewId: state.activeCrewId! }, rng).state;
        } else if (state.phase === 'combat') {
            state = ship
                ? reduce(
                      state,
                      actions % 2 === 0
                          ? {
                                type: 'DECLARE_ATTACK',
                                attackerId: ship.id,
                                targetId: boardingTargets(state, ship.id)[0],
                            }
                          : { type: 'PASS_ATTACK', attackerId: ship.id },
                      rng,
                  ).state
                : reduce(state, { type: 'END_TURN' }, rng).state;
        } else throw new Error(`Stuck in ${state.phase} at action ${actions}`);
        if (state.activePlayerId)
            expect(state.ships[state.activePlayerId].destroyed).toBe(false);
        for (const racer of Object.values(state.ships))
            expect(racer.movementRemaining).toBeGreaterThanOrEqual(0);
    }
    return { state, actions };
}

describe('complete seeded races', () => {
    it('plays a full three-lap cup to a lap victory through the reducer', () => {
        vi.spyOn(decks, 'drawCornering').mockReturnValue('hold');
        const { state } = playRace('three-lap-cup', 2, 3, true);
        vi.restoreAllMocks();
        expect(state.finishReason).toBe('laps');
        expect(state.ships[state.winnerId!].lapsCompleted).toBe(3);
    });
    it.each([2, 3, 4, 5, 6])(
        'finishes %i-player races across ten seeds without a dead turn',
        (playerCount) => {
            for (let seed = 0; seed < 10; seed++) {
                const result = playRace(`race-${seed}`, playerCount);
                expect(result.actions).toBeLessThan(3000);
                expect(result.state.phase).toBe('finished');
                expect(result.state.finishReason).not.toBeNull();
                if (result.state.winnerId)
                    expect(
                        result.state.ships[result.state.winnerId].destroyed,
                    ).toBe(false);
            }
        },
    );
});
