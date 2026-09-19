import type { GameAction } from '../actions/types';
import type { GameState } from '../state/GameState';
import type { MoveDirection } from '../track/types';
import { defaultTrack } from '../track/TrackGraph';
import { boardingTargets } from '../rules/combat';
import { crewDestinations, hijackTargets } from '../rules/crew';
import { hijackChance } from '../rules/crewSkill';

const directions: MoveDirection[] = ['forward', 'laneIn', 'laneOut'];

/** Deterministic decisions from public state only; never peeks at the rules RNG. */
export function chooseComputerAction(state: GameState): GameAction | null {
    if (state.phase === 'finished') return null;
    const id = state.activePlayerId;
    const ship = id ? state.ships[id] : undefined;
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
                state.ships[a].crew.boarderHp - state.ships[b].crew.boarderHp,
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
            const safe = defaultTrack.safeSpeedAt(next);
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
                ship.flogAttemptsRemaining === state.config.flogAttemptsPerTurn,
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
        const ramCost = rival
            ? ship.hull.structure > 20 && rival.hull.structure < 10
                ? 0.5
                : 4
            : 0;
        return (
            progress * 100 -
            defaultTrack.corneringChecksOwed(ship.chosenSpeed, target) * 3 -
            ramCost +
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
