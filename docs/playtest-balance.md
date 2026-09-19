# Playability and balance notes

## Reference and adaptations

The [Circus Imperium record sheet](https://www.goblins.net/files/downloads/CircusImperium_recordsheet.pdf) distinguishes ability from physical status and lists skill-based special actions, including reaching a vehicle in the same or an adjacent space. It does not explain the complete takeover sequence. We have not verified the full original rulebook.

Pirate Cup therefore uses that distinction as a guide, with explicitly provisional choices: captain skill 8, replacement boarder skill 7, one skill penalty per three health lost, and one support point when both characters survive. Hijacking remains an opposed d10 check, ties defending, followed by immediate ownership transfer on success. This is an adaptation, not a claim of exact Circus Imperium rules. Separate characters sharing and fighting aboard one vessel are not implemented.

These values remove automatic results caused by adding up twenty health points. Equal crews have a 45% capture chance. Every surviving crew combination has a nonzero chance against a healthy crew; no healthy crew is guaranteed to capture another surviving crew. The UI computes its odds from the same strength calculation used by the reducer. Mutiny recovery uses helm skill without the boarding support bonus.

Zero rowers now disables a vessel, just as zero hull does. Survivors escape, so no zero-speed vessel remains eligible for a hijack or race turn. Additional damage cannot restore a disabled vessel. Warning shots apply only with at least two vessels left; existing mutiny still needs recovery.

## Reproducible simulation

Run `PLAYTEST_REPORT=1 npx vitest run tests/core/playtest.test.ts` for the complete per-race report. Decisions and rules use separate seeded RNG streams. Each of 2–6 captains and 1–3 laps is tested with ten seeds under three strategies: cautious speed with collision avoidance, maximum speed with limited flogging, and a mixture. Crews try reachable hijacks or row/wait. No automatic retirement forces completion.

The 450-race run completed with 418 lap victories, 27 all-disabled draws, and 5 survival victories. It included 571 hijack attempts and 240 captures. Each action checks distinct vessel positions, unique captain ownership, valid active actors, and nonnegative resources.

| Race length | Median rounds | 90th percentile | Longest |
| --- | ---: | ---: | ---: |
| 1 lap | 6 | 9 | 11 |
| 2 laps | 13 | 19 | 180 |
| 3 laps | 23.5 | 39 | 239 |

These are regression scenarios, not an unbiased estimate of human play. The simple bots do not plan interception routes, optimize corner speed, or evaluate capture value. Damaged vessels and repeated captures can still produce very long races. Human playtests should assess whether current-lap progress should survive capture, whether crew movement needs expansion, and whether the fixed starting order advantages a seat. Those rules are unchanged in this pass.
