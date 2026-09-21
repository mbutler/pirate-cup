import {
    STYLES,
    type CaptainPersonalities,
    type Personality,
    type StyleWeights,
} from './Personality';
import { resolveRamming } from '../cards/decks';
import {
    inferRamHitSideFromApproach,
    resolveFrontHitBounce,
} from '../rules/ramming';
import { applyHullDamage, applyMastDamage } from '../rules/damage';
import { raceScore, raceStandings } from '../rules/race';
import type { ShipState } from '../entities/types';
import type { GameAction } from '../actions/types';
import type { GameState } from '../state/GameState';
import type { MoveDirection } from '../track/types';
import { defaultTrack } from '../track/TrackGraph';
import { boardingTargets } from '../rules/combat';
import { crewDestinations, hijackTargets } from '../rules/crew';
import { hijackChance } from '../rules/crewSkill';

const directions: MoveDirection[] = ['forward', 'laneIn', 'laneOut'];
const LOOKAHEAD_DEPTH = 2;
const LOOKAHEAD_DISCOUNT = 0.55;

export type CaptainStyles = Partial<Record<string, StyleWeights>>;

export function resolveStyle(
    owner: string,
    personalities: CaptainPersonalities = {},
    styles: CaptainStyles = {},
): StyleWeights {
    return styles[owner] ?? STYLES[personalities[owner] ?? 'racer'];
}

/** Shift the six knobs by place, remaining laps, and how wrecked the hull is. */
export function styleInContext(
    base: StyleWeights,
    state: GameState,
    ship: ShipState,
): StyleWeights {
    const alive = raceStandings(state).filter((other) => !other.destroyed);
    const rank = alive.findIndex((other) => other.id === ship.id);
    const leader = alive[0];
    const leading = rank === 0 && alive.length > 1;
    const chasing =
        rank > 0 &&
        leader !== undefined &&
        raceScore(leader) - raceScore(ship) > 0.02;
    const hurt = ship.hull.structure < 15 || ship.rowers.hp < 25;
    const sprint = state.config.lapsToWin - ship.lapsCompleted <= 1;
    let attack = base.attack;
    let caution = base.caution;
    let corner = base.corner;
    let overspeed = base.overspeed;
    let pushes = base.pushes;
    const boarding = base.boarding;
    if (leading) {
        attack *= 0.75;
        caution *= 1.12;
        corner *= 1.08;
        pushes -= 1;
    } else if (chasing) {
        attack *= 1.12;
        caution *= 0.92;
        corner *= 0.88;
        pushes += 1;
    }
    if (sprint && !hurt) {
        corner *= 0.92;
        pushes += 1;
    }
    if (hurt) {
        attack *= 0.4;
        caution *= 1.35;
        corner *= 1.25;
        overspeed = 0;
        pushes = 0;
    }
    return {
        attack,
        caution,
        corner,
        overspeed: clampInt(overspeed, 0, 3),
        pushes: clampInt(pushes, 0, 4),
        boarding,
    };
}

/** Deterministic decisions from public state only; never peeks at the rules RNG. */
export function chooseComputerAction(
    state: GameState,
    personalities: CaptainPersonalities = {},
    styles: CaptainStyles = {},
): GameAction | null {
    if (state.phase === 'finished') return null;
    const id = state.activePlayerId;
    const ship = id ? state.ships[id] : undefined;
    const owner = state.activeCrewId ?? ship?.ownerId ?? '';
    const base = resolveStyle(owner, personalities, styles);
    const style = ship ? styleInContext(base, state, ship) : base;
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
        return {
            type: 'SUBMIT_TURN_INPUT',
            playerId: ship.id,
            input: { speed: planSpeed(state, ship, style), moves: [] },
        };
    }
    if (state.phase !== 'movement') return null;
    if (ship.movementRemaining <= 0) {
        return {
            type: 'FLOG_DECISION',
            playerId: ship.id,
            flog: shouldFlog(state, ship, style),
        };
    }
    if (ship.rowers.temperament === 'mutiny')
        return { type: 'CHOOSE_MOVE', playerId: ship.id, direction: 'forward' };
    const rivals = livingRivals(state, ship.id);
    const choices = directions.filter(
        (direction) =>
            defaultTrack.neighbor(ship.positionId, direction) !== 'wall',
    );
    choices.sort(
        (a, b) =>
            scoreLine(
                ship,
                ship.positionId,
                b,
                ship.movementRemaining,
                style,
                rivals,
                LOOKAHEAD_DEPTH,
            ) -
            scoreLine(
                ship,
                ship.positionId,
                a,
                ship.movementRemaining,
                style,
                rivals,
                LOOKAHEAD_DEPTH,
            ),
    );
    return {
        type: 'CHOOSE_MOVE',
        playerId: ship.id,
        direction: choices[0] ?? 'forward',
    };
}

