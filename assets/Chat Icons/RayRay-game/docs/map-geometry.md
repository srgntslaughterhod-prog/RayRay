# RayRay Arena - Map Geometry

## IMPORTANT

The approved map reference is authoritative.

DO NOT redesign the map without explicit approval.

The current geometry exists for gameplay reasons.

---

# Overall Shape

The complete battlefield is one large square.

The playable space should use essentially the entire interior of that square.

Avoid unnecessary dead space.

The battlefield contains:

- four large corner staging territories
- one large central diamond combat arena

The central arena is geometrically a square rotated approximately 45 degrees.

---

# Territories

The four territories correspond to:

- BTC
- ETH
- SOL
- BNB

Each territory contains:

- one base
- one large staging area
- exactly one entrance/exit to the central arena

Bases sit toward the far outside corner of their territory.

---

# Shared Walls

Neighboring territories are separated by shared impassable rock walls.

Do not create unnecessary parallel walls with unusable territory between them.

The walls exist to maximize usable gameplay area while preventing direct shortcuts between neighboring staging territories.

Enemy factions may physically be close together on opposite sides of a wall.

They still cannot fight through that wall.

They must use their designated arena entrance.

---

# Doorways

Every territory has EXACTLY ONE doorway.

Doorways are positioned on the territory boundary facing the central diamond arena according to the approved map reference.

No territory may have:

- side entrances
- alternate exits
- shortcuts to neighboring territories

Starting doorway width:

Approximately ten units wide for this playtest: 140 world units of clear space
using the original 14-unit reference diameter. Current unit collision diameter is
10.18325 after the latest 15% size increase; the opening remains 140 world units and fits
approximately 13.75 physical diameters. The centralized `GATEWAY_WIDTH_IN_UNITS = 10` sets the
default `BALANCE.doorwayWidth`. All four openings share that width; their locations
remain unchanged. This replaces the earlier three-unit-width test.

The full gateway opening is navigable terrain, with no invisible collision
boundary. Units approach, funnel through, and physically enter the central arena.
Rock walls still block movement outside the opening. No teleportation is used.

Exact width is a playtesting variable.

The gateways still funnel units through one opening per territory. A blocked
front can still create congestion, though ten units can now pass abreast.

It creates:

- defensive bottlenecks
- accumulating armies
- last stands
- breakout waves
- attack-line congestion

---

# Central Arena

The center contains one large diamond-shaped combat arena.

The arena serves as the shared battlefield.

Entering the central arena activates central-arena aggro behavior.

The arena should remain large enough for multiple armies to:

- enter
- collide
- redirect
- form battle lines
- cut through other factions' attack streams

---

# Map Design Principle

The geometry creates strategy.

Do not add unnecessary artificial comeback mechanics if the staging territories, choke points, spawning, and central arena already create those situations naturally.

---

# Future Geometry Easter Egg

After gameplay dimensions are finalized, convert the map into exact measurable geometry.

The final version should define:

- outer square dimensions
- exact center
- central diamond vertices
- wall coordinates
- doorway locations
- doorway width
- base locations
- symmetry relationships

The final mathematical relationship may later become a hidden RayRay Easter egg elsewhere in the project.

IMPORTANT:

Gameplay comes first.

Do not distort the gameplay map merely to force a prettier mathematical formula.

Finalize gameplay geometry first.

Derive the mathematics from the successful geometry second.