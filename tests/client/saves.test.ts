import { afterEach, expect, it, vi } from 'vitest';
import {
    createLocalSession,
    restoreSession,
} from '../../src/client/GameSession';
import { chooseComputerAction } from '../../src/core/ai/Captain';
import { downloadSave, parseSave, SAVE_KEY, writeSave } from '../../src/client/RaceSave';

afterEach(() => vi.unstubAllGlobals());

it('restores every action of complete races, including the next random results', () => {
    const phases = new Set<string>();
    const events = new Set<string>();
    for (const seed of ['save-1', 'save-2', 'save-3']) {
        let session = createLocalSession(seed, 4, 3, ['player-2', 'player-4']);
        for (let i = 0; i < 5000 && session.state.phase !== 'finished'; i++) {
            phases.add(session.state.phase);
            const restored = restoreSession(JSON.stringify(session.snapshot()));
            expect(restored.state).toEqual(session.state);
            expect(restored.computerCaptains).toEqual(['player-2', 'player-4']);
            const action = chooseComputerAction(session.state)!;
            const outcome = session.dispatch(action);
            outcome.forEach((event) => events.add(event.type));
            expect(restored.dispatch(action)).toEqual(outcome);
            expect(restored.state).toEqual(session.state);
            session = restored;
        }
        expect(session.state.phase).toBe('finished');
        expect(
            restoreSession(JSON.stringify(session.snapshot())).state,
        ).toEqual(session.state);
    }
    expect(phases).toEqual(new Set(['input', 'movement', 'crew', 'combat']));
    expect(events.has('MUTINY_STARTED')).toBe(true);
    expect(events.has('CORNERING_DRAWN')).toBe(true);
}, 30000);

it('rejects malformed, oversized, incompatible and invalid action saves', () => {
    const save = createLocalSession('safe', 2, 1).snapshot();
    for (const text of [
        '{',
        'null',
        JSON.stringify({ ...save, version: 99 }),
        JSON.stringify({ ...save, playerCount: 100 }),
        JSON.stringify({
            ...save,
            actions: [
                {
                    type: 'CHOOSE_MOVE',
                    playerId: 'player-1',
                    direction: 'bogus',
                },
            ],
        }),
        JSON.stringify({
            ...save,
            actions: [
                {
                    type: 'SUBMIT_TURN_INPUT',
                    playerId: 'player-1',
                    input: { speed: 999, moves: [] },
                },
            ],
        }),
        ' '.repeat(2_000_001),
    ]) {
        expect(() => parseSave(text)).toThrow();
    }
});

it('autosaves post-action state, leaves previous data intact on failure, and detaches cleanly', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        setItem: (key: string, value: string) => data.set(key, value),
    });
    const session = createLocalSession('autosave', 2, 1);
    session.setSaveHandler(() =>
        expect(writeSave(session.snapshot())).toBe(true),
    );
    session.dispatch({
        type: 'SUBMIT_TURN_INPUT',
        playerId: 'player-1',
        input: { speed: 3, moves: [] },
    });
    const stored = data.get(SAVE_KEY)!;
    expect(restoreSession(stored).state).toEqual(session.state);
    session.setSaveHandler(null);
    session.dispatch({
        type: 'CHOOSE_MOVE',
        playerId: 'player-1',
        direction: 'forward',
    });
    expect(data.get(SAVE_KEY)).toBe(stored);
    vi.stubGlobal('localStorage', {
        setItem: () => {
            throw new Error('Quota exceeded');
        },
    });
    expect(writeSave(session.snapshot())).toBe(false);
    expect(data.get(SAVE_KEY)).toBe(stored);
});


it('exports a JSON download that restores the same race', async () => {
    const session = createLocalSession('export', 2, 1, ['player-2']);
    session.dispatch({type: 'SUBMIT_TURN_INPUT', playerId: 'player-1', input: {speed: 4, moves: []}});
    let file: Blob | undefined;
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', {createElement: () => link, body: {append: vi.fn()}});
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {file = blob as Blob; return 'blob:test';});
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
        downloadSave(session.snapshot());
        expect(link.download).toBe('pirate-cup-save.json');
        expect(link.href).toBe('blob:test');
        expect(link.click).toHaveBeenCalledOnce();
        expect(file!.type).toBe('application/json');
        expect(restoreSession(await file!.text()).state).toEqual(session.state);
        vi.runAllTimers();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    } finally {
        vi.useRealTimers();
        vi.restoreAllMocks();
    }
});
