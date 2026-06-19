export { createGameConfig, DEFAULT_SHIP_COLORS, DEFAULT_STARTING_POSITIONS } from './config/GameConfig';
export type { GameConfig, ShipColor } from './config/GameConfig';

export { TrackGraph, defaultTrack } from './track/TrackGraph';
export type {
    HitSide,
    MoveDirection,
    TrackNode,
    TrackNodeId,
} from './track/types';
export { MOVE, WALL } from './track/types';

export type {
    CrewState,
    HullState,
    RowerTemperament,
    RowersState,
    ShipState,
} from './entities/types';
export {
    DEFAULT_CREW,
    DEFAULT_HULL,
    DEFAULT_ROWERS,
    maxSpeedFromRowers,
    sailsFromMastHp,
} from './entities/types';

export {
    createInitialState,
    createShipState,
    allInputsSubmitted,
    computeMovementOrder,
} from './state/GameState';
export type { GameState, TurnInput, TurnPhase, PendingCombat } from './state/GameState';

export { createRng } from './rng/Rng';
export type { Rng } from './rng/Rng';

export {
    CORNERING_DECK,
    FLOGGING_DECK,
    WALL_COLLISION_DECK,
    drawCornering,
    drawFlogging,
    drawWallCollision,
    drawFromDeck,
    totalWeight,
    resolveRamming,
} from './cards/decks';
export type {
    CorneringOutcome,
    FloggingOutcome,
    WallCollisionOutcome,
    DeckDefinition,
} from './cards/decks';

export type { GameAction } from './actions/types';
export type { GameEvent, GameEventType } from './events/types';
export { filterEvents } from './events/types';

export { reduce } from './engine/GameEngine';
export type { ReduceResult } from './engine/GameEngine';

export { applyHullDamage, applyMastDamage, inferRamHitSide } from './rules/damage';
export { applyMove, getOccupyingShipId } from './rules/movement';
export { resolveCombatPhase, queueAttack } from './rules/combat';
