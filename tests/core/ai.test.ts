import { expect, it } from 'vitest';
import { chooseComputerAction } from '../../src/core/ai/Captain';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createRng } from '../../src/core/rng/Rng';
import { beginCrewPhase, rescueWreckedCrews } from '../../src/core/rules/crew';
import {
    createLocalSession,
    isComputerTurn,
} from '../../src/client/GameSession';

it('plays complete computer races at every fleet size and race distance', () => {
    for (const playerCount of [2, 3, 4, 5, 6])
        for (const lapsToWin of [1, 2, 3])
            for (let seed = 0; seed < 5; seed++) {
                let state = createInitialState(`ai-${seed}`, {
                    playerCount,
                    lapsToWin,
                });
                const rng = createRng(`ai-${seed}`);
                let actions = 0;
                while (state.phase !== 'finished' && actions++ < 10000) {
                    const before = JSON.stringify(state);
                    const action = chooseComputerAction(state);
                    expect(JSON.stringify(state)).toBe(before);
                    expect(action).not.toBeNull();
                    const next = reduce(state, action!, rng).state;
                    expect(
                        next,
                        `${JSON.stringify(action)} round ${state.turn}`,
                    ).not.toBe(state);
                    state = next;
                    const alive = Object.values(state.ships).filter(
                        (s) => !s.destroyed,
                    );
                    expect(new Set(alive.map((s) => s.positionId)).size).toBe(
                        alive.length,
                    );
                    const owners = [
                        ...alive.map((s) => s.ownerId),
                        ...Object.keys(state.displacedCrew),
                    ];
                    expect(new Set(owners).size).toBe(owners.length);
                }
                expect(
                    state.phase,
                    `seed ${seed}, players ${playerCount}, laps ${lapsToWin}`,
                ).toBe('finished');
            }
}, 30000);

it('takes a reachable hijack and otherwise rows toward vessels', () => {
    let state = createInitialState('rescue', { playerCount: 2 });
    state.ships['player-1'].destroyed = true;
    state = beginCrewPhase(rescueWreckedCrews(state, []));
    expect(chooseComputerAction(state)).toEqual({
        type: 'HIJACK',
        crewId: 'player-1',
        targetId: 'player-2',
    });
    state.ships['player-2'].positionId = 'b15';
    expect(chooseComputerAction(state)?.type).toBe('CREW_MOVE');
});

it('assigns control by captain ownership after capture and preserves local defaults', () => {
    const session = createLocalSession('ownership', 2, 1, ['player-2']);
    expect(isComputerTurn(session)).toBe(false);
    session.state.ships['player-1'].ownerId = 'player-2';
    expect(isComputerTurn(session)).toBe(true);
    session.state.phase = 'crew';
    session.state.activeCrewId = 'player-1';
    expect(isComputerTurn(session)).toBe(false);
    session.state.activeCrewId = 'player-2';
    expect(isComputerTurn(session)).toBe(true);
    expect(createLocalSession('local').computerCaptains).toEqual([]);
});

it('slows before corners and steers only forward during a mutiny', async () => {
    const { defaultTrack } = await import('../../src/core/track/TrackGraph');
    const state = createInitialState('corner', { playerCount: 2 });
    const ship = state.ships['player-1'];
    const beforeCorner = [...defaultTrack.nodes.values()].find((node) => {
        const next = node.neighbors.forward;
        return next !== 'wall' && (defaultTrack.safeSpeedAt(next) ?? 99) < 8;
    })!;
    ship.positionId = beforeCorner.id;
    const action = chooseComputerAction(state);
    expect(action?.type).toBe('SUBMIT_TURN_INPUT');
    if (action?.type === 'SUBMIT_TURN_INPUT')
        expect(action.input.speed).toBeLessThanOrEqual(
            defaultTrack.safeSpeedAt(beforeCorner.neighbors.forward)!,
        );
    state.phase = 'movement';
    ship.movementRemaining = 3;
    ship.rowers.temperament = 'mutiny';
    expect(chooseComputerAction(state)).toEqual({
        type: 'CHOOSE_MOVE',
        playerId: ship.id,
        direction: 'forward',
    });
});
