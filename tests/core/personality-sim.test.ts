import { expect, it } from 'vitest';
import { STYLES } from '../../src/core/ai/Personality';
import {
    chooseComputerAction,
    styleInContext,
} from '../../src/core/ai/Captain';
import { createInitialState } from '../../src/core/state/GameState';
import {
    defaultBenchmarkConfig,
    formatPersonalityReport,
    runComputerRace,
    runPersonalityBenchmark,
} from '../../src/core/ai/simulate';

it('completes a mixed-field computer race with assigned personalities', () => {
    const race = runComputerRace({
        seed: 'sim-smoke',
        playerCount: 4,
        lapsToWin: 1,
    });
    expect(race.truncated).toBe(false);
    expect(race.finishReason).not.toBeNull();
    expect(Object.keys(race.personalities)).toHaveLength(4);
});

it('lets custom style weights override a named personality', () => {
    const state = createInitialState('choice', { playerCount: 2 });
    state.phase = 'movement';
    const ship = state.ships['player-1'];
    ship.positionId = 'a30';
    ship.chosenSpeed = 3;
    ship.movementRemaining = 3;
    state.ships['player-2'].positionId = 'a1';
    expect(
        chooseComputerAction(
            state,
            { 'player-1': 'racer' },
            { 'player-1': STYLES.bruiser },
        ),
    ).toMatchObject({ type: 'CHOOSE_MOVE', direction: 'forward' });
});

it('prints a compact mixed-field personality report', () => {
    const report = runPersonalityBenchmark(
        defaultBenchmarkConfig({
            seeds: 1,
            playerCounts: [2],
            laps: [1],
            prefix: 'sim-test',
            duels: 1,
        }),
    );
    expect(report.races).toHaveLength(1);
    expect(report.truncated).toBe(0);
    expect(report.personalities.some((row) => row.racesPresent > 0)).toBe(true);
    const text = formatPersonalityReport(report);
    expect(text).toContain('Personality simulation');
    expect(text).toContain('Slots');
    expect(text).toContain('vs expected');
});

it('tightens the line when leading and refuses to push a wrecked hull', () => {
    const state = createInitialState('context', { playerCount: 2, lapsToWin: 3 });
    const ship = state.ships['player-1'];
    const leading = styleInContext(STYLES.daredevil, state, ship);
    expect(leading.attack).toBeLessThan(STYLES.daredevil.attack);
    expect(leading.pushes).toBeLessThan(STYLES.daredevil.pushes);
    ship.hull.structure = 8;
    const hurt = styleInContext(STYLES.daredevil, state, ship);
    expect(hurt.overspeed).toBe(0);
    expect(hurt.pushes).toBe(0);
});
