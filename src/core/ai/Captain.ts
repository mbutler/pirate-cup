import { STYLES, type CaptainPersonalities } from './Personality';
import { resolveRamming } from '../cards/decks';
import {
    inferRamHitSideFromApproach,
    resolveFrontHitBounce,
} from '../rules/ramming';
import { applyHullDamage, applyMastDamage } from '../rules/damage';
import { raceScore } from '../rules/race';
import type { ShipState } from '../entities/types';
import type { GameAction } from '../actions/types';
import type { GameState } from '../state/GameState';
import type { MoveDirection } from '../track/types';
import { defaultTrack } from '../track/TrackGraph';
import { boardingTargets } from '../rules/combat';
import { crewDestinations, hijackTargets } from '../rules/crew';
import { hijackChance } from '../rules/crewSkill';

const directions: MoveDirection[] = ['forward', 'laneIn', 'laneOut'];

/** Deterministic decisions from public state only; never peeks at the rules RNG. */
export function chooseComputerAction(
    state: GameState,
    personalities: CaptainPersonalities = {},
): GameAction | null {
    if (state.phase === 'finished') return null;
    const id = state.activePlayerId;
    const ship = id ? state.ships[id] : undefined;
    const owner = state.activeCrewId ?? ship?.ownerId ?? '';
    const style = STYLES[personalities[owner] ?? 'racer'];
    if (state.phase === 'crew' && state.activeCrewId) {
        const crewId = state.activeCrewId;
        const crew = state.displacedCrew[crewId];
        const targets = hijackTargets(state, crewId).sort(
            (a, b) =>
                hijackChance(crew, state.ships[b].crew) -
                hijackChance(crew, state.ships[a].crew),
        );
        if (targets.length)
            return { type: 'HIJACK', crewId, targetId: targets[0] };
        // Reverse edges measure actual rowing distance, including asymmetric course links.
        const incoming = new Map<string, string[]>();
        for (const node of defaultTrack.nodes.values())
            for (const neighbor of Object.values(node.neighbors)) {
                if (neighbor === 'wall') continue;
                incoming.set(neighbor, [
                    ...(incoming.get(neighbor) ?? []),
                    node.id,
                ]);
            }
        const distance = new Map<string, number>();
        const queue = Object.values(state.ships)
            .filter((s) => !s.destroyed)
            .map((s) => s.positionId);
        queue.forEach((position) => distance.set(position, 0));
        for (let i = 0; i < queue.length; i++) {
            const position = queue[i];
            for (const neighbor of incoming.get(position) ?? []) {
                if (neighbor === 'wall' || distance.has(neighbor)) continue;
                distance.set(neighbor, distance.get(position)! + 1);
                queue.push(neighbor);
            }
        }
        const destination = crewDestinations(state, crewId).sort(
            (a, b) =>
                (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity),
        )[0];
        return destination
            ? { type: 'CREW_MOVE', crewId, destinationId: destination }
            : { type: 'CREW_WAIT', crewId };
    }
    if (state.phase === 'combat') {
        if (!ship) return { type: 'END_TURN' };
        const targets = boardingTargets(state, ship.id).sort(
            (a, b) =>
                state.ships[a].crew.boarderHp -
                state.ships[b].crew.boarderHp -
                (raceScore(state.ships[a]) - raceScore(state.ships[b])) * 4,
        );
        return targets.length
            ? {
                  type: 'DECLARE_ATTACK',
                  attackerId: ship.id,
                  targetId: targets[0],
              }
            : { type: 'PASS_ATTACK', attackerId: ship.id };
    }
    if (!ship || ship.destroyed) return null;
    if (state.phase === 'input') {
        let speed = ship.maxSpeed;
        let position = ship.positionId;
        for (let step = 1; step <= speed; step++) {
            const next = defaultTrack.neighbor(position, 'forward');
            if (next === 'wall') {
                speed = Math.min(speed, step);
                break;
            }
            const limit = defaultTrack.safeSpeedAt(next);
            const safe =
                limit === undefined
                    ? undefined
                    : limit +
                      (ship.hull.structure > 20 && ship.rowers.hp > 35
                          ? style.overspeed
                          : 0);
            if (safe !== undefined && speed > safe)
                speed = Math.max(step - 1, safe);
            position = next;
        }
        if (ship.hull.structure < 10) speed = Math.min(speed, 4);
        return {
            type: 'SUBMIT_TURN_INPUT',
            playerId: ship.id,
            input: { speed, moves: [] },
        };
    }
    if (state.phase !== 'movement') return null;
    if (ship.movementRemaining <= 0) {
        const ahead = defaultTrack.neighbor(ship.positionId, 'forward');
        const clear =
            ahead !== 'wall' &&
            !Object.values(state.ships).some(
                (s) => !s.destroyed && s.positionId === ahead,
            );
        const safe =
            ahead !== 'wall' &&
            defaultTrack.corneringChecksOwed(ship.chosenSpeed, ahead) === 0;
        return {
            type: 'FLOG_DECISION',
            playerId: ship.id,
            flog:
                clear &&
                safe &&
                ship.hull.front > 12 &&
                ship.hull.structure > 15 &&
                ship.rowers.hp > 30 &&
                ship.flogAttemptsRemaining >
                    state.config.flogAttemptsPerTurn - style.pushes,
        };
    }
    if (ship.rowers.temperament === 'mutiny')
        return { type: 'CHOOSE_MOVE', playerId: ship.id, direction: 'forward' };
    const fromProgress = defaultTrack.raceProgressFromStart(ship.positionId);
    const choices = directions.filter(
        (direction) =>
            defaultTrack.neighbor(ship.positionId, direction) !== 'wall',
    );
    const score = (direction: MoveDirection) => {
        const target = defaultTrack.neighbor(ship.positionId, direction);
        let progress =
            defaultTrack.raceProgressFromStart(target) - fromProgress;
        if (progress < -0.5) progress += 1;
        const rival = Object.values(state.ships).find(
            (s) => !s.destroyed && s.id !== ship.id && s.positionId === target,
        );
        const ramValue = rival
            ? evaluateRam(ship, rival, personalities[owner] ?? 'racer')
            : 0;
        // Avoid ending a turn beside a healthy hostile boarder; opportunists seek a finishing strike.
        const neighbors = Object.values(defaultTrack.getNode(target).neighbors);
        const boardingValue =
            ship.movementRemaining === 1 && ship.crew.boarderHp > 0
                ? Object.values(state.ships)
                      .filter(
                          (other) =>
                              !other.destroyed &&
                              other.id !== ship.id &&
                              neighbors.includes(other.positionId) &&
                              other.crew.boarderHp > 0,
                      )
                      .reduce(
                          (value, other) =>
                              value +
                              (other.crew.boarderHp <= 4
                                  ? 2 * style.boarding
                                  : -0.3 * style.caution),
                          0,
                      )
                : 0;
        // One extra hex of route awareness discourages entering a corner with no safe exit.
        const exitRisk =
            ship.movementRemaining > 1
                ? Math.min(
                      ...directions.map((next) => {
                          const hex = defaultTrack.neighbor(target, next);
                          return hex === 'wall'
                              ? 8
                              : defaultTrack.corneringChecksOwed(
                                    ship.chosenSpeed,
                                    hex,
                                );
                      }),
                  )
                : 0;
        return (
            progress * 100 -
            defaultTrack.corneringChecksOwed(ship.chosenSpeed, target) *
                style.corner -
            exitRisk * style.corner * 0.4 +
            ramValue +
            boardingValue +
            (direction === 'forward' ? 0.2 : 0) -
            (target.startsWith('x') ? 20 : 0)
        );
    };
    choices.sort((a, b) => score(b) - score(a));
    return {
        type: 'CHOOSE_MOVE',
        playerId: ship.id,
        direction: choices[0] ?? 'forward',
    };
}

