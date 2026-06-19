Adapting *Circus Imperium* into an online game is an awesome concept. Because the physical board game relies heavily on card draws (Whip, Cornering, Damage) and simultaneous execution, translating it into clean game logic requires converting those card decks and log sheets into clear math and state machines.

Here are the core, implementation-ready mechanics you need to build out your backend logic and data structures:

### 1. Vector Movement & Safe Turning Limits

The track grid uses hexagonal or staggered square spacing divided into lanes. Movement isn't just about moving forward; it requires managing velocity and lane changes.

* **Lane Changing Cost:** Changing lanes costs 1 point of your total movement for that turn.
* **The Drift Calculation:** When a chariot enters a turn hex/square, the engine checks its current `velocity` against the lane's `Safe Speed`.
* If `velocity` is less than or equal to `Safe Speed`, no check is needed.
* If `velocity` is greater than `Safe Speed`, calculate the excess: $\Delta V = \text{velocity} - \text{Safe Speed}$.
* The engine rolls a d10 (or draws from the Cornering Deck). The higher the $\Delta V$, the higher the probability the chariot forces a **Lane Drift** outward. If it hits the outer boundary lane, it suffers a collision.



### 2. The Beast State Machine & "The Whip"

The mounts are the engine of the chariot, but they have an internal "temperament" variable. You need a state machine for the beast entity:

```
[ Calm ] ──(Whip / Damage)──> [ Agitated ] ──(Trigger)──> [ Frenzied ]

```

* **Base Speed:** Max speed equals the beasts' current Health divided by 10 (e.g., 60 HP = 6 Max Speed).
* **Whip Mechanic:** If a player inputs a speed higher than their safe max, it triggers a `Whip` event:
* Roll a d10. On a 1–7, speed increases by 1–3 spaces. On an 8–10, the beasts attack the chariot.
* **The Backfire:** A failed whip inflicts `1d6` damage directly to the *Chariot Front* armor and sets the beast state to `Agitated`.


* **Frenzy State:** Triggered by specific card events or if the team is in last place at the end of a lap (the automated stadium laser hit).
* While `Frenzied`, the player's movement input is locked out.
* The engine automatically calculates movement: $\text{Velocity} = \text{Max Speed} + \text{1d10}$.
* The chariot moves strictly forward in its current lane, ignoring safe turn limits (forcing drift checks automatically).



### 3. Hit-Location Damage Architecture

Unlike modern games with a single health bar, *Circus Imperium* requires an object structure that tracks separate hit points for component parts. An attack or collision must pass through a hit-location table:

```json
{
  "chariot": {
    "front_armor": 20,
    "left_armor": 15,
    "right_armor": 15,
    "structure": 30
  },
  "crew": {
    "driver_hp": 10,
    "gladiator_hp": 10
  },
  "mounts": {
    "beast_hp": 60
  }
}

```

* **Collisions:** If a chariot drifts into a wall, damage is dealt directly to the armor quadrant facing the wall (`velocity * 2` damage). If armor hits 0, excess damage subtracts from `structure`. If `structure` hits 0, the chariot is destroyed, spawning a `Wreck` object on that hex and converting the crew into standalone `Pedestrian` entities.

### 4. Turn Resolution Phases (The Game Loop)

To handle the chaotic, semi-simultaneous nature of the board game online, the engine should process turns in strict, sequential phases:

1. **Input Phase:** All players secretly lock in their intended speed and lane changes for the turn.
2. **Movement Resolution Phase:** Chariots move in order from highest velocity to lowest velocity. The engine resolves drifts, whips, and collisions one chariot at a time.
3. **Combat Phase:** Once all movement stops, the engine checks ranges. Any Gladiator within 1 hex/square can execute an attack. Attacks in this phase are **simultaneous**—even if a Gladiator is killed during this phase, their locked-in attack still resolves before they are removed.
4. **Cleanup Phase:** Check for win conditions (lap counts) and update beast states (e.g., rolling to see if a `Frenzied` beast calms down).

### 5. Crew Disruption & Hijacking States

When a chariot is destroyed or a player decides to take a drastic action, the crew characters change their "Vehicle State." You'll need logic to handle these edge cases:

* **Unseated Crew:** If a chariot is destroyed but the crew survives, they become `Pedestrians`. Their movement is hard-coded to 1 hex per turn. They can be targeted by melee weapons or trampled by passing beasts.
* **Hijack Action:** If a `Pedestrian` or a Gladiator from a adjacent wreckage is in the same hex as an opposing chariot, they can input a `Hijack` command.
* This initiates a contested roll between the attacker and the target driver.
* If successful, the old driver is thrown overboard (becoming a `Pedestrian`), and the attacker's state updates to `Driver` of the new chariot object.

