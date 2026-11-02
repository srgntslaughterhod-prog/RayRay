# RayRay Arena V0.1 — Local prototype

Open [index.html](index.html) directly in a current desktop browser. No install, build,
wallet, network connection, or production website integration is needed.
You command **SOL**; BTC, ETH, and BNB are bots with identical rules.

The square battlefield fills the largest square that fits beside the commander
panel. Smaller windows put the scrollable controls below the battlefield.
The gameplay page itself does not scroll. Pause/resume and New match are local
playtest controls, not commander abilities. Switching to another browser tab pauses
the match to avoid missed upgrades or background simulation catch-up.

## Playing

- Bases spawn every **1.5 seconds**, initially one unit per event.
- Spawns start immediately in front of their base, on its arena-facing side.
  Additional units use nearby legal front-and-side positions, always preferring
  space closer to the base rather than the doorway. Congestion fills outward
  through the staging territory. Units never spawn at the doorway, behind/inside
  their base, in the arena, in walls, or overlapping another unit. A full spawn
  area waits until a later regular event has space.
- Units seek the nearest living enemy base, interrupt for local enemies, and
  prioritize enemy units in the central diamond. Attacks remain short-range.
  When a friendly blocks movement, units try legal local steps to either side.
  They cannot pass through units or walls; narrow doors still create congestion.
- Each enemy unit kill awards its killer's commander one point.
- ATK and DEF start at level 1 and increase by one without a cap. Upgrade cost
  equals the current level (`upgradeCost = currentLevel`): level 1 -> 2 costs
  1 point, level 8 -> 9 costs 8 points, and level 25 -> 26 costs 25 points.
- +UNIT requires both ATK and DEF at 5, 10, 15, then 25, and costs 10, 20, 30,
  then 50 points. Production increases only when purchased and caps at five;
  higher stats do not automatically increase it. The timer never speeds up.
- ATK/DEF buttons show current stats and next costs. The +UNIT button shows
  current units/spawn, next cost, and required stats without duplicate control text.
- Base HP starts at 500. Regeneration is 2 HP/second after three seconds without
  damage. Bases have no weapons.
- Destroyed bases stop spawning. Existing units remain active.
- The last living base wins. An eliminated human can watch the remaining battle.

## Files and tuning

`BALANCE.statUpgradeCost` is the shared configurable ATK/DEF cost formula.
`BALANCE.unitCosts` contains the four production-tier costs. Both human and bot
commanders use these same simulation purchase rules.
`BALANCE.unitMilestones` contains the paired ATK/DEF thresholds.
`BALANCE.spawnInterval` is 1.5 seconds (half the previous interval) and remains
adjustable. Production tiers, movement speed, and attack interval are unchanged.

- [simulation.js](simulation.js): authoritative state, centralized `BALANCE`,
  geometry/visibility routing, spawning, AI, collision, combat, upgrades, and victory.
- [controllers.js](controllers.js): local-human command queue and bot decisions.
  Controllers interact through `upgradeState` and `purchase`; replace a controller
  later without changing unit/spawn/combat systems. No remote controller is implemented.
- [renderer.js](renderer.js): approved terrain/base artwork and canonical unit
  sprite, small faction emblems without base-name text, faction accent recoloring,
  HP bars, and simple pickaxe swing. The central arena has no text label.
- [game.js](game.js): fixed-step loop, UI, resizing, pause/restart, and controller wiring.
- [arena.css](arena.css): full-viewport layout.

Displayed ATK/DEF remain integer levels, starting at 1 and uncapped. Internal combat
value = `1 + (displayedLevel - 1) × BALANCE.combatValuePerLevel`, with a configurable
increment of **0.25**. Level 1 = 1.00, level 5 = 2.00, level 10 = 3.25, and level
20 = 5.75 internally; these decimal values are not shown in the commander UI.
Unit HP = `12 + effectiveDEF × 3`. Attack damage = `4 + effectiveATK`. Each displayed
DEF upgrade adds **0.75 HP** to existing faction units (preserving damage already
taken) and new-unit maximum HP; each ATK upgrade adds **0.25 damage**.
Purchase costs and +UNIT eligibility still use displayed levels, not combat values.
Attack interval is **1.0 second**, independently of ATK. These are initial
playtesting values, not permanent balance decisions.

The map uses a 1000×1000 simulation square, center (500,500), diamond vertices
(500,166), (834,500), (500,834), (166,500), four midpoint doors, and shared
cardinal rock walls. Each faction has exactly one symmetric gateway with **140 world
units** of clearance (ten 14-unit diameters). `GATEWAY_WIDTH_IN_UNITS = 10` in
[simulation.js](simulation.js) sets the default `BALANCE.doorwayWidth`; world-unit
width overrides remain available for playtesting. Gateway positions and the rest
of the rock-wall layout are unchanged. The full opening is navigable in both directions;
units funnel through it without teleporting. Blocked gateways still cause physical
congestion and staging accumulation: there is no arbitrary army-count cap.
The renderer clears the old baked-in doorway rocks within the configured opening
so visible gateway terrain matches the navigable width.
Only gameplay-boundary rocks are impassable; decorative terrain in the reference
does not introduce new walls or entrances.

The supplied references are actually named
[game-assets/reference/area-map-reference.png](game-assets/reference/area-map-reference.png)
and [game-assets/reference/unit.png](game-assets/reference/unit.png).
The supplied instructions are [.github/GitHub-instructions.md](.github/GitHub-instructions.md),
not `.github/copilot-instructions.md`. The source references are unchanged.
[game-assets/arena-terrain.png](game-assets/arena-terrain.png) is the gameplay
copy with only the five baked-in text labels removed; terrain geometry is unchanged.
The four local faction-logo SVGs provide the small base identifiers.
V0.1 deliberately omits visual equipment tiers and walking animation.

## Validation

Open [tests.html](tests.html) to run deterministic browser-only simulation tests.
They cover all four commander slots, gates and routes, spawn timing/congestion,
ten-abreast gateway traversal in both directions, walls blocking outside the
openings, friendly avoidance, exact
combat scaling, displayed-level upgrade thresholds/costs, aggro, wall blocking,
kill credit, cooldowns, regeneration, elimination, autonomous base attacks, and
victory. A bounded default-match playtest checks ongoing combat and base damage;
a two-base fixture checks victory without requiring a default match to end on
a fixed schedule after balance changes.

For gameplay testing, let the match run, buy upgrades with earned points, resize
the window, and verify doorway congestion/breakouts. Browser canvas support and
JavaScript must be enabled. Artwork-loading failures are shown explicitly.