/** Evaluate known collision damage, never draw or peek at the race RNG. */
export function evaluateRam(
    ship: ShipState,
    rival: ShipState,
    personality: keyof typeof STYLES,
): number {
    const style = STYLES[personality];
    const side = resolveFrontHitBounce(
        inferRamHitSideFromApproach(ship.positionId, rival.positionId),
        rival.positionId,
    );
    const hit = resolveRamming(side);
    const defender = applyHullDamage(
        rival,
        hit.rammedSide,
        hit.rammedDamage,
    ).ship;
    let attacker = hit.rammerSide
        ? applyHullDamage(ship, hit.rammerSide, hit.rammerDamage ?? 0).ship
        : ship;
    attacker = applyMastDamage(attacker, hit.rammerMastDamage ?? 0);
    // Even a bruiser avoids a known fatal collision if another line exists.
    if (attacker.destroyed) return -1000;
    const damageValue = (before: ShipState, after: ShipState) =>
        (before.hull.structure - after.hull.structure) * 1.2 +
        (before.maxSpeed - after.maxSpeed) * 2 +
        (before.rowers.hp - after.rowers.hp) * 0.2;
    const threat = raceScore(rival) >= raceScore(ship) ? 1.25 : 0.8;
    const reward =
        (hit.rammedDamage * 0.25 +
            damageValue(rival, defender) +
            (defender.destroyed ? 10 : 0)) *
        threat;
    const cost = (hit.rammerDamage ?? 0) * 0.25 + damageValue(ship, attacker);
    return reward * style.attack - cost * style.caution - 0.5;
}
