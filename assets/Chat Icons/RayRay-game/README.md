# RayRay Arena V0.1 — Local prototype

The website serves the game at [/RayRayArena/](../../../RayRayArena/index.html).
The homepage desktop and mobile navigation include an Arena link; the game has a
Back to RayRay link. The Mission Manual is unchanged.
For local play, open [the arena page](../../../RayRayArena/index.html) in a current
desktop browser; the old [index.html](index.html) redirects there.
No install, build, wallet, backend, or network connection is needed for local play.
Deploy the `RayRayArena` folder together with the existing `assets/Chat Icons/RayRay-game`
folder and homepage. The arena page's relative base URL loads the shared scripts,
stylesheet, and approved artwork without duplicating the game.
Choose **SOL, BTC, ETH, or BNB** before starting a human match; no faction is
selected initially. The selection row sits between the upgrade buttons and New Game and
locks during gameplay. Other factions are bots with identical rules. Your choice
is retained between matches; BOT BATTLE requires no faction selection.

The square battlefield fills the largest square that fits beside the commander
panel. The compact panel keeps controls and all four commander slots visible
without scrolling at normal playtest sizes. Smaller windows put the controls below
the battlefield, with commander slots in two columns. Help text and guide/test
links are omitted from the gameplay panel.
The gameplay page itself does not scroll. There is no pause control or automatic
tab-switch pause. The page opens in setup: choose Easy, Medium (default), or Hard
below New Game, then press New Game to start. Difficulty is locked during gameplay.
New Game during play discards the match and returns to setup; press it again to
start. After a match ends, difficulty unlocks for the next game. Browsers may throttle
simulation updates in background tabs.
BOT BATTLE independently starts an all-bot spectator match, including SOL.
During play, press BOT BATTLE to discard the current match and unlock setup.
Choose speed and difficulty, then press BOT BATTLE again to start a fresh bot match.
Settings lock while the battle runs. Manual upgrades remain disabled. New Game never
starts a bot match: from spectator mode it starts a human match with the selected
faction, or returns to faction setup if none is selected.
Below difficulty, NORMAL (default), FAST, and FASTEST select movement speed for
all units in either match type: 65, 97.5 (+50%), or 130 (+100%) world units per
second. Speed locks during gameplay, unlocks in setup or after a match ends, and
is retained between matches. Attack and spawn timing do not change.
Difficulty changes only bot purchase reaction delay: **Easy 1 second**, **Medium
0.875 seconds**, **Hard 0.75 seconds** of match time after choosing an affordable
upgrade (`BALANCE.botReactionDelay` defaults to Medium). On **FASTEST only**, total
bot reaction delays are **Easy 1 second**, **Medium 0.75 seconds**, and **Hard
0.5 seconds**, in both match types. NORMAL and FAST retain the delays above.
Their existing 1.2-second decision-check
interval, upgrade priorities, prices, and eligibility rules remain unchanged.

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
  At match start, all units instead advance toward the center. The first living
  enemy melee contact with clear line of sight releases every faction to normal
  targeting for the rest of the match; followers and later spawns share the
  opening center objective until that contact. No teleportation or speed changes.
  When a friendly blocks movement, units try legal local steps to either side.
  They cannot pass through units or walls; narrow doors still create congestion.
- Each enemy unit kill awards its killer's commander one point.
- ATK and DEF start at level 1 and increase by one without a cap. Upgrade cost
  equals the current level (`upgradeCost = currentLevel`): level 1 -> 2 costs
  1 point, level 8 -> 9 costs 8 points, and level 25 -> 26 costs 25 points.
- Production stays at one unit per spawn for every faction. +UNIT is removed
  from controls, simulation purchases, and bot decisions.
- ATK/DEF buttons show current stats and next costs.
- Base HP starts at 1000. Regeneration is 2 HP/second after three seconds without
  damage. Bases have no weapons.
- Destroyed bases stop spawning. Existing units remain active.
- The last living base wins. An eliminated human can watch the remaining battle.

## Files and tuning

`BALANCE.statUpgradeCost` is the shared configurable ATK/DEF cost formula.
Both human and bot commanders use the same ATK/DEF simulation purchase rules.
`BALANCE.spawnInterval` is 1.5 seconds (half the previous interval) and remains
adjustable. Units move at 65 world units/second (25% faster than 52).
Production is fixed at one unit per event; attack interval is unchanged.

