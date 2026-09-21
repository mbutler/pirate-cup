import { chooseComputerAction, type CaptainStyles } from './Captain';
import {
    PERSONALITIES,
    PERSONALITY_LABELS,
    STYLES,
    assignPersonalities,
    type CaptainPersonalities,
    type Personality,
    type StyleWeights,
} from './Personality';
import { createInitialState, reduce } from '../engine/GameEngine';
import { createRng, type Rng } from '../rng/Rng';
import type { FinishReason } from '../rules/race';

export const SIM_ACTION_CAP = 12000;

export interface RaceSpec {
    seed: string;
    playerCount: number;
    lapsToWin: number;
    personalities?: CaptainPersonalities;
    styles?: CaptainStyles;
    cap?: number;
}

export interface RaceRecord {
    seed: string;
    playerCount: number;
    lapsToWin: number;
    personalities: CaptainPersonalities;
    winnerId: string | null;
    winnerOwnerId: string | null;
    winnerPersonality: Personality | null;
    winnerSeat: number | null;
    finishReason: FinishReason | null;
    truncated: boolean;
    turns: number;
    wrecks: number;
}

export interface PersonalityStats {
    personality: Personality;
    label: string;
    slots: number;
    racesPresent: number;
    wins: number;
    expectedWins: number;
    winRate: number;
    strength: number;
}

export interface SeatStats {
    seat: number;
    races: number;
    wins: number;
    expectedWins: number;
    winRate: number;
    strength: number;
}

export interface DuelCell {
    row: Personality;
    column: Personality;
    races: number;
    rowWins: number;
    draws: number;
    winRate: number;
}

export interface BenchmarkConfig {
    seeds: number;
    playerCounts: number[];
    laps: number[];
    prefix: string;
    duels: number;
}

export interface BenchmarkReport {
    config: BenchmarkConfig;
    elapsedMs: number;
    races: RaceRecord[];
    duels: RaceRecord[];
    personalities: PersonalityStats[];
    seats: SeatStats[];
    finishes: Record<string, number>;
    duelMatrix: DuelCell[];
    truncated: number;
}

export interface WeightCandidate {
    name: string;
    weights: StyleWeights;
}

export interface SearchGeneration {
    generation: number;
    best: WeightCandidate & { winRate: number };
    medianWinRate: number;
}

export interface SearchConfig {
    generations: number;
    population: number;
    evalRaces: number;
    confirmRaces: number;
    prefix: string;
}

export interface ConfirmedCandidate extends WeightCandidate {
    winRate: number;
    races: number;
}

export interface SearchReport {
    config: SearchConfig;
    elapsedMs: number;
    best: WeightCandidate & { winRate: number };
    confirmed: ConfirmedCandidate[];
    selfPlay: ConfirmedCandidate[];
    history: SearchGeneration[];
    evaluated: number;
}

export function playerIds(playerCount: number): string[] {
    return Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
}

export function runComputerRace(spec: RaceSpec): RaceRecord {
    const personalities =
        spec.personalities ??
        assignPersonalities(`${spec.seed}:field`, playerIds(spec.playerCount));
    const styles = spec.styles ?? {};
    const cap = spec.cap ?? SIM_ACTION_CAP;
    let state = createInitialState(spec.seed, {
        playerCount: spec.playerCount,
        lapsToWin: spec.lapsToWin,
    });
    const rng = createRng(spec.seed);
    let wrecks = 0;
    let actions = 0;
    for (; actions < cap && state.phase !== 'finished'; actions++) {
        const action = chooseComputerAction(state, personalities, styles);
        if (!action)
            throw new Error(
                `no computer action for ${spec.seed} phase ${state.phase} turn ${state.turn}`,
            );
        const next = reduce(state, action, rng);
        if (next.state === state)
            throw new Error(
                `stuck on ${action.type} for ${spec.seed} turn ${state.turn}`,
            );
        wrecks += next.events.filter((event) => event.type === 'SHIP_DESTROYED')
            .length;
        state = next.state;
    }
    const winnerId = state.winnerId;
    const winner = winnerId ? state.ships[winnerId] : undefined;
    const winnerOwnerId = winner?.ownerId ?? null;
    return {
        seed: spec.seed,
        playerCount: spec.playerCount,
        lapsToWin: spec.lapsToWin,
        personalities,
        winnerId,
        winnerOwnerId,
        winnerPersonality: winnerOwnerId
            ? (personalities[winnerOwnerId] ?? null)
            : null,
        winnerSeat: winnerId ? Number(winnerId.slice('player-'.length)) : null,
        finishReason: state.finishReason,
        truncated: state.phase !== 'finished',
        turns: state.turn,
        wrecks,
    };
}

