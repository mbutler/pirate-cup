import { expect, it } from 'vitest';
import { playtest, type Strategy } from '../support/playtest';

it('completes varied full races without invalid turns or duplicated captains', () => {
    const results = [];
    for (const strategy of ['careful', 'reckless', 'mixed'] as Strategy[])
        for (const playerCount of [2, 3, 4, 5, 6])
            for (const laps of [1, 2, 3])
                for (let seed = 0; seed < 10; seed++) {
                    const result = playtest(
                        `balance-${seed}`,
                        playerCount,
                        laps,
                        strategy,
                    );
                    results.push(result);
                    expect(
                        result.finish,
                        JSON.stringify(result),
                    ).not.toBeNull();
                }
    if (process.env.PLAYTEST_REPORT) console.log(JSON.stringify(results));
}, 30000);
