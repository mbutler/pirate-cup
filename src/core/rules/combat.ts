import type { GameState } from '../state/GameState';
import type { GameEvent } from '../events/types';
import { applyBoarderDamage } from './damage';

const BOARDER_MELEE_DAMAGE = 4;

export interface CombatResolution {
    state: GameState;
    events: GameEvent[];
}

/** Simultaneous boarder combat — all declared attacks resolve even if attacker dies. */
export function resolveCombatPhase(state: GameState): CombatResolution {
    const events: GameEvent[] = [];
    const ships = { ...state.ships };

    for (const attack of state.pendingCombat) {
        const attacker = ships[attack.attackerId];
        const target = ships[attack.targetId];

        if (!attacker || !target || attacker.destroyed || target.destroyed) {
            continue;
        }

        if (attacker.crew.boarderHp <= 0 || target.crew.boarderHp <= 0) {
            continue;
        }

        // Adjacency: same hex for v1 (boarders boarding adjacent ships at rest).
        if (attacker.positionId !== target.positionId) {
            continue;
        }

        const damagedTarget = applyBoarderDamage(target, BOARDER_MELEE_DAMAGE);
        const damagedAttacker = applyBoarderDamage(attacker, BOARDER_MELEE_DAMAGE);

        ships[attack.targetId] = damagedTarget;
        ships[attack.attackerId] = damagedAttacker;

        events.push({
            type: 'COMBAT_RESOLVED',
            attackerId: attack.attackerId,
            targetId: attack.targetId,
            damage: BOARDER_MELEE_DAMAGE,
        });
    }

    return {
        state: {
            ...state,
            ships,
            pendingCombat: [],
            phase: 'cleanup',
        },
        events,
    };
}

export function queueAttack(
    state: GameState,
    attackerId: string,
    targetId: string,
): GameState {
    return {
        ...state,
        pendingCombat: [...state.pendingCombat, { attackerId, targetId }],
    };
}