export function defaultBenchmarkConfig(
    overrides: Partial<BenchmarkConfig> = {},
): BenchmarkConfig {
    return {
        seeds: 200,
        playerCounts: [2, 3, 4, 5, 6],
        laps: [1, 2, 3],
        prefix: 'sim',
        duels: 20,
        ...overrides,
    };
}

export function runPersonalityBenchmark(
    config: BenchmarkConfig,
): BenchmarkReport {
    const started = Date.now();
    const races: RaceRecord[] = [];
    for (let seed = 0; seed < config.seeds; seed++)
        for (const playerCount of config.playerCounts)
            for (const lapsToWin of config.laps) {
                const raceSeed = `${config.prefix}:${seed}:${playerCount}:${lapsToWin}`;
                races.push(
                    runComputerRace({
                        seed: raceSeed,
                        playerCount,
                        lapsToWin,
                        personalities: assignPersonalities(
                            `${raceSeed}:field`,
                            playerIds(playerCount),
                        ),
                    }),
                );
            }
    const duels: RaceRecord[] = [];
    for (const row of PERSONALITIES)
        for (const column of PERSONALITIES)
            for (let seed = 0; seed < config.duels; seed++) {
                const swap = seed % 2 === 1;
                const a = swap ? column : row;
                const b = swap ? row : column;
                const raceSeed = `${config.prefix}:duel:${row}:${column}:${seed}`;
                duels.push(
                    runComputerRace({
                        seed: raceSeed,
                        playerCount: 2,
                        lapsToWin: 1,
                        personalities: {
                            'player-1': a,
                            'player-2': b,
                        },
                    }),
                );
            }
    return {
        config,
        elapsedMs: Date.now() - started,
        races,
        duels,
        personalities: summarizePersonalities(races),
        seats: summarizeSeats(races),
        finishes: summarizeFinishes([...races, ...duels]),
        duelMatrix: summarizeDuels(duels),
        truncated: [...races, ...duels].filter((race) => race.truncated).length,
    };
}

export function defaultSearchConfig(
    overrides: Partial<SearchConfig> = {},
): SearchConfig {
    return {
        generations: 8,
        population: 12,
        evalRaces: 64,
        confirmRaces: 200,
        prefix: 'search',
        ...overrides,
    };
}

export function searchStyleWeights(config: SearchConfig): SearchReport {
    const started = Date.now();
    const rng = createRng(`${config.prefix}:evolve`);
    let pool: WeightCandidate[] = [
        ...PERSONALITIES.map((personality) => ({
            name: personality,
            weights: { ...STYLES[personality] },
        })),
        ...Array.from({ length: Math.max(0, config.population - 4) }, (_, i) => ({
            name: `random-${i}`,
            weights: randomWeights(rng),
        })),
    ].slice(0, config.population);
    const history: SearchGeneration[] = [];
    let evaluated = 0;
    let best: WeightCandidate & { winRate: number } = {
        ...pool[0],
        winRate: 0,
    };
    for (let generation = 0; generation < config.generations; generation++) {
        const scored = pool.map((candidate, index) => {
            const winRate = evaluateSelfPlay(
                candidate.weights,
                pool,
                index,
                `${config.prefix}:g${generation}:c${index}`,
                config.evalRaces,
            );
            evaluated += config.evalRaces;
            return { ...candidate, winRate };
        });
        scored.sort((a, b) => b.winRate - a.winRate);
        if (scored[0].winRate >= best.winRate) best = scored[0];
        const mid = scored[Math.floor(scored.length / 2)]?.winRate ?? 0;
        history.push({
            generation,
            best: scored[0],
            medianWinRate: mid,
        });
        pool = nextGeneration(scored, rng, config.population, generation);
    }
    const confirmTargets: WeightCandidate[] = [];
    const seen = new Set<string>();
    for (const candidate of [
        best,
        ...PERSONALITIES.map((personality) => ({
            name: personality,
            weights: { ...STYLES[personality] },
        })),
    ]) {
        const key = formatWeights(candidate.weights);
        if (seen.has(key)) continue;
        seen.add(key);
        confirmTargets.push(candidate);
    }
    const confirmed = config.confirmRaces
        ? confirmTargets.map((candidate, index) => {
              const races = config.confirmRaces;
              const winRate = evaluateVsStock(
                  candidate.weights,
                  `${config.prefix}:confirm:${index}:${candidate.name}`,
                  races,
              );
              evaluated += races;
              return { ...candidate, winRate, races };
          })
        : [];
    confirmed.sort((a, b) => b.winRate - a.winRate);
    const selfPlayPool = uniqueCandidates([
        best,
        ...PERSONALITIES.map((personality) => ({
            name: personality,
            weights: { ...STYLES[personality] },
        })),
    ]);
    const selfPlay = config.confirmRaces
        ? selfPlayPool.map((candidate, index) => {
              const races = config.confirmRaces;
              const winRate = evaluateSelfPlay(
                  candidate.weights,
                  selfPlayPool,
                  index,
                  `${config.prefix}:self:${index}:${candidate.name}`,
                  races,
              );
              evaluated += races;
              return { ...candidate, winRate, races };
          })
        : [];
    selfPlay.sort((a, b) => b.winRate - a.winRate);
    return {
        config,
        elapsedMs: Date.now() - started,
        best,
        confirmed,
        selfPlay,
        history,
        evaluated,
    };
}

