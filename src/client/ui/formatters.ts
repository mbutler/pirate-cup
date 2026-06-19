import type { CorneringOutcome, FloggingOutcome } from '../../core/cards/decks';
import type { GameEvent } from '../../core/events/types';
import type { ShipState } from '../../core/entities/types';
import type { TurnPhase } from '../../core/state/GameState';
import type { MoveDirection } from '../../core/track/types';

const PHASE_LABELS: Record<TurnPhase, string> = {
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
    return `${name} (${ship.id.replace('player-', 'P')})`;
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
            return 'May move in 1 lane';
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
            return '+2 moves, turn ends';
        case 'move2':
            return '+2 moves';
        case 'move1EndTurn':
            return '+1 move, turn ends';
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

function formatHitSide(side: string): string {
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
    switch (event.type) {
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
            return `Wall hit (${formatHitSide(event.side)}): ${event.outcome}`;
        case 'RAMMING': {
            const rammerParts = [
                event.rammerHullDamage
                    ? `${event.rammerHullDamage} to ${formatHitSide(event.rammerHullSide ?? 'front')}`
                    : null,
                event.rammerMastDamage ? `${event.rammerMastDamage} to rowers` : null,
            ].filter(Boolean);

            return [
                `Ram! ${event.rammedId} struck on ${formatHitSide(event.hitSide)}`,
                `${event.rammedDamage} to ${formatHitSide(event.rammedSide)}`,
                rammerParts.length ? `${event.rammerId}: ${rammerParts.join(', ')}` : null,
            ].filter(Boolean).join(' · ');
        }
        case 'DAMAGE_APPLIED':
            return `${event.playerId}: ${event.amount} damage to ${event.target}`;
        case 'MUTINY_STARTED':
            return event.reason === 'arena_laser'
                ? 'Arena laser! Last-place rowers snap — MUTINY!'
                : event.reason === 'critical_damage'
                  ? 'Critical damage — rowers erupt into MUTINY!'
                  : event.reason === 'flog'
                    ? 'Flogging backfires — MUTINY!'
                    : 'Mutiny! Rowers seize the ship!';
        case 'MUTINY_SPEED_ROLLED':
            return `Frenzied surge — speed ${event.speed} (sails + d10 ${event.roll})`;
        case 'MUTINY_ENDED':
            return event.reason === 'cooldown'
                ? 'Captain regains control — mutiny ends'
                : event.reason === 'crash'
                  ? 'Hard crash — mutiny ends'
                  : event.reason === 'wreck'
                    ? 'Ship wrecked — mutiny ends'
                    : 'Mutiny ended';
        case 'FRENZY_COOLDOWN_ROLL':
            return event.calmed
                ? `Cooldown d10 ${event.roll} ≤ captain skill ${event.skill} — rowers calm`
                : `Cooldown d10 ${event.roll} > captain skill ${event.skill} — still mutinous`;
        case 'ARENA_LASER':
            return 'The stadium laser tags the last-place ship!';
        case 'COMBAT_RESOLVED':
            return `Boarders clash — ${event.damage} damage`;
        case 'SHIP_DESTROYED':
            return 'Ship destroyed!';
        case 'RACE_WON':
            return `${event.playerId} wins the race!`;
        default:
            return event.type;
    }
}
