# RayRay Arena - Game Design

## Core Philosophy

RayRay Arena is intentionally simple.

The player is a COMMANDER, not a unit controller.

The commander improves the army. The warriors decide how to fight based on simple autonomous rules.

The game should create complex and unpredictable battles from very simple systems.

The core philosophy is:

> Simple rules. Emergent battles. Easy to play. Fun to watch.

Do not add complexity unless testing proves that complexity is necessary.

---

## Core Gameplay Loop

1. Bases automatically spawn units.
2. Units leave their staging area and seek enemy bases.
3. Units encounter enemies and fight automatically.
4. Kills award points to the commander's faction.
5. The commander spends points on:
   - ATK
   - DEF
6. Stronger armies push toward enemy bases.
7. Bases are destroyed.
8. The last surviving base wins.

---

## Commander Controls

The player has only two strategic upgrade controls:

- ATK
- DEF

The player does NOT:

- move individual units
- select units
- create formations
- issue attack commands
- choose individual targets
- control unit movement

The standing order for every warrior is essentially:

> GO FIGHT.

---

## Four Commander Model

Every match always contains four commander slots.

A commander may eventually be controlled by:

- HUMAN
- BOT
- REMOTE HUMAN

V0.1 uses:

- Choose SOL, BTC, ETH, or BNB in setup to control that commander; no initial selection.
- The other three commanders are bots. BOT BATTLE makes all four bots.
- Faction selection sits between New Game and BOT BATTLE and locks during gameplay.

The game simulation must not depend on a commander being human.

Future multiplayer should be able to replace bots with human commanders without rebuilding the core game.

If multiplayer is eventually implemented and a human disconnects, the intended design is for a bot to assume that commander position without ending the match.

---

## Factions

Initial prototype factions:

- BTC
- ETH
- SOL
- BNB

For V0.1, factions are mechanically identical.

They differ only in visual identity and color.

Faction-specific units, abilities, statistics, technologies, or advantages are OUT OF SCOPE for the initial prototype.

---

## Design Principle: Emergent Strategy

Interesting situations should primarily emerge from:

- map geometry
- narrow doorways
- unit accumulation
- proximity combat
- central arena combat
- ATK investment
- DEF investment
- base regeneration
- changing battlefield position

Avoid scripted comeback systems whenever normal gameplay can create the comeback naturally.

Example:

A base may become trapped behind its doorway while newly spawned defenders accumulate inside its staging territory.

If the defenders eventually break through, the stored army may suddenly enter the arena as a large wave.

That behavior should emerge naturally from spawning, collision, walls, and combat.

---

## Scope Protection

Do NOT add the following without explicit approval:

- direct unit control
- inventory
- crafting
- spells
- commander abilities
- resource mining
- workers
- multiple currencies
- equipment inventory
- skill trees
- blockchain functionality
- wallet connections
- token rewards
- advertising
- accounts
- matchmaking
- leaderboards
- map editor
- community maps
- elaborate faction abilities

The first objective is to prove that the core battle itself is fun.

---

## Development Rule

When choosing between:

1. a complicated solution, and
2. a simple solution that produces the intended gameplay,

choose the simple solution.