export function formatPersonalityReport(report: BenchmarkReport): string {
    const { config } = report;
    const lines = [
        'Personality simulation',
        `  ${report.races.length} mixed races · ${config.seeds} seeds · players ${config.playerCounts.join(',')} · laps ${config.laps.join(',')}`,
        `  ${report.duels.length} one-lap duels · ${formatDuration(report.elapsedMs)}`,
        '',
        pad('Personality', 14) +
            pad('Wins', 8, true) +
            pad('Slots', 8, true) +
            pad('Present', 10, true) +
            pad('Win%', 8, true) +
            pad('vs expected', 12, true),
    ];
    for (const row of report.personalities)
        lines.push(
            pad(row.label, 14) +
                pad(String(row.wins), 8, true) +
                pad(String(row.slots), 8, true) +
                pad(String(row.racesPresent), 10, true) +
                pad(pct(row.winRate), 8, true) +
                pad(row.strength.toFixed(2), 12, true),
        );
    lines.push(
        '',
        pad('Seat', 14) +
            pad('Wins', 8, true) +
            pad('Races', 10, true) +
            pad('Win%', 8, true) +
            pad('vs equal', 12, true),
    );
    for (const row of report.seats)
        lines.push(
            pad(`player-${row.seat}`, 14) +
                pad(String(row.wins), 8, true) +
                pad(String(row.races), 10, true) +
                pad(pct(row.winRate), 8, true) +
                pad(row.strength.toFixed(2), 12, true),
        );
    lines.push('', 'Finish');
    for (const [reason, count] of Object.entries(report.finishes))
        lines.push(`  ${reason}: ${count}`);
    if (report.truncated) lines.push(`  truncated: ${report.truncated}`);
    if (report.duelMatrix.length) {
        lines.push('', 'One-lap 1v1 win rate (row vs column, seats rotated)');
        lines.push(
            pad('', 14) + PERSONALITIES.map((p) => pad(shortLabel(p), 10, true)).join(''),
        );
        for (const row of PERSONALITIES) {
            let line = pad(PERSONALITY_LABELS[row], 14);
            for (const column of PERSONALITIES) {
                const cell = report.duelMatrix.find(
                    (entry) => entry.row === row && entry.column === column,
                );
                line += pad(cell ? pct(cell.winRate) : '—', 10, true);
            }
            lines.push(line);
        }
    }
    lines.push(
        '',
        'Win% is wins / races that personality appeared in. Strength is wins / expected wins from field share.',
        'Seat is the starting hull that finished, not the captain after a hijack.',
        '1v1 diagonal is player-1 win rate in a mirror match (seat bias). Off-diagonal is row beating column.',
    );
    return lines.join('\n') + '\n';
}