- [simulation.js](simulation.js): authoritative state, centralized `BALANCE`,
  geometry/visibility routing, spawning, AI, collision, combat, upgrades, and victory.
- [controllers.js](controllers.js): local-human command queue and bot decisions.
  Controllers interact through `upgradeState` and `purchase`; replace a controller
  later without changing unit/spawn/combat systems. No remote controller is implemented.
- [renderer.js](renderer.js): approved terrain/base artwork and canonical unit
  sprite, small faction emblems without base-name text, faction accent recoloring,
  HP bars, and simple pickaxe swing. The central arena has no text label.
  Unit sprites render at 32.0045 world units wide, another 15% increase in width and height.
  Collision radius also increases 15% to 5.091625; spawn and movement spacing use the
  resulting 10.18325-unit physical diameter.
- [game.js](game.js): fixed-step loop, UI, resizing, restart, and controller wiring.
- [arena.css](arena.css): full-viewport layout.

Displayed ATK/DEF remain integer levels, starting at 1 and uncapped. Internal combat
value = `1 + (displayedLevel - 1) × BALANCE.combatValuePerLevel`, with a configurable
increment of **0.125**. Level 1 = 1.00, level 5 = 1.50, level 10 = 2.125, and level
20 = 3.375 internally; these decimal values are not shown in the commander UI.
Unit HP = `12 + effectiveDEF × 3`. Attack damage = `4 + effectiveATK`. Each displayed
DEF upgrade adds **0.375 HP** to existing faction units (preserving damage already
taken) and new-unit maximum HP; each ATK upgrade adds **0.125 damage**.
Purchase costs still use displayed levels, not combat values.
Attack interval is **1.0 second**, independently of ATK. These are initial
playtesting values, not permanent balance decisions.

The map uses a 1000×1000 simulation square, center (500,500), diamond vertices
(500,166), (834,500), (500,834), (166,500), four midpoint doors, and shared
cardinal rock walls. Each faction has exactly one symmetric gateway with **140 world
units** of clearance (ten original 14-unit diameters, or approximately 13.75 current 10.18325-unit
physical diameters). `GATEWAY_WIDTH_IN_UNITS = 10` in
[simulation.js](simulation.js) sets the default `BALANCE.doorwayWidth`; world-unit
width overrides remain available for playtesting. Gateway positions and the rest
of the rock-wall layout are unchanged. The full opening is navigable in both directions;
units funnel through it without teleporting. Blocked gateways still cause physical
congestion and staging accumulation: there is no arbitrary army-count cap.
Gateway terrain comes directly from the saved map image, without copied terrain
patches or translucent gateway circles. Collision and pathing remain independent
of the background artwork.
Only gameplay-boundary rocks are impassable; decorative terrain in the reference
does not introduce new walls or entrances.

The supplied references are actually named
[game-assets/reference/area-map-reference.png](game-assets/reference/area-map-reference.png)
and [game-assets/reference/unit.png](game-assets/reference/unit.png).
The supplied instructions are [.github/GitHub-instructions.md](.github/GitHub-instructions.md),
not `.github/copilot-instructions.md`. The source references are unchanged.
[game-assets/reference/arena-terrain (2).png](<game-assets/reference/arena-terrain (2).png>)
is the latest supplied gameplay terrain. The renderer loads that image directly;
it does not copy terrain patches over its gateways.
The four local faction-logo SVGs provide the small base identifiers.
V0.1 deliberately omits visual equipment tiers and walking animation.

## Validation

Open [tests.html](tests.html) to run deterministic browser-only simulation tests.
They cover all four commander slots, gates and routes, spawn timing/congestion,
ten-abreast gateway traversal in both directions, walls blocking outside the
openings, friendly avoidance, exact
combat scaling, displayed-level upgrade thresholds/costs, aggro, wall blocking,
kill credit, cooldowns, regeneration, elimination, autonomous base attacks, and
victory. A bounded default-match playtest checks ongoing combat and the production cap;
a two-base fixture checks victory without requiring a default match to end on
a fixed schedule after balance changes.

For gameplay testing, let the match run, buy upgrades with earned points, resize
the window, and verify doorway congestion/breakouts. Browser canvas support and
JavaScript must be enabled. Artwork-loading failures are shown explicitly.
