c# RayRay Arena Repository Instructions

Before modifying RayRay Arena, read:

- docs/GAME-DESIGN.md
- docs/GAMEPLAY-RULES.md
- docs/MAP-GEOMETRY.md
- docs/ART-DIRECTION.md

Treat these documents as authoritative.

Also inspect the approved visual references:

- game-assets/arena-map-reference.png
- game-assets/unit.png

## Core Rules

Do not redesign approved gameplay systems, map geometry, or visual concepts without explicit instruction.

Do not introduce additional mechanics merely to improve or expand the game.

RayRay Arena is intentionally simple.

The player is a commander, not a unit micromanager.

Prefer simple implementations that produce the documented gameplay behavior.

## V1 Priorities

1. Correct gameplay
2. Correct map geometry
3. Reliable autonomous units
4. Clear combat
5. Easy balance tuning
6. Performance
7. Visual polish

Do not prioritize visual polish over gameplay.

## Architecture

Keep these systems logically separated:

- game simulation
- commander decisions
- unit AI
- spawning
- combat
- base state
- rendering
- user interface

There are always exactly four commander slots.

A commander controller should be replaceable so a slot may eventually be controlled by:

- local human
- bot
- remote human

Do NOT implement multiplayer in V1.

However, avoid architecture that would require rewriting the game simulation to add multiplayer later.

## Balance Values

Keep important balance values centralized and easy to modify.

Do not scatter hard-coded balance numbers throughout the code.

This includes:

- base HP
- base regeneration
- spawn interval
- movement speed
- attack interval
- attack range
- aggro radius
- arena aggro behavior
- ATK
- DEF
- +UNIT milestones
- +UNIT costs
- doorway width

## Visual References

The arena reference image establishes the intended map layout and base concept.

Do not redesign the map.

The unit reference establishes the canonical V1 unit:

- top-down
- compact spaceman
- bubble helmet
- simple suit
- oxygen pack
- arms
- pickaxe
- no visible walking legs required

V1 does not require visual equipment upgrades.

Faction variants should primarily use color.

## Scope

Do not add features outside the documented V1 scope without explicit approval.

If a requirement appears ambiguous, preserve the simplest implementation consistent with the documentation.

Build the smallest working game first.

Test gameplay before expanding scope.

# Display / Layout

RayRay Arena should use the full available browser viewport.

The game should feel like a full-page browser game, not a small embedded widget.

Requirements:

- Game container fills 100% of the available viewport width.
- Game container fills 100% of the available viewport height.
- Remove unnecessary page margins and padding around the game.
- Avoid normal page scrolling during gameplay.
- Resize the game responsively when the browser window changes size.
- Preserve the square battlefield's proportions.
- Do NOT stretch or distort the arena.
- Center the battlefield within the available gameplay area.
- Use remaining screen space for commander controls, faction statistics, base HP, points, and other required UI.
- The battlefield should occupy as much screen space as practical.
- UI should remain readable without unnecessarily shrinking the battlefield.

For V0.1, prioritize desktop/laptop browser play.

The game should still avoid breaking on smaller browser windows, but full mobile optimization is not required for this prototype.

Do not place RayRay Arena inside a small fixed-size canvas or card.

The intended experience is:

OPEN GAME -> BROWSER PAGE BECOMES THE GAME.

The game is intended to be a full-viewport browser experience. Do not implement it as a small fixed-size embedded game panel.