import {
    defaultBenchmarkConfig,
    defaultSearchConfig,
    formatPersonalityReport,
    formatSearchReport,
    runPersonalityBenchmark,
    searchStyleWeights,
    type BenchmarkConfig,
    type SearchConfig,
} from '../src/core/ai/simulate';

export interface SimArgs {
    help: boolean;
    json: boolean;
    search: boolean;
    benchmark: BenchmarkConfig;
    evolve: SearchConfig;
}

export function parseSimArgs(argv: string[]): SimArgs {
    if (argv.includes('--help') || argv.includes('-h'))
        return {
            help: true,
            json: false,
            search: false,
            benchmark: defaultBenchmarkConfig(),
            evolve: defaultSearchConfig(),
        };
    const seeds = numberOpt(argv, '--seeds', envNumber('SIM_SEEDS', 200));
    const duels = numberOpt(argv, '--duels', envNumber('SIM_DUELS', 20));
    return {
        help: false,
        json: argv.includes('--json') || process.env.SIM_JSON === '1',
        search: argv.includes('--search') || process.env.SIM_SEARCH === '1',
        benchmark: defaultBenchmarkConfig({
            seeds,
            playerCounts: listOpt(
                argv,
                '--players',
                envList('SIM_PLAYERS', [2, 3, 4, 5, 6]),
            ),
            laps: listOpt(argv, '--laps', envList('SIM_LAPS', [1, 2, 3])),
            prefix: stringOpt(argv, '--prefix', process.env.SIM_PREFIX ?? 'sim'),
            duels,
        }),
        evolve: defaultSearchConfig({
            generations: numberOpt(
                argv,
                '--generations',
                envNumber('SIM_GENERATIONS', 8),
            ),
            population: numberOpt(
                argv,
                '--population',
                envNumber('SIM_POPULATION', 12),
            ),
            evalRaces: numberOpt(argv, '--eval', envNumber('SIM_EVAL', 64)),
            confirmRaces: numberOpt(
                argv,
                '--confirm',
                envNumber('SIM_CONFIRM', 200),
            ),
            prefix: stringOpt(
                argv,
                '--search-prefix',
                process.env.SIM_SEARCH_PREFIX ?? 'search',
            ),
        }),
    };
}

export function main(argv: string[] = process.argv.slice(2)): void {
    const args = parseSimArgs(argv);
    if (args.help) {
        process.stdout.write(`${helpText()}\n`);
        return;
    }
    const report = runPersonalityBenchmark(args.benchmark);
    process.stdout.write(formatPersonalityReport(report));
    const search = args.search ? searchStyleWeights(args.evolve) : null;
    if (search) process.stdout.write(`\n${formatSearchReport(search)}`);
    if (args.json)
        process.stdout.write(
            `${JSON.stringify(
                search ? { benchmark: report, search } : report,
                null,
                2,
            )}\n`,
        );
}

function helpText(): string {
    return `Usage: npm run sim -- [options]

  --seeds N          Mixed-field seed count (default 200)
  --players a,b,c    Fleet sizes (default 2,3,4,5,6)
  --laps a,b,c       Race lengths (default 1,2,3)
  --prefix STR       Seed prefix (default sim)
  --duels N          1v1 seeds per pairing (default 20; 0 to skip)
  --search           Evolve custom STYLES weights after the sweep
  --generations N    Search generations (default 8)
  --population N     Search population (default 12)
  --eval N           Races per candidate per generation (default 64)
  --confirm N        Held-out races vs stock and vs self-play pool (default 200)
  --json             Print JSON after the text report
  --help             Show this message

All captains use chooseComputerAction with context-split weights and a
two-hex lookahead. Mixed fields shuffle the four stock personalities.
Search fitness is self-play in 4-player 1-lap races; stock styles stay in
every generation. Confirmation scores the champion against stock and
against a mixed elite pool.`;
}

function stringOpt(argv: string[], name: string, fallback: string): string {
    return readOpt(argv, name) ?? fallback;
}

function numberOpt(argv: string[], name: string, fallback: number): number {
    const raw = readOpt(argv, name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0)
        throw new Error(`${name} needs a non-negative number`);
    return value;
}

function listOpt(argv: string[], name: string, fallback: number[]): number[] {
    const raw = readOpt(argv, name);
    if (raw === undefined) return fallback;
    const values = raw
        .split(',')
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0);
    if (!values.length) throw new Error(`${name} needs a comma list of integers`);
    return values;
}

function readOpt(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    if (index >= 0) {
        const value = argv[index + 1];
        if (value && !value.startsWith('-')) return value;
    }
    const prefix = `${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function envNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function envList(name: string, fallback: number[]): number[] {
    const raw = process.env[name];
    if (!raw) return fallback;
    const values = raw
        .split(',')
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0);
    return values.length ? values : fallback;
}