export function formatSearchReport(report: SearchReport): string {
    const lines = [
        'Style weight search',
        `  ${report.config.generations} generations · population ${report.config.population} · ${report.config.evalRaces} eval races · ${report.evaluated} races · ${formatDuration(report.elapsedMs)}`,
        '',
        `Search champion ${report.best.name}  (self-play fitness ${pct(report.best.winRate)})`,
        `  ${formatWeights(report.best.weights)}`,
        '',
        pad('Gen', 6) + pad('Best', 14) + pad('Win%', 8, true) + pad('Median%', 10, true),
    ];
    for (const generation of report.history)
        lines.push(
            pad(String(generation.generation), 6) +
                pad(generation.best.name, 14) +
                pad(pct(generation.best.winRate), 8, true) +
                pad(pct(generation.medianWinRate), 10, true),
        );
    if (report.confirmed.length) {
        lines.push(
            '',
            `Vs stock (${report.config.confirmRaces} races, seats rotated)`,
            pad('Candidate', 16) + pad('Win%', 8, true),
        );
        for (const candidate of report.confirmed)
            lines.push(
                pad(candidate.name, 16) + pad(pct(candidate.winRate), 8, true),
            );
        const leader = report.confirmed[0];
        if (leader) lines.push(`  ${formatWeights(leader.weights)}`);
    }
    if (report.selfPlay.length) {
        lines.push(
            '',
            `Self-play (${report.config.confirmRaces} races vs mixed elites, seats rotated)`,
            pad('Candidate', 16) + pad('Win%', 8, true),
        );
        for (const candidate of report.selfPlay)
            lines.push(
                pad(candidate.name, 16) + pad(pct(candidate.winRate), 8, true),
            );
    }
    lines.push(
        '',
        'Evolution fitness is 4-player 1-lap self-play against the current pool, rotating seats.',
        'Stock STYLES stay in every generation. Confirmation also scores the champion against stock only.',
    );
    return lines.join('\n') + '\n';
}

export function formatWeights(weights: StyleWeights): string {
    return (
        `attack ${weights.attack.toFixed(2)}  caution ${weights.caution.toFixed(2)}  ` +
        `corner ${weights.corner.toFixed(2)}  overspeed ${weights.overspeed}  ` +
        `pushes ${weights.pushes}  boarding ${weights.boarding.toFixed(2)}`
    );
}

function summarizePersonalities(races: RaceRecord[]): PersonalityStats[] {
    return PERSONALITIES.map((personality) => {
        let slots = 0;
        let racesPresent = 0;
        let wins = 0;
        let expectedWins = 0;
        for (const race of races) {
            const count = Object.values(race.personalities).filter(
                (value) => value === personality,
            ).length;
            if (!count) continue;
            slots += count;
            racesPresent += 1;
            expectedWins += count / race.playerCount;
            if (race.winnerPersonality === personality) wins += 1;
        }
        return {
            personality,
            label: PERSONALITY_LABELS[personality],
            slots,
            racesPresent,
            wins,
            expectedWins,
            winRate: racesPresent ? wins / racesPresent : 0,
            strength: expectedWins ? wins / expectedWins : 0,
        };
    }).sort((a, b) => b.strength - a.strength);
}

function summarizeSeats(races: RaceRecord[]): SeatStats[] {
    const maxSeat = Math.max(0, ...races.map((race) => race.playerCount));
    return Array.from({ length: maxSeat }, (_, index) => {
        const seat = index + 1;
        let starts = 0;
        let wins = 0;
        let expectedWins = 0;
        for (const race of races) {
            if (race.playerCount < seat) continue;
            starts += 1;
            expectedWins += 1 / race.playerCount;
            if (race.winnerSeat === seat) wins += 1;
        }
        return {
            seat,
            races: starts,
            wins,
            expectedWins,
            winRate: starts ? wins / starts : 0,
            strength: expectedWins ? wins / expectedWins : 0,
        };
    });
}

