import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import {
    beginCombat,
    boardingTargets,
    queueAttack,
    resolveCombatPhase,
} from '../../src/core/rules/combat';
import { createRng } from '../../src/core/rng/Rng';

function encounter(playerCount = 2) {
    const state = createInitialState('boarding', { playerCount });
    state.ships['player-1'].positionId = 'a1';
    state.ships['player-2'].positionId = 'a2';
    if (state.ships['player-3']) state.ships['player-3'].positionId = 'b2';
    return beginCombat(state);
}

describe('boarding', () => {
    it('offers adjacent opponents in either direction but not distant ships or self', () => {
        const state = encounter(3);
        state.ships['player-3'].positionId = 'd20';
        expect(boardingTargets(state, 'player-1')).toEqual(['player-2']);
        expect(boardingTargets(state, 'player-2')).toEqual(['player-1']);
        expect(boardingTargets(state, 'player-3')).toEqual([]);
    });

    it('excludes wrecks and defeated boarders, but allows mutinous ships to fight', () => {
        const state = encounter(3);
        state.ships['player-1'].rowers.temperament = 'mutiny';
        state.ships['player-2'].destroyed = true;
        state.ships['player-3'].crew.boarderHp = 0;
        expect(boardingTargets(state, 'player-1')).toEqual([]);
        expect(boardingTargets(state, 'player-3')).toEqual([]);
        state.ships['player-2'].destroyed = false;
        expect(boardingTargets(state, 'player-1')).toEqual(['player-2']);
    });

    it('locks one attack or pass per eligible captain and prevents early resolution', () => {
        const state = encounter();
        const rng = createRng('orders');
        expect(reduce(state, { type: 'END_TURN' }, rng).state).toBe(state);
        expect(reduce(state, { type: 'RESOLVE_COMBAT' }, rng).state).toBe(
            state,
        );
        expect(queueAttack(state, 'player-2', 'player-1')).toBe(state);
        expect(queueAttack(state, 'player-1', 'player-1')).toBe(state);
        let next = reduce(
            state,
            {
                type: 'DECLARE_ATTACK',
                attackerId: 'player-1',
                targetId: 'player-2',
            },
            rng,
        ).state;
        expect(next.activePlayerId).toBe('player-2');
        expect(next.ships['player-2'].crew.boarderHp).toBe(10);
        expect(queueAttack(next, 'player-1', null)).toBe(next);
        next = reduce(
            next,
            { type: 'PASS_ATTACK', attackerId: 'player-2' },
            rng,
        ).state;
        expect(next.activePlayerId).toBeNull();
        const resolved = reduce(next, { type: 'END_TURN' }, rng);
        expect(resolved.state.turn).toBe(2);
        expect(resolved.state.phase).toBe('input');
        expect(resolved.state.pendingCombat).toEqual([]);
        expect(resolved.state.ships['player-1'].crew.boarderHp).toBe(10);
        expect(resolved.state.ships['player-2'].crew.boarderHp).toBe(6);
    });

    it('rejects attacks outside combat, against invalid targets, and after the race ends', () => {
        const state = encounter(3);
        state.ships['player-3'].positionId = 'd20';
        expect(queueAttack(state, 'player-1', 'player-3')).toBe(state);
        expect(queueAttack(state, 'player-1', 'missing')).toBe(state);
        for (const phase of ['input', 'movement', 'finished'] as const) {
            const other = { ...state, phase };
            expect(
                reduce(
                    other,
                    {
                        type: 'DECLARE_ATTACK',
                        attackerId: 'player-1',
                        targetId: 'player-2',
                    },
                    createRng('invalid'),
                ).state,
            ).toBe(other);
        }
    });

    it('lands both lethal strikes simultaneously regardless of declaration order', () => {
        const state = encounter();
        state.ships['player-1'].crew.boarderHp = 4;
        state.ships['player-2'].crew.boarderHp = 4;
        state.pendingCombat = [
            { attackerId: 'player-1', targetId: 'player-2' },
            { attackerId: 'player-2', targetId: 'player-1' },
        ];
        const forward = resolveCombatPhase(state);
        const reverse = resolveCombatPhase({
            ...state,
            pendingCombat: [...state.pendingCombat].reverse(),
        });
        expect(forward.state.ships).toEqual(reverse.state.ships);
        expect(
            forward.events.filter((e) => e.type === 'COMBAT_RESOLVED'),
        ).toHaveLength(2);
        expect(
            forward.events.filter((e) => e.type === 'BOARDER_DEFEATED'),
        ).toHaveLength(2);
        expect(forward.state.ships['player-1'].crew.boarderHp).toBe(0);
        expect(forward.state.ships['player-2'].crew.boarderHp).toBe(0);
        expect(forward.state.ships['player-1'].destroyed).toBe(false);
        expect(state.ships['player-1'].crew.boarderHp).toBe(4);
    });

    it('accumulates multiple strikes while preserving the defender’s locked attack', () => {
        const state = encounter(3);
        state.ships['player-2'].crew.boarderHp = 6;
        let next = queueAttack(state, 'player-1', 'player-2');
        next = queueAttack(next, 'player-2', 'player-1');
        next = queueAttack(next, 'player-3', 'player-2');
        const result = resolveCombatPhase(next);
        expect(result.state.ships['player-2'].crew.boarderHp).toBe(0);
        expect(result.state.ships['player-1'].crew.boarderHp).toBe(6);
        expect(
            result.events.filter((e) => e.type === 'BOARDER_DEFEATED'),
        ).toHaveLength(1);
    });

    it('skips captains without targets and allows an all-pass round', () => {
        const state = encounter(3);
        state.ships['player-1'].crew.boarderHp = 0;
        let next = beginCombat(state);
        expect(next.activePlayerId).toBe('player-2');
        next = queueAttack(next, 'player-2', null);
        next = queueAttack(next, 'player-3', null);
        expect(next.activePlayerId).toBeNull();
        const result = resolveCombatPhase(next);
        expect(result.events).toEqual([]);
        expect(result.state.ships).toEqual(state.ships);
    });

    it('enters boarding automatically after the last ship’s movement turn', () => {
        let state = createInitialState('whole-round', { playerCount: 2 });
        const rng = createRng('whole-round');
        for (const id of ['player-1', 'player-2']) {
            state = reduce(
                state,
                {
                    type: 'SUBMIT_TURN_INPUT',
                    playerId: id,
                    input: { speed: 0, moves: [] },
                },
                rng,
            ).state;
            state = reduce(
                state,
                { type: 'FLOG_DECISION', playerId: id, flog: false },
                rng,
            ).state;
        }
        expect(state.phase).toBe('combat');
        expect(state.activePlayerId).toBe('player-1');
        state = reduce(
            state,
            {
                type: 'DECLARE_ATTACK',
                attackerId: 'player-1',
                targetId: 'player-2',
            },
            rng,
        ).state;
        state = reduce(
            state,
            {
                type: 'DECLARE_ATTACK',
                attackerId: 'player-2',
                targetId: 'player-1',
            },
            rng,
        ).state;
        state = reduce(state, { type: 'RESOLVE_COMBAT' }, rng).state;
        expect(state.turn).toBe(2);
        expect(state.ships['player-1'].crew.boarderHp).toBe(6);
        expect(state.ships['player-2'].crew.boarderHp).toBe(6);
    });
});
