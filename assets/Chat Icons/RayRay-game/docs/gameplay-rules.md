# RayRay Arena - Gameplay Rules

## Match Structure

Every match contains exactly four factions:

- BTC
- ETH
- SOL
- BNB

V0.1:

- SOL = local human (default; no faction-selection screen)
- BTC, ETH, BNB = bots

Victory condition:

> LAST BASE STANDING

When only one base remains alive, that faction wins.

---

# Points

Points are earned through combat.

Enemy unit killed:

+1 point

Points are used for:

- ATK
- DEF
- +UNIT

Base damage does not award points unless explicitly changed after playtesting.

---

# ATK

ATK increases attack effectiveness.

Initial prototype rule:

- ATK starts at level 1. Upgrade cost equals the current level: `nextATKCost = currentATK`.
- For example, ATK 1 -> 2 costs 1 point; ATK 8 -> 9 costs 8 points; ATK 25 -> 26 costs 25 points.
- The ATK button displays current ATK and the next purchase cost.
- ATK has no maximum

Unit attack damage is based on the commander's current ATK.

Displayed ATK remains an integer. Combat uses
`effectiveATK = 1 + (displayedATK - 1) * BALANCE.combatValuePerLevel`, where
`BALANCE.combatValuePerLevel` defaults to **0.25**. Level 1 is 1.00 internally;
levels 2, 3, 5, 10, 15, and 20 are 1.25, 1.50, 2.00, 3.25, 4.50, and 5.75.
Attack damage is `4 + effectiveATK`; the baseline remains 5 damage. Do not display
internal decimals in the commander UI. Purchase costs use displayed ATK.

ATK visual equipment milestones occur at:

- ATK 5
- ATK 10
- ATK 15
- ATK 20

Visual equipment progression stops after ATK 20.

ATK may continue increasing numerically after ATK 20.

Primary visual indicator:

Weapon quality.

Secondary subtle indicator:

Life-support / oxygen equipment may become slightly larger at major equipment tiers.

---

# DEF

DEF increases unit survivability.

Displayed DEF remains an integer. Combat uses
`effectiveDEF = 1 + (displayedDEF - 1) * BALANCE.combatValuePerLevel`, sharing the
configurable **0.25** increment with ATK. Internal values follow the same examples
as ATK. Unit HP is `12 + effectiveDEF * 3`; baseline HP remains 15. Each displayed
DEF upgrade adds 0.75 HP to existing units and new-unit maximum HP, preserving
damage already taken. Do not display internal decimals. Purchase costs use
displayed DEF.

Initial prototype rule:

- DEF starts at level 1. Upgrade cost equals the current level: `nextDEFCost = currentDEF`.
- For example, DEF 1 -> 2 costs 1 point; DEF 8 -> 9 costs 8 points; DEF 25 -> 26 costs 25 points.
- The DEF button displays current DEF and the next purchase cost.
- DEF has no maximum

DEF visual milestones occur at:

- DEF 5
- DEF 10
- DEF 15
- DEF 20

Visual equipment progression stops after DEF 20.

DEF may continue increasing numerically after DEF 20.

Primary subtle visual indicator:

Helmet/protection level.

Do not turn DEF progression into elaborate armor.

---

# Equipment Progression

There is NO EVOLVE button.

Equipment progression occurs automatically through ATK and DEF development.

Milestones:

5  -> Tier modifier +1
10 -> Tier modifier +2
15 -> Tier modifier +3
20 -> Tier modifier +4

The unit should remain recognizably the same character throughout the match.

Weapons provide the clearest visual progression.

---

# +UNIT

The spawn timer NEVER changes.

The commander increases the number of units created during each spawn event.

Starting production:

1 unit per spawn

Maximum production:

5 units per spawn

## Upgrade 1

Requirements:

ATK >= 5
DEF >= 5

Cost:

10 points

Result:

2 units per spawn

## Upgrade 2

Requirements:

ATK >= 10
DEF >= 10

Cost:

20 points

Result:

3 units per spawn

## Upgrade 3

Requirements:

ATK >= 15
DEF >= 15

Cost:

30 points

Result:

4 units per spawn

## Upgrade 4

Requirements:

ATK >= 25
DEF >= 25

Cost:

50 points

Result:

5 units per spawn

After purchasing a +UNIT level, the button becomes unavailable until the next milestone requirements are satisfied.

After reaching 5 units per spawn, +UNIT remains permanently unavailable.

Production increases only through purchasing these tiers. Higher ATK or DEF
never automatically increases production. Each tier requires both stat thresholds,
its full point cost, and the previous production tier.

All +UNIT thresholds use DISPLAYED integer ATK/DEF levels, never the effective
decimal combat values. Combat scaling does not change prices, eligibility, or
production limits.