function summarizeFinishes(races: RaceRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const race of races) {
        const key = race.truncated ? 'truncated' : (race.finishReason ?? 'unknown');
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

function summarizeDuels(duels: RaceRecord[]): DuelCell[] {
    const cells: DuelCell[] = [];
    for (const row of PERSONALITIES)
        for (const column of PERSONALITIES) {
            const matches = duels.filter((race) => {
                const a = race.personalities['player-1'];
                const b = race.personalities['player-2'];
                return (
                    (a === row && b === column) || (a === column && b === row)
                );
            });
            let rowWins = 0;
            let draws = 0;
            const mirror = row === column;
            for (const race of matches) {
                if (!race.winnerPersonality) draws += 1;
                else if (mirror && race.winnerSeat === 1) rowWins += 1;
                else if (!mirror && race.winnerPersonality === row) rowWins += 1;
            }
            const decided = matches.length - draws;
            cells.push({
                row,
                column,
                races: matches.length,
                rowWins,
                draws,
                winRate: decided ? rowWins / decided : 0,
            });
        }
    return cells;
}

function uniqueCandidates(candidates: WeightCandidate[]): WeightCandidate[] {
    const seen = new Set<string>();
    const unique: WeightCandidate[] = [];
    for (const candidate of candidates) {
        const key = formatWeights(candidate.weights);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(candidate);
    }
    return unique;
}

function evaluateVsStock(
    weights: StyleWeights,
    prefix: string,
    evalRaces: number,
): number {
    let wins = 0;
    let decided = 0;
    const lineup = [...PERSONALITIES];
    for (let i = 0; i < evalRaces; i++) {
        const seat = i % 4;
        const ids = playerIds(4);
        const personalities: CaptainPersonalities = Object.fromEntries(
            ids.map((id, index) => [id, lineup[index]]),
        );
        const styles: CaptainStyles = { [ids[seat]]: weights };
        const race = runComputerRace({
            seed: `${prefix}:${i}`,
            playerCount: 4,
            lapsToWin: 1,
            personalities,
            styles,
        });
        if (!race.winnerOwnerId) continue;
        decided += 1;
        if (race.winnerOwnerId === ids[seat]) wins += 1;
    }
    return decided ? wins / decided : 0;
}

function evaluateSelfPlay(
    weights: StyleWeights,
    pool: WeightCandidate[],
    index: number,
    prefix: string,
    evalRaces: number,
): number {
    const others = pool.filter((_, other) => other !== index);
    const source = others.length ? others : pool;
    let wins = 0;
    let decided = 0;
    for (let i = 0; i < evalRaces; i++) {
        const opponents = [0, 1, 2].map(
            (offset) => source[(i + offset) % source.length].weights,
        );
        const seat = i % 4;
        const ids = playerIds(4);
        const field = [weights, ...opponents];
        const styles: CaptainStyles = {};
        ids.forEach((id, slot) => {
            styles[id] = field[(slot - seat + 4) % 4];
        });
        const race = runComputerRace({
            seed: `${prefix}:${i}`,
            playerCount: 4,
            lapsToWin: 1,
            personalities: Object.fromEntries(
                ids.map((id, slot) => [id, PERSONALITIES[slot]]),
            ),
            styles,
        });
        if (!race.winnerOwnerId) continue;
        decided += 1;
        if (race.winnerOwnerId === ids[seat]) wins += 1;
    }
    return decided ? wins / decided : 0;
}

function nextGeneration(
    scored: Array<WeightCandidate & { winRate: number }>,
    rng: Rng,
    population: number,
    generation: number,
): WeightCandidate[] {
    const elite = scored.slice(0, Math.min(2, scored.length));
    const next: WeightCandidate[] = [
        ...PERSONALITIES.map((personality) => ({
            name: personality,
            weights: { ...STYLES[personality] },
        })),
        ...elite.map((candidate, index) => ({
            name: `elite-${generation}-${index}`,
            weights: { ...candidate.weights },
        })),
    ];
    while (next.length < population) {
        const parent = scored[rng.int(0, Math.min(3, scored.length - 1))];
        if (rng.next() < 0.25)
            next.push({
                name: `rand-${generation}-${next.length}`,
                weights: randomWeights(rng),
            });
        else
            next.push({
                name: `mut-${generation}-${next.length}`,
                weights: mutateWeights(parent.weights, rng),
            });
    }
    return next.slice(0, population);
}

function randomWeights(rng: Rng): StyleWeights {
    return {
        attack: round2(0.2 + rng.next() * 2.2),
        caution: round2(0.3 + rng.next() * 2),
        corner: round2(0.8 + rng.next() * 4),
        overspeed: rng.int(0, 3),
        pushes: rng.int(0, 4),
        boarding: round2(rng.next() * 2),
    };
}

function mutateWeights(weights: StyleWeights, rng: Rng): StyleWeights {
    const next = { ...weights };
    const keys: (keyof StyleWeights)[] = [
        'attack',
        'caution',
        'corner',
        'overspeed',
        'pushes',
        'boarding',
    ];
    const key = keys[rng.int(0, keys.length - 1)];
    if (key === 'overspeed' || key === 'pushes')
        next[key] = clamp(
            next[key] + rng.int(-1, 1),
            0,
            key === 'pushes' ? 4 : 3,
        );
    else
        next[key] = round2(
            clamp(
                next[key] * (0.75 + rng.next() * 0.5) + (rng.next() - 0.5) * 0.25,
                0.05,
                6,
            ),
        );
    return next;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function pad(value: string, width: number, right = false): string {
    return right ? value.padStart(width) : value.padEnd(width);
}

function pct(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function shortLabel(personality: Personality): string {
    return PERSONALITY_LABELS[personality].slice(0, 8);
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
