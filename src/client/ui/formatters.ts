import type { CorneringOutcome, FloggingOutcome } from '../../core/cards/decks';
import type { GameEvent } from '../../core/events/types';
import type { ShipState } from '../../core/entities/types';
import type { TurnPhase } from '../../core/state/GameState';
import type { MoveDirection } from '../../core/track/types';

const PHASE_LABELS: Record<TurnPhase, string> = {
    crew: 'Surviving crews',
    input: 'Planning',
    movement: 'Movement',
    combat: 'Combat',
    cleanup: 'Cleanup',
    finished: 'Finished',
};

export function formatPhase(phase: TurnPhase): string {
    return PHASE_LABELS[phase];
}

export function formatPlayerLabel(ship: ShipState): string {
    const name = ship.color.charAt(0).toUpperCase() + ship.color.slice(1);
    return `${name} (${ship.ownerId.replace('player-', 'P')})`;
}

export function formatMoveDirection(direction: MoveDirection): string {
    switch (direction) {
        case 'laneIn':
            return 'Port (move in)';
        case 'forward':
            return 'Ahead';
        case 'laneOut':
            return 'Starboard (move out)';
        default:
            return direction;
    }
}

export function formatCorneringOutcome(outcome: CorneringOutcome): string {
    switch (outcome) {
        case 'hold':
            return 'Hold the corner!';
        case 'drift1':
            return 'Drift 1 lane out';
        case 'drift2':
            return 'Drift 2 lanes out';
        case 'moveIn1':
            return 'Move in 1 lane';
        case 'drift3':
            return 'Drift 3 lanes out';
        default:
            return outcome;
    }
}

export function formatFloggingOutcome(outcome: FloggingOutcome): string {
    switch (outcome) {
        case 'damage3Front1Mast':
            return '−3 bow, −1 rowers';
        case 'damage3Front':
            return '−3 bow';
        case 'damage2Front1Mast':
            return '−2 bow, −1 rowers';
        case 'move1Damage1Mast':
            return '+1 move, −1 rowers';
        case 'damage2Front':
            return '−2 bow';
        case 'move1':
            return '+1 move';
        case 'damage1Front':
            return '−1 bow';
        case 'move2EndTurn':
            return '+2 moves, no more flogging';
        case 'move2':
            return '+2 moves';
        case 'move1EndTurn':
            return '+1 move, no more flogging';
        case 'damage1Front1Mast':
            return '−1 bow, −1 rowers';
        case 'mutiny':
            return 'MUTINY! Rowers seize the ship';
        default:
            return outcome;
    }
}

export function formatShipSummary(ship: ShipState): string {
    const parts = [
        `Sails ${ship.maxSpeed}`,
        `Rowers ${ship.rowers.hp}`,
        `F${ship.hull.front} R${ship.hull.rear} L${ship.hull.left} S${ship.hull.right}`,
        `Struct ${ship.hull.structure}`,
    ];

    if (ship.rowers.temperament === 'mutiny') {
        parts.unshift('MUTINY');
    }

    return parts.join('  ·  ');
}

export function formatHitSide(side: string): string {
    switch (side) {
        case 'left':
            return 'port';
        case 'right':
            return 'starboard';
        case 'front':
            return 'bow';
        case 'rear':
            return 'stern';
        default:
            return side;
    }
}

export function formatEventMessage(event: GameEvent): string {
    const wallOutcomes = {
        hull3EndChecks: '−3 hull; corner checks end',
        mast3EndChecks: '−3 rowers; corner checks end',
        both3EndChecks: '−3 hull, −3 rowers; corner checks end',
        both6EndChecks: '−6 hull, −6 rowers; corner checks end',
        crashKeepFrenzy: '−6 hull, −6 rowers; movement ends',
        crash: '−6 hull, −6 rowers; movement and mutiny end',
    };
    switch (event.type) {
        case 'CREW_MESSAGE':
            return event.message;
        case 'PHASE_CHANGED':
            return `Phase: ${formatPhase(event.to)}`;
        case 'TURN_INPUT_RECEIVED':
            return `${event.playerId} locked speed ${event.speed}`;
        case 'SHIP_MOVED':
            return `Moved ${event.from} → ${event.to}`;
        case 'CORNERING_DRAWN':
            return `Cornering: ${formatCorneringOutcome(event.outcome)}`;
        case 'FLOGGING_DRAWN':
            return `Flogging: ${formatFloggingOutcome(event.outcome)}`;
        case 'WALL_COLLISION':
            return `Reef strike (${formatHitSide(event.side)}): ${wallOutcomes[event.outcome]}`;
        case 'RAMMING': {
            const rammerParts = [
                event.rammerHullDamage
                    ? `${event.rammerHullDamage} to ${formatHitSide(event.rammerHullSide ?? 'front')}`
                    : null,
                event.rammerMastDamage
                    ? `${event.rammerMastDamage} to rowers`
                    : null,
            ].filter(Boolean);

            return [
                `Ram! ${event.rammedId} struck on ${formatHitSide(event.hitSide)}`,
                `${event.rammedDamage} to ${formatHitSide(event.rammedSide)}`,
                rammerParts.length
                    ? `${event.rammerId}: ${rammerParts.join(', ')}`
                    : null,
            ]
                .filter(Boolean)
                .join(' · ');
        }
        case 'DAMAGE_APPLIED':
            return `${event.playerId}: ${event.amount} damage to ${event.target}`;
        case 'MUTINY_STARTED':
            return event.reason === 'arena_laser'
                ? 'Warning shot! Last-place rowers snap — MUTINY!'
                : event.reason === 'critical_damage'
                  ? 'Critical damage — rowers erupt into MUTINY!'
                  : event.reason === 'flog'
                    ? 'Flogging backfires — MUTINY!'
                    : 'Mutiny! Rowers seize the ship!';
        case 'MUTINY_SPEED_ROLLED':
            return `Mutinous surge — speed ${event.speed} (max speed + d10 ${event.roll})`;
        case 'MUTINY_ENDED':
            return event.reason === 'cooldown'
                ? 'Captain regains control — mutiny ends'
                : event.reason === 'crash'
                  ? 'Grounded on the reef — mutiny ends'
                  : event.reason === 'wreck'
                    ? 'Ship wrecked — mutiny ends'
                    : 'Mutiny ended';
        case 'FRENZY_COOLDOWN_ROLL':
            return event.calmed
                ? `Cooldown d10 ${event.roll} ≤ helm skill ${event.skill} — rowers calm`
                : `Cooldown d10 ${event.roll} > helm skill ${event.skill} — still mutinous`;
        case 'ARENA_LASER':
            return 'A warning shot sends the last-place crew into mutiny!';
        case 'ATTACK_DECLARED':
            return event.targetId
                ? `${event.attackerId} locks a boarding strike on ${event.targetId}`
                : `${event.attackerId} holds fire`;
        case 'BOARDER_DEFEATED':
            return `${event.playerId} loses their boarder — ship remains in the race`;
        case 'COMBAT_RESOLVED':
            return `${event.attackerId} strikes ${event.targetId} — ${event.damage} boarder damage`;
        case 'SHIP_DESTROYED':
            return 'Ship destroyed!';
        case 'LAP_COMPLETED':
            return `${event.playerId} completes lap ${event.lap}!`;
        case 'RACE_DRAWN':
            return 'All ships wrecked — the race ends without a winner.';
        case 'RACE_WON':
            return `${event.playerId} wins the race!`;
        default:
            return '';
    }
}