The shared ATK/DEF cost formula and +UNIT costs are centralized in the
`BALANCE` configuration in [simulation.js](../simulation.js) for playtesting.

---

# +UNIT Interface Behavior

When unavailable:

- dark
- disabled

When stat requirements AND point requirements are satisfied:

- bright
- active

No elaborate unlock animation is required.

The +UNIT button displays current units per spawn, next purchase cost, and
required ATK/DEF. At five units per spawn it displays Maximum and stays disabled.
Avoid repeating these details in explanatory text around the controls.

---

# Unit Movement AI

Unit AI should remain deliberately simple.

Normal behavior:

1. Find nearest living enemy base.
2. Move toward that base.
3. Continue watching for nearby enemy units.
4. If an enemy enters local aggro radius, engage.
5. After combat ends, recalculate.
6. Find nearest living enemy base from CURRENT position.
7. Continue moving.

Units do NOT permanently remember their original target.

Combat may therefore redirect an army toward another base.

If a friendly unit blocks forward movement, try simple local avoidance to either
side while continuing generally toward the current route objective. Units cannot
pass through one another or rock walls. Enemy encounters still use the existing
combat/aggro rules, and rock walls still use legal routes. There are no formations
or coordinated flanking. Narrow doorways retain crowding, pressure, and staging
accumulation; open terrain should allow a wider combat front.

---

# Local Aggro

All units have a local enemy detection radius.

If an enemy enters local aggro range:

- stop normal base movement
- engage enemy
- fight
- reassess battlefield after combat

The radius should be large enough to encourage unit combat.

Exact radius is a playtesting variable.

---

# Central Arena Aggro

The central diamond is a special combat zone.

While a unit is inside the central arena:

- enemy units within the arena create combat aggro
- the unit prioritizes enemy warriors
- the unit moves toward an arena enemy
- actual attack range remains short

Arena aggro does NOT mean units can attack across the arena.

Arena aggro only determines combat targeting and movement priority.

When appropriate arena combat ends, the unit returns to nearest-base logic.

---

# Bases

Initial base HP:

500

Base regeneration:

2 HP per second

Maximum:

500 HP

Bases:

- do not attack
- have no weapons
- do not move
- depend on their warriors for defense

Base regeneration should not exceed maximum HP.

During active base damage, regeneration stops.

Exact regeneration timing behavior may be tuned through playtesting.

---

# Base Elimination

When base HP reaches 0:

- base is destroyed/eliminated
- commander is eliminated
- faction stops spawning new units

Already existing faction units may continue fighting until destroyed.

---

# Spawn Behavior

Spawn interval:

Fixed.

The current prototype interval is 1.5 seconds (half the previous 3 seconds),
centralized in `BALANCE.spawnInterval` for playtesting. Attack interval remains
1.0 second; movement speed and units per spawn are unchanged.

Upgrades must never make the spawn TIMER faster.

+UNIT changes only the NUMBER of units produced per spawn event.

If the staging territory is blocked:

- spawning should continue where physically possible
- units should accumulate inside the staging territory

This accumulation is intentional gameplay.

Each faction has a small spawn zone immediately in front of its base on the
arena-facing side, within its staging territory. The first unit appears directly
in front of the base when that position is free. Additional wave units spread
into nearby legal front-and-side positions without overlap. Positions are searched
in expanding rings around the base, always preferring base proximity, not arena
entrance proximity. Congestion accumulates naturally from the base outward.

The intended flow is BASE -> STAGING AREA -> DOORWAY -> CENTRAL ARENA.

The entire unit must remain ahead of its own base and outside the central arena,
bases, rock walls, and other living units. Spawn positions never extend behind
the base or into its doorway/gate. If all designated positions are blocked, no
unit is placed; the base tries again at its next regular spawn event without
invalid fallback placement.

---

# Bot Rules

Bots use the same:

- points
- ATK
- DEF
- +UNIT requirements
- unit statistics

Bots receive no secret combat bonuses.

Bot upgrade strategy must remain easy to modify during testing.

---

# Balance Philosophy

These variables are NOT permanently finalized:

- spawn interval
- movement speed
- local aggro radius
- attack range
- attack speed
- unit health formula
- ATK formula
- DEF formula
- base regeneration delay
- doorway width

Keep these values centralized and easy to tune.

# Attack Speed

V1 attack speed:

1 attack per second

Attack speed is identical for all factions and units.

ATK increases damage per attack.
ATK does NOT increase attack speed.

For V1:

- Attack interval: 1.0 second
- Attack speed is not upgradeable
- Attack speed should be stored as a configurable gameplay value for testing

Future versions may introduce ATTACK SPEED as a separate commander upgrade.

Do not implement attack-speed upgrading in V1.