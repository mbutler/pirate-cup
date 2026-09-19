import {
    PERSONALITIES,
    type CaptainPersonalities,
} from '../core/ai/Personality';
import type { GameAction } from '../core';
import { defaultTrack } from '../core/track/TrackGraph';

// Bump when rule changes would alter replay results.
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'pirate-cup.race.v1';
export const MAX_SAVE_BYTES = 2_000_000;
export interface RaceSave {
    format: 'pirate-cup';
    version: number;
    seed: string;
    playerCount: number;
    lapsToWin: number;
    computerCaptains: string[];
    personalities?: CaptainPersonalities;
    actions: GameAction[];
}

export function parseSave(text: string): RaceSave {
    if (text.length > MAX_SAVE_BYTES)
        throw new Error('Save file is too large.');
    const save = JSON.parse(text);
    const fail = (): never => {
        throw new Error('This is not a valid Pirate Cup save.');
    };
    if (!save || save.format !== 'pirate-cup') fail();
    if (save.version !== SAVE_VERSION)
        throw new Error('This save uses a different version of Pirate Cup.');
    const integer = (n: unknown, min: number, max: number) =>
        Number.isInteger(n) && Number(n) >= min && Number(n) <= max;
    if (
        typeof save.seed !== 'string' ||
        save.seed.length > 200 ||
        !integer(save.playerCount, 2, 6) ||
        !integer(save.lapsToWin, 1, 3)
    )
        fail();
    const player = (id: unknown) =>
        typeof id === 'string' &&
        Array.from(
            { length: save.playerCount },
            (_, i) => `player-${i + 1}`,
        ).includes(id);
    const direction = (d: unknown) =>
        ['laneIn', 'forward', 'laneOut'].includes(d as string);
    if (
        !Array.isArray(save.computerCaptains) ||
        save.computerCaptains.length > save.playerCount ||
        !save.computerCaptains.every(player) ||
        new Set(save.computerCaptains).size !== save.computerCaptains.length
    )
        fail();
    if (
        save.personalities !== undefined &&
        (!save.personalities ||
            typeof save.personalities !== 'object' ||
            Array.isArray(save.personalities) ||
            Object.entries(save.personalities).some(
                ([id, value]) =>
                    !save.computerCaptains.includes(id) ||
                    !PERSONALITIES.includes(
                        value as (typeof PERSONALITIES)[number],
                    ),
            ))
    )
        fail();
    if (!Array.isArray(save.actions) || save.actions.length > 20000) fail();
    for (const a of save.actions) {
        if (!a || typeof a !== 'object') fail();
        switch (a.type) {
            case 'CREW_MOVE':
                if (
                    !player(a.crewId) ||
                    !defaultTrack.nodes.has(a.destinationId)
                )
                    fail();
                break;
            case 'HIJACK':
                if (!player(a.crewId) || !player(a.targetId)) fail();
                break;
            case 'CREW_WAIT':
            case 'CREW_RETIRE':
                if (!player(a.crewId)) fail();
                break;
            case 'SUBMIT_TURN_INPUT':
                if (
                    !player(a.playerId) ||
                    !a.input ||
                    !integer(a.input.speed, 0, 8) ||
                    !Array.isArray(a.input.moves) ||
                    a.input.moves.length > 100 ||
                    !a.input.moves.every(direction) ||
                    (a.input.attackTargetId !== undefined &&
                        !player(a.input.attackTargetId))
                )
                    fail();
                break;
            case 'CHOOSE_MOVE':
                if (!player(a.playerId) || !direction(a.direction)) fail();
                break;
            case 'RESOLVE_CORNERING':
            case 'RESOLVE_DRIFT':
            case 'RESOLVE_FLOGGING':
                if (!player(a.playerId)) fail();
                break;
            case 'FLOG_DECISION':
                if (!player(a.playerId) || typeof a.flog !== 'boolean') fail();
                break;
            case 'DECLARE_ATTACK':
                if (!player(a.attackerId) || !player(a.targetId)) fail();
                break;
            case 'PASS_ATTACK':
                if (!player(a.attackerId)) fail();
                break;
            case 'BEGIN_MOVEMENT_PHASE':
            case 'RESOLVE_COMBAT':
            case 'END_TURN':
                break;
            default:
                fail();
        }
    }
    return save as RaceSave;
}

export function writeSave(save: RaceSave): boolean {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        return true;
    } catch {
        return false;
    }
}

export function downloadSave(save: RaceSave) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(save)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pirate-cup-save.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
