import type { CorneringOutcome, FloggingOutcome, WallCollisionOutcome } from '../cards/decks';
import type { HitSide } from '../track/types';
import type { TurnPhase } from '../state/GameState';

export type GameEvent =
    | { type: 'PHASE_CHANGED'; from: TurnPhase; to: TurnPhase }
    | { type: 'TURN_INPUT_RECEIVED'; playerId: string; speed: number }
    | { type: 'SHIP_MOVED'; playerId: string; from: string; to: string }
    | { type: 'CORNERING_DRAWN'; playerId: string; outcome: CorneringOutcome }
    | { type: 'FLOGGING_DRAWN'; playerId: string; outcome: FloggingOutcome }
    | { type: 'WALL_COLLISION'; playerId: string; side: HitSide; outcome: WallCollisionOutcome }
    | {
          type: 'RAMMING';
          rammerId: string;
          rammedId: string;
          hitSide: HitSide;
          rammedSide: HitSide;
          rammedDamage: number;
          rammerHullSide?: HitSide;
          rammerHullDamage?: number;
          rammerMastDamage?: number;
      }
    | { type: 'DAMAGE_APPLIED'; playerId: string; target: string; amount: number }
    | { type: 'MUTINY_STARTED'; playerId: string; reason?: 'flog' | 'critical_damage' | 'arena_laser' }
    | { type: 'MUTINY_SPEED_ROLLED'; playerId: string; roll: number; speed: number }
    | { type: 'MUTINY_ENDED'; playerId: string; reason?: 'cooldown' | 'crash' | 'wreck' }
    | { type: 'FRENZY_COOLDOWN_ROLL'; playerId: string; roll: number; skill: number; calmed: boolean }
    | { type: 'ARENA_LASER'; playerId: string }
    | { type: 'COMBAT_RESOLVED'; attackerId: string; targetId: string; damage: number }
    | { type: 'SHIP_DESTROYED'; playerId: string }
    | { type: 'LAP_COMPLETED'; playerId: string; lap: number }
    | { type: 'RACE_WON'; playerId: string };

export type GameEventType = GameEvent['type'];

export function filterEvents<T extends GameEventType>(
    events: GameEvent[],
    type: T,
): Extract<GameEvent, { type: T }>[] {
    return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}
