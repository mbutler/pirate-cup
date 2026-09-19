import type { GameState } from '../state/GameState';
import type { GameEvent } from '../events/types';
import { defaultTrack } from '../track/TrackGraph';
import { applyBoarderDamage } from './damage';

export const BOARDER_MELEE_DAMAGE = 4;

export interface CombatResolution {
    state: GameState;
    events: GameEvent[];
}

/** Some original track edges are asymmetric; either neighboring edge establishes reach. */
export function boardingTargets(
    state: GameState,
    attackerId: string,
): string[] {
    const attacker = state.ships[attackerId];
    if (!attacker || attacker.destroyed || attacker.crew.boarderHp <= 0)
        return [];
    const neighbors = Object.values(
        defaultTrack.getNode(attacker.positionId).neighbors,
    );
    return Object.values(state.ships)
        .filter(
            (target) =>
                target.id !== attackerId &&
                !target.destroyed &&
                target.crew.boarderHp > 0 &&
                (neighbors.includes(target.positionId) ||
                    Object.values(
                        defaultTrack.getNode(target.positionId).neighbors,
                    ).includes(attacker.positionId)),
        )
        .map((target) => target.id);
}

export function nextCombatCaptain(state: GameState): string | null {
    return (
        Object.keys(state.ships).find(
            (id) =>
                boardingTargets(state, id).length > 0 &&
                !state.pendingCombat.some((attack) => attack.attackerId === id),
        ) ?? null
    );
}

export function beginCombat(state: GameState): GameState {
    const next: GameState = {
        ...state,
        phase: 'combat',
        pendingCombat: [],
        activePlayerId: null,
    };
    return { ...next, activePlayerId: nextCombatCaptain(next) };
}

/** A null target records an explicit pass, so a captain cannot decide twice. */
export function queueAttack(
    state: GameState,
    attackerId: string,
    targetId: string | null,
): GameState {
    if (state.phase !== 'combat' || nextCombatCaptain(state) !== attackerId)
        return state;
    if (
        targetId !== null &&
        !boardingTargets(state, attackerId).includes(targetId)
    )
        return state;
    const next = {
        ...state,
        pendingCombat: [...state.pendingCombat, { attackerId, targetId }],
    };
    return { ...next, activePlayerId: nextCombatCaptain(next) };
}

/** Validate against the pre-combat snapshot, then apply all damage together. */
export function resolveCombatPhase(state: GameState): CombatResolution {
    if (state.phase !== 'combat' || nextCombatCaptain(state) !== null)
        return { state, events: [] };
    const events: GameEvent[] = [];
    const damage = new Map<string, number>();
    const seen = new Set<string>();
    for (const attack of state.pendingCombat) {
        if (seen.has(attack.attackerId)) continue;
        seen.add(attack.attackerId);
        if (
            !attack.targetId ||
            !boardingTargets(state, attack.attackerId).includes(attack.targetId)
        )
            continue;
        damage.set(
            attack.targetId,
            (damage.get(attack.targetId) ?? 0) + BOARDER_MELEE_DAMAGE,
        );
        events.push({
            type: 'COMBAT_RESOLVED',
            attackerId: attack.attackerId,
            targetId: attack.targetId,
            damage: BOARDER_MELEE_DAMAGE,
        });
    }
    const ships = { ...state.ships };
    for (const [id, amount] of damage) {
        ships[id] = applyBoarderDamage(ships[id], amount);
        if (ships[id].crew.boarderHp === 0)
            events.push({ type: 'BOARDER_DEFEATED', playerId: id });
    }
    return {
        state: {
            ...state,
            ships,
            pendingCombat: [],
            phase: 'cleanup',
            activePlayerId: null,
        },
        events,
    };
}
