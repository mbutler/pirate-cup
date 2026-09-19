import { createInitialState, reduce } from '../../src/core/engine/GameEngine';
import { createRng } from '../../src/core/rng/Rng';
import { boardingTargets } from '../../src/core/rules/combat';
import { hijackTargets, crewDestinations } from '../../src/core/rules/crew';
import { defaultTrack } from '../../src/core/track/TrackGraph';
import type { GameAction } from '../../src/core/actions/types';
import type { GameState } from '../../src/core/state/GameState';

export type Strategy = 'careful' | 'reckless' | 'mixed';
export function playtest(
    seed: string,
    playerCount: number,
    lapsToWin: number,
    strategy: Strategy,
) {
    let state = createInitialState(seed, { playerCount, lapsToWin });
    const rng = createRng(seed);
    const decisions = createRng(`${seed}:decisions`);
    let actions = 0,
        wrecks = 0,
        attempts = 0,
        captures = 0;
    const cap = 12000;
    for (; actions < cap && state.phase !== 'finished'; actions++) {
        const ship = state.activePlayerId
            ? state.ships[state.activePlayerId]
            : null;
        const reckless =
            strategy === 'reckless' ||
            (strategy === 'mixed' && Number(ship?.ownerId.slice(-1)) % 2 === 0);
        let action: GameAction;
        if (state.phase === 'input' && ship) {
            action = {
                type: 'SUBMIT_TURN_INPUT',
                playerId: ship.id,
                input: {
                    speed: reckless
                        ? ship.maxSpeed
                        : Math.min(4, ship.maxSpeed),
                    moves: [],
                },
            };
        } else if (state.phase === 'movement' && ship) {
            if (ship.movementRemaining > 0) {
                const moves = defaultTrack.playerMoves(ship.positionId);
                const forward = defaultTrack.neighbor(
                    ship.positionId,
                    'forward',
                );
                let destination = forward;
                if (ship.rowers.temperament !== 'mutiny') {
                    const occupied = new Set(
                        Object.values(state.ships)
                            .filter(
                                (other) =>
                                    !other.destroyed && other.id !== ship.id,
                            )
                            .map((other) => other.positionId),
                    );
                    destination =
                        moves.includes(forward) &&
                        (reckless || !occupied.has(forward))
                            ? forward
                            : (moves.find((id) => !occupied.has(id)) ??
                              moves[0]);
                }
                const node = defaultTrack.getNode(ship.positionId);
                const direction =
                    destination === node.neighbors.laneIn
                        ? 'laneIn'
                        : destination === node.neighbors.laneOut
                          ? 'laneOut'
                          : 'forward';
                action = {
                    type: 'CHOOSE_MOVE',
                    playerId: ship.id,
                    direction:
                        ship.rowers.temperament === 'mutiny'
                            ? 'forward'
                            : direction,
                };
            } else
                action = {
                    type: 'FLOG_DECISION',
                    playerId: ship.id,
                    flog: reckless && ship.flogAttemptsRemaining > 4,
                };
        } else if (state.phase === 'crew') {
            const crewId = state.activeCrewId!;
            const targets = hijackTargets(state, crewId);
            if (targets.length) {
                action = { type: 'HIJACK', crewId, targetId: targets[0] };
                attempts++;
            } else {
                const destinations = crewDestinations(state, crewId);
                action =
                    decisions.int(0, 1) && destinations.length
                        ? {
                              type: 'CREW_MOVE',
                              crewId,
                              destinationId:
                                  destinations[
                                      decisions.int(0, destinations.length - 1)
                                  ],
                          }
                        : { type: 'CREW_WAIT', crewId };
            }
        } else if (state.phase === 'combat') {
            action = ship
                ? {
                      type: 'DECLARE_ATTACK',
                      attackerId: ship.id,
                      targetId: boardingTargets(state, ship.id)[0],
                  }
                : { type: 'END_TURN' };
        } else throw new Error(`No action in ${state.phase}`);
        const result = reduce(state, action, rng);
        if (result.state === state)
            throw new Error(
                `Rejected ${JSON.stringify(action)} at ${seed} round ${state.turn}`,
            );
        state = result.state;
        wrecks += result.events.filter(
            (e) => e.type === 'SHIP_DESTROYED',
        ).length;
        captures += result.events.filter(
            (e) => e.type === 'CREW_MESSAGE' && e.message.includes(' hijacks '),
        ).length;
        assertPlayable(state);
    }
    return {
        seed,
        playerCount,
        lapsToWin,
        strategy,
        actions,
        rounds: state.turn,
        finish: state.finishReason,
        winner: state.winnerId ? state.ships[state.winnerId].ownerId : null,
        wrecks,
        attempts,
        captures,
    };
}
function assertPlayable(state: GameState) {
    const alive = Object.values(state.ships).filter((s) => !s.destroyed);
    if (new Set(alive.map((s) => s.positionId)).size !== alive.length)
        throw new Error('Stacked vessels');
    const owners = [
        ...alive.map((s) => s.ownerId),
        ...Object.keys(state.displacedCrew),
    ];
    if (new Set(owners).size !== owners.length)
        throw new Error('Captain duplicated');
    if (state.activePlayerId && state.ships[state.activePlayerId].destroyed)
        throw new Error('Wreck given a turn');
    if (state.phase === 'crew' && !state.displacedCrew[state.activeCrewId!])
        throw new Error('Missing active crew');
    if (alive.some((s) => s.movementRemaining < 0 || s.rowers.hp < 0))
        throw new Error('Negative resources');
}
