import { describe, expect, it, vi } from 'vitest';
import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createRng } from '../../src/core/rng/Rng';
import { helmSkill, hijackChance } from '../../src/core/rules/crewSkill';
import {
    markFrenzy,
    resolveCleanupPhase,
    rollFrenzyCooldown,
} from '../../src/core/rules/frenzy';
import { applyHullDamage, applyMastDamage } from '../../src/core/rules/damage';
import * as decks from '../../src/core/cards/decks';

describe('comeback balance and disabled vessels', () => {
    it('keeps hijacking uncertain across every surviving health combination', () => {
        const full = { captainHp: 10, boarderHp: 10 };
        expect(hijackChance(full, full)).toBe(45);
        for (let captainHp = 0; captainHp <= 10; captainHp++)
            for (let boarderHp = 0; boarderHp <= 10; boarderHp++) {
                if (!captainHp && !boarderHp) continue;
                const wounded = { captainHp, boarderHp };
                expect(hijackChance(wounded, full)).toBeGreaterThan(0);
                expect(hijackChance(full, wounded)).toBeLessThan(100);
            }
    });
    it('uses skill, wounds and a surviving replacement when recovering control', () => {
        const state = createInitialState('recovery');
        const ship = markFrenzy(state.ships['player-1']);
        const rng = createRng('recovery');
        vi.spyOn(rng, 'int').mockReturnValue(9);
        expect(rollFrenzyCooldown(ship, rng)).toMatchObject({
            skill: 8,
            calmed: false,
        });
        vi.mocked(rng.int).mockReturnValue(8);
        expect(rollFrenzyCooldown(ship, rng).calmed).toBe(true);
        expect(helmSkill({ captainHp: 0, boarderHp: 10 })).toBe(7);
        expect(helmSkill({ captainHp: 4, boarderHp: 10 })).toBe(6);
    });
    it('does not fire last-place penalties on the only surviving vessel', () => {
        const state = createInitialState('last', { playerCount: 2 });
        state.ships['player-2'].destroyed = true;
        const result = resolveCleanupPhase(state, createRng('last'));
        expect(result.events.some((e) => e.type === 'ARENA_LASER')).toBe(false);
        expect(result.state.ships['player-1'].rowers.temperament).toBe('calm');
    });
    it('disables a vessel at zero rowers and cannot revive it with subsequent hull damage', () => {
        const state = createInitialState('disabled');
        const ship = applyMastDamage(state.ships['player-1'], 100);
        expect(ship).toMatchObject({
            destroyed: true,
            maxSpeed: 0,
            rowers: { hp: 0 },
        });
        expect(applyHullDamage(ship, 'front', 1).ship.destroyed).toBe(true);
    });
    it('rescues survivors and advances the turn when flogging loses the last rower', () => {
        const state = createInitialState('no-rowers', { playerCount: 2 });
        state.phase = 'movement';
        state.ships['player-1'].rowers.hp = 1;
        vi.spyOn(decks, 'drawFlogging').mockReturnValue('move1Damage1Mast');
        try {
            const result = reduce(
                state,
                { type: 'FLOG_DECISION', playerId: 'player-1', flog: true },
                createRng('no-rowers'),
            );
            expect(result.state.ships['player-1']).toMatchObject({
                destroyed: true,
                movementRemaining: 0,
            });
            expect(result.state.displacedCrew['player-1'].captainHp).toBe(10);
            expect(result.state.activePlayerId).toBe('player-2');
            expect(result.events.some((e) => e.type === 'SHIP_DESTROYED')).toBe(
                true,
            );
        } finally {
            vi.restoreAllMocks();
        }
    });
});
