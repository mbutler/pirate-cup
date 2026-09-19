import type { CrewState } from '../entities/types';

/** Pirate Cup defaults, separate from the ten-point health tracks. */
export const CAPTAIN_SKILL = 8;
export const BOARDER_HELM_SKILL = 7;

/** A surviving boarder can steer when the captain is lost. */
export function helmSkill(crew: CrewState): number {
    const hp = crew.captainHp > 0 ? crew.captainHp : crew.boarderHp;
    if (hp <= 0) return 0;
    const base = crew.captainHp > 0 ? CAPTAIN_SKILL : BOARDER_HELM_SKILL;
    return Math.max(1, base - Math.floor(Math.max(0, 10 - hp) / 3));
}

export function hijackStrength(crew: CrewState): number {
    return helmSkill(crew) + (crew.captainHp > 0 && crew.boarderHp > 0 ? 1 : 0);
}

/** Exact odds for two independent d10 rolls; ties favor the defender. */
export function hijackChance(attacker: CrewState, defender: CrewState): number {
    let wins = 0;
    for (let attack = 1; attack <= 10; attack++)
        for (let defense = 1; defense <= 10; defense++)
            if (
                attack + hijackStrength(attacker) >
                defense + hijackStrength(defender)
            )
                wins++;
    return wins;
}
