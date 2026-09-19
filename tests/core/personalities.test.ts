import { expect, it } from 'vitest';
import { chooseComputerAction, evaluateRam } from '../../src/core/ai/Captain';
import {
    PERSONALITIES,
    assignPersonalities,
} from '../../src/core/ai/Personality';
import {
    createLocalSession,
    restoreSession,
} from '../../src/client/GameSession';
import { createInitialState } from '../../src/core/state/GameState';

it('assigns a reproducible variety independently of colors and keeps explicit choices', () => {
    const ids = ['player-1', 'player-2', 'player-3', 'player-4'];
    const assigned = assignPersonalities('fleet', ids);
    expect(new Set(Object.values(assigned)).size).toBe(4);
    expect(assignPersonalities('fleet', ids)).toEqual(assigned);
    expect(
        assignPersonalities('fleet', ids, { 'player-1': 'bruiser' })[
            'player-1'
        ],
    ).toBe('bruiser');
});

it('values exposed enemy hulls and rejects fatal self-damage for every style', () => {
    const state = createInitialState('ram', { playerCount: 2 });
    const a = state.ships['player-1'];
    const b = state.ships['player-2'];
    a.positionId = 'a30';
    b.positionId = 'a1';
    const healthy = evaluateRam(a, b, 'bruiser');
    b.hull.rear = 0;
    b.hull.structure = 5;
    expect(evaluateRam(a, b, 'bruiser')).toBeGreaterThan(healthy);
    expect(evaluateRam(a, b, 'bruiser')).toBeGreaterThan(
        evaluateRam(a, b, 'racer'),
    );
    a.rowers.hp = 4;
    for (const style of PERSONALITIES)
        expect(evaluateRam(a, b, style)).toBeLessThan(-100);
});

it('uses the captain personality after a vessel changes hands', () => {
    const state = createInitialState('ownership', { playerCount: 2 });
    const ship = state.ships['player-1'];
    ship.ownerId = 'player-2';
    state.phase = 'movement';
    ship.movementRemaining = 0;
    ship.flogAttemptsRemaining = state.config.flogAttemptsPerTurn - 1;
    expect(
        chooseComputerAction(state, {
            'player-1': 'racer',
            'player-2': 'daredevil',
        }),
    ).toMatchObject({ type: 'FLOG_DECISION', flog: true });
    expect(
        chooseComputerAction(state, {
            'player-1': 'daredevil',
            'player-2': 'racer',
        }),
    ).toMatchObject({ type: 'FLOG_DECISION', flog: false });
});

it('completes mixed and single-style races with legal moves, preserving styles and RNG on restore', () => {
    let collisions = 0;
    for (const style of [...PERSONALITIES, 'mixed'] as const) {
        for (const count of [2, 4, 6]) {
            const ids = Array.from(
                { length: count },
                (_, i) => `player-${i + 1}`,
            );
            const session = createLocalSession(
                `personality-${style}-${count}`,
                count,
                3,
                ids,
                style === 'mixed'
                    ? {}
                    : Object.fromEntries(ids.map((id) => [id, style])),
            );
            for (
                let i = 0;
                i < 10000 && session.state.phase !== 'finished';
                i++
            ) {
                const before = JSON.stringify(session.state);
                const action = chooseComputerAction(
                    session.state,
                    session.personalities,
                )!;
                expect(action).not.toBeNull();
                expect(JSON.stringify(session.state)).toBe(before);
                const events = session.dispatch(action);
                collisions += events.filter((e) => e.type === 'RAMMING').length;
                expect(JSON.stringify(session.state)).not.toBe(before);
                if (i % 75 === 0) {
                    const restored = restoreSession(
                        JSON.stringify(session.snapshot()),
                    );
                    expect(restored.state).toEqual(session.state);
                    expect(restored.personalities).toEqual(
                        session.personalities,
                    );
                    const next = chooseComputerAction(
                        session.state,
                        session.personalities,
                    );
                    if (next)
                        expect(restored.dispatch(next)).toEqual(
                            session.dispatch(next),
                        );
                }
                const alive = Object.values(session.state.ships).filter(
                    (ship) => !ship.destroyed,
                );
                expect(new Set(alive.map((ship) => ship.positionId)).size).toBe(
                    alive.length,
                );
            }
            expect(session.state.phase).toBe('finished');
        }
    }
    expect(collisions).toBeGreaterThan(0);
}, 30000);

it('loads older saves without personalities and rejects invalid personality values', () => {
    const save = createLocalSession('old', 2, 1, ['player-2']).snapshot();
    delete save.personalities;
    expect(
        restoreSession(JSON.stringify(save)).personalities['player-2'],
    ).toBeDefined();
    expect(() =>
        restoreSession(
            JSON.stringify({ ...save, personalities: { 'player-2': '<bad>' } }),
        ),
    ).toThrow();
});

it('bruisers choose a useful ram where racers take the clear lane', () => {
    const state = createInitialState('choice', { playerCount: 2 });
    state.phase = 'movement';
    const ship = state.ships['player-1'];
    ship.positionId = 'a30';
    ship.chosenSpeed = 3;
    ship.movementRemaining = 3;
    state.ships['player-2'].positionId = 'a1';
    expect(chooseComputerAction(state, {'player-1': 'bruiser'})).toMatchObject({type: 'CHOOSE_MOVE', direction: 'forward'});
    expect(chooseComputerAction(state, {'player-1': 'racer'})).toMatchObject({type: 'CHOOSE_MOVE', direction: 'laneOut'});
});