/** Evaluate known collision damage, never draw or peek at the rules RNG. */
export function evaluateRam(
    ship: ShipState,
    rival: ShipState,
    personality: Personality | StyleWeights,
): number {
    const style =
        typeof personality === 'string' ? STYLES[personality] : personality;
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

function planSpeed(
    state: GameState,
    ship: ShipState,
    style: StyleWeights,
): number {
    const rivals = livingRivals(state, ship.id);
    const greedy = spineSpeed(ship, style);
    if (ship.hull.structure < 10) return Math.min(4, greedy);
    const hot = Math.min(ship.maxSpeed, greedy + style.overspeed);
    let best = greedy;
    let bestScore = speedScore(ship, greedy, style, rivals);
    if (hot !== greedy) {
        const hotScore = speedScore(ship, hot, style, rivals);
        if (hotScore > bestScore) best = hot;
    }
    return best;
}

function spineSpeed(ship: ShipState, style: StyleWeights): number {
    let speed = ship.maxSpeed;
    let position = ship.positionId;
    const healthy = ship.hull.structure > 20 && ship.rowers.hp > 35;
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
                : limit + (healthy ? style.overspeed : 0);
        if (safe !== undefined && speed > safe) speed = Math.max(step - 1, safe);
        position = next;
    }
    return speed;
}

function speedScore(
    ship: ShipState,
    speed: number,
    style: StyleWeights,
    rivals: ShipState[],
): number {
    const depth = Math.min(LOOKAHEAD_DEPTH, Math.max(1, speed));
    const probe: ShipState = {
        ...ship,
        chosenSpeed: speed,
        movementRemaining: speed,
    };
    let best = -Infinity;
    for (const direction of directions) {
        if (defaultTrack.neighbor(ship.positionId, direction) === 'wall')
            continue;
        best = Math.max(
            best,
            scoreLine(
                probe,
                ship.positionId,
                direction,
                depth,
                style,
                rivals,
                depth,
            ),
        );
    }
    return speed * 8 + (best === -Infinity ? 0 : best);
}

function shouldFlog(
    state: GameState,
    ship: ShipState,
    style: StyleWeights,
): boolean {
    const ahead = defaultTrack.neighbor(ship.positionId, 'forward');
    const clear =
        ahead !== 'wall' &&
        !Object.values(state.ships).some(
            (other) => !other.destroyed && other.positionId === ahead,
        );
    const safe =
        ahead !== 'wall' &&
        defaultTrack.corneringChecksOwed(ship.chosenSpeed, ahead) === 0;
    const beyond =
        ahead === 'wall' ? 'wall' : defaultTrack.neighbor(ahead, 'forward');
    const nextCorner =
        beyond !== 'wall' &&
        defaultTrack.corneringChecksOwed(ship.chosenSpeed, beyond) > 0;
    return (
        clear &&
        safe &&
        !nextCorner &&
        ship.hull.front > 12 &&
        ship.hull.structure > 15 &&
        ship.rowers.hp > 30 &&
        ship.flogAttemptsRemaining >
            state.config.flogAttemptsPerTurn - style.pushes
    );
}

function scoreLine(
    ship: ShipState,
    from: string,
    direction: MoveDirection,
    remaining: number,
    style: StyleWeights,
    rivals: ShipState[],
    depth: number,
): number {
    const target = defaultTrack.neighbor(from, direction);
    if (target === 'wall' || remaining <= 0 || depth <= 0) return -1000;
    const here = hexScore(ship, from, target, remaining, style, rivals);
    if (remaining === 1 || depth === 1) return here;
    let best = 0;
    for (const next of directions) {
        const hex = defaultTrack.neighbor(target, next);
        if (hex === 'wall') continue;
        best = Math.max(
            best,
            scoreLine(
                ship,
                target,
                next,
                remaining - 1,
                style,
                rivals,
                depth - 1,
            ),
        );
    }
    return here + LOOKAHEAD_DISCOUNT * best;
}

function hexScore(
    ship: ShipState,
    from: string,
    target: string,
    remaining: number,
    style: StyleWeights,
    rivals: ShipState[],
): number {
    const fromProgress = defaultTrack.raceProgressFromStart(from);
    let progress = defaultTrack.raceProgressFromStart(target) - fromProgress;
    if (progress < -0.5) progress += 1;
    const rival = rivals.find((other) => other.positionId === target);
    const ramValue = rival ? evaluateRam(ship, rival, style) : 0;
    const neighbors = Object.values(defaultTrack.getNode(target).neighbors);
    const boardingValue =
        remaining === 1 && ship.crew.boarderHp > 0
            ? rivals
                  .filter(
                      (other) =>
                          other.crew.boarderHp > 0 &&
                          neighbors.includes(other.positionId),
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
    return (
        progress * 100 -
        defaultTrack.corneringChecksOwed(ship.chosenSpeed, target) *
            style.corner +
        ramValue +
        boardingValue +
        (defaultTrack.neighbor(from, 'forward') === target ? 0.2 : 0) -
        (target.startsWith('x') ? 20 : 0)
    );
}

function livingRivals(state: GameState, exceptId: string): ShipState[] {
    return Object.values(state.ships).filter(
        (other) => !other.destroyed && other.id !== exceptId,
    );
}

function clampInt(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
}
