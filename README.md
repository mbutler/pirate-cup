# Pirate Cup

A pirate racing board game for 2–6 local captains. Pick your speed, steer around the Twin Isles, ram rivals, and push your crew for extra movement at the risk of mutiny.

## Run locally

```sh
npm ci
npm run dev-nolog
```

Open http://localhost:8080. `dev-nolog` runs Vite without the template's telemetry script.

```sh
npm test                  # Rules-engine tests
npx tsc --noEmit           # Type checking
npm run build-nolog       # Production build in dist/
```

## Upload to a web host

Run `npm ci`, `npx tsc --noEmit`, and `npm run build-nolog`. Upload **the contents of `dist/`** to your host's public folder: `index.html`, `style.css`, `favicon.png`, and the complete `assets/` directory. The game is static and needs no Node server or backend. Relative asset paths support hosting at the domain root or in a subfolder (use its trailing-slash URL).

The prepared `pirate-cup-web.zip` contains these files at the archive root and can be extracted directly into the destination folder. Build output and the archive are generated artifacts excluded from Git; source changes are committed. Rebuild and recreate the archive after future edits. Google Fonts is optional; local fallback fonts are used if unavailable. Test over HTTP(S), not by opening `index.html` as a local file.

## Controls

Choose 2–6 captains and a race distance of 1–3 laps at the harbor, then **Set sail**. All captains share the screen and take turns.

- **Speed:** click a number and confirm, or use ↑ / ↓ and Enter.
- **Movement:** choose a direction and click **Move ship**, or use ← / → and Enter. Clicking a marked destination on the course moves immediately.
- **Flogging:** click **Flog the rowers** or **End turn**. Keyboard: Y / N, then Enter.
- **Boarding:** after movement, select a neighboring rival and **Lock attack**, or **Pass**. Keyboard: ← / → choose target, Enter locks the attack, N passes. Captains without eligible targets are skipped.
- **Round end:** click **Resolve combat** (or **Next round** if nobody attacks), or press Enter.
- **Finish:** the results show the winner and final standings. **Race again** starts a fresh race with the same number of captains and lap target.
- **How to play** explains movement, cornering, collisions, and mutiny. **Ship’s log** shows recent events.
- Sound and animation pace can be changed in the header. **Harbor** offers a confirmation before abandoning the current race.

The course is designed for a wide desktop or tablet display; the controls also adapt to narrow screens. Safe corner speeds appear directly on the course and movement choices show upcoming risks.

## Race rules and current scope

A race ends immediately when a ship completes the lap target or becomes the last surviving ship with no rival crews afloat. If all ships are wrecked, the race is a draw. Finished races accept no further game commands.

The fleet starts behind the marked finish line. Crossing it at the start does not award a lap. Each lap requires three ordered checkpoints: the western end of the course, the south straight beyond its midpoint, and the eastern end. Then cross the finish line heading west. Changing lanes and drifting can complete a lap; reversing across the line or taking the central shortcut cannot award an extra lap. Standings use completed laps and progress through these gates, with wrecked ships last.

Rams damage both ships and may push a chain of rivals. Forced displacement does not spend a rival’s movement allowance. When a push has no free exit, ships remain in distinct spaces and the attacking ship still spends its move. Cornering drift resolves the existing checks without generating an endless new set at each forced step.

Each surviving boarder may declare one strike against a neighboring living boarder, or pass. Strikes deal 4 boarder damage and resolve simultaneously against the pre-combat snapshot: a boarder defeated that round still lands their declared attack. Passing does not trigger an automatic counterattack. At zero health the boarder cannot fight, but their ship can continue racing. Mutiny does not prevent boarding.

Movement, lap victories, last-ship victories, rematches, boarding combat, weighted card outcomes, chain ramming, directional hull damage, and mutiny are playable locally. Displaced crews and hijacking are also playable. Online multiplayer remains unfinished.

`spec.md` contains early design notes, including mechanics that differ from the implementation. Current play uses sequential captain turns, not secret simultaneous planning. With at least two surviving ships, the last-place penalty fires after each round and is presented as a warning shot; its existing engine event is still named `ARENA_LASER`.

## Structure

- `src/core/`: seeded randomness, game state, actions, events, track graph, and rules. Independent of Phaser.
- `src/client/`: Phaser course and ship rendering, race controller, and responsive HTML interface.
- `public/style.css`: harbor, fleet status, captain controls, and dialog styling.
- `public/assets/`: course tilemap, ship sprites, and audio.
- `tests/core/`: rules-engine regression tests.

The local session dispatches actions through the rules engine and plays the resulting events. Keeping these separate allows a future server to run the same rules.

### Wreck survivors and hijacking

Losing all hull integrity or all rowers disables a vessel and releases its surviving captain and boarder into a dinghy. After all ships move and before boarding combat, each displaced crew may row one neighboring hex, attempt to hijack a vessel on its hex or an adjacent hex, wait, or retire from the race.

Both sides roll d10 and add boarding strength: helm skill (8 for a captain or 7 for a replacement boarder), minus 1 per 3 health lost by that character, plus 1 if both crew members survive. Target buttons show exact success odds. The attacker must beat the defender; a failed attempt costs 4 health (captain first, then boarder). Success transfers the vessel, including its existing hull and rower damage, to the attacker. Defenders escape and act starting next round. Completed laps stay with the captain; a capture resets progress through the current lap. These are provisional Pirate Cup adaptations for playtesting and balance. Mutiny recovery also uses helm skill rather than raw health; a healthy captain has an 80% recovery chance. Warning shots require at least two surviving vessels, so the only ship left is not repeatedly punished as last place.

Surviving rival crews prevent a last-ship victory. Finishing the required laps still wins immediately; if no vessels remain, the race is a draw. Crew orders, health, positions, capture results, and ownership changes are shown in the race UI.

See [playtest and balance notes](docs/playtest-balance.md) for reference sources, adaptation choices, reproducible simulations, and remaining pacing issues.

### Computer captains

Choose Human or Computer for each seat in the harbor. The default is one human against three computers; all-human hot-seat and all-computer spectator races are also supported. Rematches retain those assignments. Capturing a vessel transfers its controls with the captain, not the ship slot.

Computer captains use public state only, with no access to future random draws. They look ahead for corner speeds, favor forward progress, weigh ramming against damage, limit flogging to healthy crews in clear water, attack nearby boarders, and seek a vessel after being displaced. They never automatically retire. This is a single heuristic opponent, not a difficulty system or optimal strategy. Opening help or the log pauses new computer decisions; leaving the race cancels pending computer turns.

`npx vitest run tests/core/ai.test.ts` checks 75 complete computer races across every supported fleet size and distance, plus crew actions, control ownership and corner behavior.
