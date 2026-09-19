import type { MoveDirection } from '../track/types';
import type { TurnInput } from '../state/GameState';

/** Serializable commands — same shape for local hot-seat and future online transport. */
export type GameAction =
    | { type: 'CREW_MOVE'; crewId: string; destinationId: string }
    | { type: 'HIJACK'; crewId: string; targetId: string }
    | { type: 'CREW_WAIT' | 'CREW_RETIRE'; crewId: string }
    | { type: 'SUBMIT_TURN_INPUT'; playerId: string; input: TurnInput }
    | { type: 'BEGIN_MOVEMENT_PHASE' }
    | { type: 'CHOOSE_MOVE'; playerId: string; direction: MoveDirection }
    | { type: 'RESOLVE_CORNERING'; playerId: string }
    | { type: 'RESOLVE_DRIFT'; playerId: string }
    | { type: 'FLOG_DECISION'; playerId: string; flog: boolean }
    | { type: 'RESOLVE_FLOGGING'; playerId: string }
    | { type: 'DECLARE_ATTACK'; attackerId: string; targetId: string }
    | { type: 'PASS_ATTACK'; attackerId: string }
    | { type: 'RESOLVE_COMBAT' }
    | { type: 'END_TURN' };

export type GameActionType = GameAction['type'];

export function isActionForPlayer(
    action: GameAction,
    playerId: string,
): boolean {
    switch (action.type) {
        case 'CREW_MOVE':
        case 'HIJACK':
        case 'CREW_WAIT':
        case 'CREW_RETIRE':
            return action.crewId === playerId;
        case 'SUBMIT_TURN_INPUT':
        case 'CHOOSE_MOVE':
        case 'RESOLVE_CORNERING':
        case 'RESOLVE_DRIFT':
        case 'FLOG_DECISION':
        case 'RESOLVE_FLOGGING':
            return action.playerId === playerId;
        case 'PASS_ATTACK':
        case 'DECLARE_ATTACK':
            return action.attackerId === playerId;
        default:
            return false;
    }
}
