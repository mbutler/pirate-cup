import { describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import {
    beginCrewPhase,
    crewDestinations,
    hijackTargets,
    rescueWreckedCrews,
} from '../../src/core/rules/crew';
import { createRng } from '../../src/core/rng/Rng';
import * as decks from '../../src/core/cards/decks';

function stranded() {
    const state = createInitialState('rescue', { playerCount: 2 });
    state.ships['player-1'].destroyed = true;
    state.ships['player-1'].lapsCompleted = 1;
    state.ships['player-2'].positionId = 'b36';
    return beginCrewPhase(rescueWreckedCrews(state, []));
}

describe('displaced crews and hijacking', () => {
    it('rescues survivors once and keeps the last vessel from winning prematurely', () => {
        const state = createInitialState('wreck', { playerCount: 2 });
        state.phase = 'movement';
        state.ships['player-1'].hull.front = 0;
        state.ships['player-1'].hull.structure = 1;
        vi.spyOn(decks, 'drawFlogging').mockReturnValue('damage3Front');
        const result = reduce(
            state,
            { type: 'FLOG_DECISION', playerId: 'player-1', flog: true },
            createRng('wreck'),
        );
        vi.restoreAllMocks();
        expect(result.state.winnerId).toBeNull();
        expect(result.state.displacedCrew['player-1'].captainHp).toBe(10);
        expect(result.state.ships['player-1'].crew.captainHp).toBe(0);
        expect(rescueWreckedCrews(result.state, [])).toBe(result.state);
        let next = reduce(
            result.state,
            {
                type: 'SUBMIT_TURN_INPUT',
                playerId: 'player-2',
                input: { speed: 0, moves: [] },
            },
            createRng('hold'),
        ).state;
        next = reduce(
            next,
            { type: 'FLOG_DECISION', playerId: 'player-2', flog: false },
            createRng('hold'),
        ).state;
        expect(next.phase).toBe('crew');
        expect(next.activeCrewId).toBe('player-1');
    });
    it('moves once, rejects distant hexes and out-of-turn commands without drawing', () => {
        const state = stranded();
        const rng = createRng('move');
        const draw = vi.spyOn(rng, 'int');
        for (const action of [
            {
                type: 'CREW_MOVE' as const,
                crewId: 'player-1',
                destinationId: 'a15',
            },
            { type: 'CREW_WAIT' as const, crewId: 'player-2' },
            {
                type: 'HIJACK' as const,
                crewId: 'player-1',
                targetId: 'missing',
            },
        ])
            expect(reduce(state, action, rng).state).toBe(state);
        const destinationId = crewDestinations(state, 'player-1')[0];
        const next = reduce(
            state,
            { type: 'CREW_MOVE', crewId: 'player-1', destinationId },
            rng,
        ).state;
        expect(next.displacedCrew['player-1'].positionId).toBe(destinationId);
        expect(next.phase).toBe('combat');
        expect(
            reduce(
                next,
                { type: 'CREW_MOVE', crewId: 'player-1', destinationId },
                rng,
            ).state,
        ).toBe(next);
        expect(draw).not.toHaveBeenCalled();
    });
    it('captures a neighboring vessel, preserves damage and laps, and delays the ejected defender', () => {
        const state = stranded();
        state.ships['player-2'].hull.structure = 7;
        state.ships['player-2'].lapsCompleted = 2;
        const before = structuredClone(state);
        expect(hijackTargets(state, 'player-1')).toContain('player-2');
        const rng = createRng('capture');
        vi.spyOn(rng, 'int').mockReturnValueOnce(10).mockReturnValueOnce(1);
        const next = reduce(
            state,
            { type: 'HIJACK', crewId: 'player-1', targetId: 'player-2' },
            rng,
        ).state;
        expect(state).toEqual(before);
        expect(next.ships['player-2']).toMatchObject({
            ownerId: 'player-1',
            color: 'red',
            lapsCompleted: 1,
            nextCheckpoint: 0,
            hull: { structure: 7 },
        });
        expect(next.displacedCrew['player-1']).toBeUndefined();
        expect(next.displacedCrew['player-2']).toMatchObject({
            lapsCompleted: 2,
            actedTurn: state.turn,
        });
        expect(next.phase).toBe('combat');
        const nextRound = reduce(
            next,
            { type: 'END_TURN' },
            createRng('cleanup'),
        ).state;
        expect(beginCrewPhase(nextRound).activeCrewId).toBe('player-2');
    });
    it('defends ties and applies failed-hijack damage captain first', () => {
        const state = stranded();
        state.displacedCrew['player-1'].captainHp = 2;
        state.displacedCrew['player-1'].boarderHp = 10;
        state.ships['player-2'].crew = { captainHp: 2, boarderHp: 10 };
        const rng = createRng('tie');
        vi.spyOn(rng, 'int').mockReturnValue(5);
        const next = reduce(
            state,
            { type: 'HIJACK', crewId: 'player-1', targetId: 'player-2' },
            rng,
        ).state;
        expect(next.displacedCrew['player-1']).toMatchObject({
            captainHp: 0,
            boarderHp: 8,
            positionId: 'b36',
        });
        expect(next.ships['player-2'].ownerId).toBe('player-2');
    });
    it('eliminates a defeated crew and awards survival victory', () => {
        const state = stranded();
        state.displacedCrew['player-1'].captainHp = 1;
        state.displacedCrew['player-1'].boarderHp = 0;
        const next = reduce(
            state,
            { type: 'HIJACK', crewId: 'player-1', targetId: 'player-2' },
            createRng('loss'),
        ).state;
        expect(next.displacedCrew).toEqual({});
        expect(next.finishReason).toBe('last_ship');
        expect(next.winnerId).toBe('player-2');
    });
    it('can retire rather than keeping the last opponent waiting', () => {
        const next = reduce(
            stranded(),
            { type: 'CREW_RETIRE', crewId: 'player-1' },
            createRng('retire'),
        ).state;
        expect(next.finishReason).toBe('last_ship');
        expect(next.activeCrewId).toBeNull();
    });
    it('allows a surviving boarder to take the helm and rescues them again if the captured ship sinks', () => {
        const state = stranded();
        state.displacedCrew['player-1'].captainHp = 0;
        state.ships['player-2'].crew = { captainHp: 0, boarderHp: 0 };
        const rng = createRng('boarder');
        vi.spyOn(rng, 'int').mockReturnValue(5);
        const next = reduce(
            state,
            { type: 'HIJACK', crewId: 'player-1', targetId: 'player-2' },
            rng,
        ).state;
        expect(next.ships['player-2'].ownerId).toBe('player-1');
        next.ships['player-2'].destroyed = true;
        expect(
            rescueWreckedCrews(next, []).displacedCrew['player-1'].boarderHp,
        ).toBe(10);
    });
});
