(() => {
  "use strict";
  const { Simulation, GATEWAY_WIDTH_IN_UNITS, LocalHumanController, BotController, createControllers, DEFAULT_HUMAN_SLOT, distance, combatValueFor, damageFor, healthFor } = window.RayRayArena;
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const close = (a, b) => Math.abs(a - b) < 0.001;
  function test(name, run) {
    const result = { name, ok: true };
    try { run(); } catch (error) { result.ok = false; result.error = error.message; console.error(name, error); }
    results.push(result);
    const row = document.createElement("li");
    row.className = result.ok ? "pass" : "fail";
    row.textContent = `${result.ok ? "PASS" : "FAIL"}: ${name}${result.error ? ` — ${result.error}` : ""}`;
    document.getElementById("results").append(row);
  }
  function advance(simulation, seconds) {
    const steps = Math.round(seconds / simulation.config.fixedStep);
    for (let i = 0; i < steps; i++) simulation.step(simulation.config.fixedStep);
  }
  function placed(simulation, slot, x, y) {
    simulation.openingAdvance = false;
    const unit = simulation.spawn(slot);
    assert(unit !== null, "Expected a spawn position.");
    Object.assign(unit, { x, y });
    return unit;
  }

  test("Every opening unit advances to center until first enemy melee contact", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const leaders = [0, 1, 2, 3].map((slot) => sim.spawn(slot));
    for (let slot = 0; slot < 4; slot++) {
      const follower = sim.spawn(slot);
      assert(sim.selectTarget(leaders[slot]).entity === sim.geometry.center &&
        sim.selectTarget(follower).kind === "rally", "Leaders and followers share center objective.");
    }
    let steps = 0;
    while (sim.openingAdvance && steps++ < 600) {
      sim.step(sim.config.fixedStep);
      if (sim.openingAdvance) {
        assert(sim.commanders.every((commander) => commander.points === 0), "No pre-contact point advantage.");
        const distances = leaders.map((unit) => distance(unit, sim.geometry.center));
        assert(Math.max(...distances) - Math.min(...distances) < sim.config.unitRadius * 2, "First units stay within one physical diameter despite local crowd avoidance.");
      }
    }
    assert(!sim.openingAdvance && steps < 600, "First contact releases normal combat.");
    assert(leaders.every((unit) => distance(unit, sim.geometry.center) < 25), "All first units meet in the middle.");
    assert(sim.units.every((unit) => unit.target?.kind !== "rally"), "All opening paths are cleared together.");
    assert(sim.commanders.reduce((sum, commander) => sum + commander.kills, 0) === 0, "Opening releases on contact, not first kill.");
    const later = sim.spawn(0);
    assert(sim.selectTarget(later).kind !== "rally", "Later waves use normal targeting permanently.");
  });
  test("Opening contact ignores dead units, allies, distant enemies, and enemies across walls", () => {
    const sim = new Simulation({ spawnInterval: 1000, movementSpeed: 0 });
    const a = sim.spawn(0), b = sim.spawn(1);
    Object.assign(a, { x: 480, y: 100 });
    Object.assign(b, { x: 520, y: 100 });
    sim.config.attackRange = 60;
    sim.step(sim.config.fixedStep);
    assert(sim.openingAdvance, "Wall prevents false contact.");
    Object.assign(a, { x: 490, y: 500 });
    Object.assign(b, { x: 510, y: 500, hp: 0 });
    sim.step(sim.config.fixedStep);
    assert(sim.openingAdvance, "Dead enemy does not release opening.");
    b.hp = 15;
    sim.units.push(b);
    b.slot = 0;
    sim.step(sim.config.fixedStep);
    assert(sim.openingAdvance, "Friendly proximity does not release opening.");
    b.slot = 1;
    b.x = 700;
    sim.step(sim.config.fixedStep);
    assert(sim.openingAdvance, "Aggro or visibility alone is not contact.");
    b.x = 510;
    sim.step(sim.config.fixedStep);
    assert(!sim.openingAdvance && sim.selectTarget(a).kind === "unit", "Living enemy melee contact restores existing aggro.");
  });
  test("Units retain movement speed and use 15% larger collision footprints", () => {
    const sim = new Simulation();
    assert(sim.config.movementSpeed === 65 && sim.config.unitRadius === 3.5 * 1.1 * 1.15 * 1.15, "Speed unchanged and radius increased by another 15%.");
    assert(sim.config.doorwayWidth === 140 && sim.config.spawnInterval === 1.5 && sim.config.attackInterval === 1, "Gateways and timers unchanged.");
    const unit = placed(sim, 0, 400, 500);
    for (let i = 0; i < 30; i++) sim.move(unit, { x: 600, y: 500 }, sim.config.fixedStep);
    assert(close(unit.x, 465) && close(unit.y, 500), "Travels 65 world units in one second.");
    assert(sim.canOccupy({ x: unit.x + sim.config.unitRadius * 2, y: unit.y }), "Full physical diameter allows legal spacing.");
    assert(!sim.canOccupy({ x: unit.x + 8.855, y: unit.y }), "Previous spacing now overlaps.");
  });
  test("Exactly four identical faction slots and replaceable commander controllers", () => {
    const sim = new Simulation();
    assert(sim.commanders.length === 4 && sim.bases.length === 4, "Four slots required.");
    assert(sim.config.baseHP === 1000 && sim.bases.every((base) => base.hp === 1000), "All four bases start at the shared 1000 HP maximum.");
    assert(new LocalHumanController(0).kind === "HUMAN", "Human controller.");
    assert(new BotController(1).kind === "BOT", "Bot controller.");
    for (const commander of sim.commanders) {
      assert(commander.atk === 1 && commander.def === 1 && commander.production === 1 && commander.points === 0, "Identical starting stats.");
      assert(healthFor(commander, sim.config) === 15 && damageFor(commander, sim.config) === 5, "Identical unit formulas.");
    }
  });
  test("SOL is the default human; all other slots are bots and remain replaceable", () => {
    const sim = new Simulation(), controllers = createControllers();
    assert(DEFAULT_HUMAN_SLOT === 2 && sim.commanders[DEFAULT_HUMAN_SLOT].name === "SOL", "SOL default.");
    assert(controllers.map((controller) => controller.kind).join(",") === "BOT,BOT,HUMAN,BOT", "Default ownership.");
    const human = controllers[DEFAULT_HUMAN_SLOT];
    sim.commanders[human.slot].points = 1;
    human.request("atk");
    assert(human.update(sim)[0].ok && sim.commanders[2].atk === 2 && sim.commanders[0].atk === 1, "Human purchases apply only to SOL.");
    for (let slot = 0; slot < 4; slot++) {
      const assigned = createControllers(slot);
      assert(assigned[slot].kind === "HUMAN" && assigned[slot].slot === slot, "Any faction can use the human controller.");
      assert(assigned.filter((controller) => controller.kind === "BOT").length === 3, "Other slots remain bots.");
    }
  });
  test("Bot battle assigns every faction a purchasing bot, including SOL", () => {
    const sim = new Simulation(), controllers = createControllers(null);
    assert(controllers.length === 4 && controllers.every((controller) => controller.kind === "BOT"), "Four bots, no human controller.");
    for (const controller of controllers) {
      Object.assign(sim.commanders[controller.slot], { atk: 1, def: 2, points: 1 });
      controller.update(sim);
    }
    sim.time = sim.config.botReactionDelay;
    for (const controller of controllers) assert(controller.update(sim)[0].ok, "Each bot buys through the same rules.");
    assert(sim.commanders.every((commander) => commander.atk === 2 && commander.points === 0), "All factions pay for their upgrades.");
  });
  test("Movement speed presets preserve collision, attack and spawn timing", () => {
    for (const [multiplier, expected] of [[1, 65], [1.5, 97.5], [2, 130]]) {
      const sim = new Simulation({ movementSpeed: 65 * multiplier, spawnInterval: 1000 });
      const unit = placed(sim, 0, 400, 500);
      for (let i = 0; i < 30; i++) sim.move(unit, { x: 650, y: 500 }, sim.config.fixedStep);
      assert(close(unit.x, 400 + expected) && close(unit.y, 500), "Exact selected speed over one second.");
      assert(sim.config.attackInterval === 1 && sim.config.unitRadius === 3.5 * 1.1 * 1.15 * 1.15 && sim.config.doorwayWidth === 140, "Other balance unchanged.");
      const blocked = new Simulation({ movementSpeed: expected });
      const mover = placed(blocked, 0, 400, 500);
      placed(blocked, 1, 450, 500);
      blocked.move(mover, { x: 600, y: 500 }, 2);
      assert(close(mover.x, 400) && blocked.config.spawnInterval === 1.5, "No tunneling at faster speeds; spawning unchanged.");
    }
  });
  test("Four gates, shared walls, diamond geometry, no neighboring staging shortcuts", () => {
    const sim = new Simulation(), map = sim.geometry;
    assert(map.gates.length === 4 && map.walls.length === 12, "One split boundary/gate per territory plus shared spokes.");
    for (let slot = 0; slot < 4; slot++) {
      assert(map.territory(sim.bases[slot]) === slot, "Base belongs to corner staging area.");
      assert(map.lineClear(map.gates[slot].outside, map.gates[slot].inside, sim.config.unitRadius), "Gate must be traversable.");
    }
    assert(!map.lineClear({ x: 480, y: 100 }, { x: 520, y: 100 }), "Top shared wall blocks neighboring territory.");
    assert(map.inArena({ x: 500, y: 500 }) && !map.inArena({ x: 150, y: 150 }), "Diamond zone classification.");
    assert(GATEWAY_WIDTH_IN_UNITS === 10 && close(sim.config.doorwayWidth, 140), "Shared gateway clearance remains 140 world units after unit size reduction.");
  });
  test("All 12 enemy-base routes traverse only valid gate paths", () => {
    const sim = new Simulation();
    for (const a of sim.bases) {
      for (const b of sim.bases) {
        if (a === b) continue;
        const path = sim.geometry.route(a, b);
        assert(path.length > 0, "Enemy base must be reachable.");
        let start = a;
        const crossedGates = new Set();
        for (const point of path) {
          assert(sim.geometry.lineClear(start, point, sim.config.unitRadius), "Path segment crosses rock.");
          const steps = Math.ceil(distance(start, point) / 2);
          for (let i = 0; i <= steps; i++) {
            const sample = { x: start.x + (point.x - start.x) * i / steps, y: start.y + (point.y - start.y) * i / steps };
            sim.geometry.gates.forEach((gate, slot) => {
              if (distance(sample, gate) < sim.config.doorwayWidth / 2) crossedGates.add(slot);
            });
          }
          start = point;
        }
        assert(crossedGates.size === 2 && crossedGates.has(a.slot) && crossedGates.has(b.slot), "Only source and destination entrances crossed.");
      }
    }
  });
  test("All four gateways pass a full row of smaller units through the full opening, in both directions", () => {
    for (const doorwayWidth of [140, 154]) {
      const sim = new Simulation({ doorwayWidth });
      for (let slot = 0; slot < 4; slot++) {
        const gate = sim.geometry.gates[slot], base = sim.bases[slot];
        const length = distance(base, gate);
        const forward = { x: (gate.x - base.x) / length, y: (gate.y - base.y) / length };
        const lateralLimit = doorwayWidth / 2 - sim.config.unitRadius;
        for (let lateral = -lateralLimit; lateral <= lateralLimit; lateral += 0.5) {
          const outside = { x: gate.outside.x - forward.y * lateral, y: gate.outside.y + forward.x * lateral };
          const inside = { x: gate.inside.x - forward.y * lateral, y: gate.inside.y + forward.x * lateral };
          assert(sim.geometry.lineClear(outside, inside, sim.config.unitRadius), "No invisible boundary anywhere across the legal opening.");
        }
        for (const side of [-1, 1]) {
          const lateral = side * (doorwayWidth / 2 + sim.config.unitRadius);
          const outside = { x: gate.outside.x - forward.y * lateral, y: gate.outside.y + forward.x * lateral };
          const inside = { x: gate.inside.x - forward.y * lateral, y: gate.inside.y + forward.x * lateral };
          assert(!sim.geometry.lineClear(outside, inside, sim.config.unitRadius), "Rock walls immediately beyond the opening still block passage.");
        }
        for (const direction of [1, -1]) {
          sim.units = [];
          const starts = direction === 1 ? gate.outside : gate.inside;
          const end = direction === 1 ? gate.inside : gate.outside;
          const laneCount = Math.floor(doorwayWidth / (sim.config.unitRadius * 2));
          const lanes = Array.from({ length: laneCount }, (_, lane) => (lane - (laneCount - 1) / 2) * sim.config.unitRadius * 2).map((lateral) => ({
            unit: placed(sim, slot, starts.x - forward.y * lateral, starts.y + forward.x * lateral),
            goal: { x: end.x - forward.y * lateral, y: end.y + forward.x * lateral },
          }));
          for (let i = 0; i < 40; i++) {
            for (const { unit, goal } of lanes) sim.move(unit, goal, sim.config.fixedStep);
            assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "No crossing doorway rocks.");
            assert(sim.units.every((unit) => sim.units.every((other) => unit === other || distance(unit, other) >= sim.config.unitRadius * 2 - 0.01)), "Lanes do not overlap.");
          }
          assert(lanes.every(({ unit, goal }) => distance(unit, goal) < 0.01), "Full row physically traverses without teleporting.");
        }
      }
    }
  });
  test("Widening gateways changes only existing openings, not map locations or base-front spawns", () => {
    const narrow = new Simulation({ doorwayWidth: 46 }), wide = new Simulation();
    assert(JSON.stringify(wide.geometry.vertices) === JSON.stringify(narrow.geometry.vertices), "Diamond vertices unchanged.");
    assert(JSON.stringify(wide.geometry.gates) === JSON.stringify(narrow.geometry.gates), "All gateway locations and approach nodes unchanged.");
    assert(JSON.stringify(wide.bases) === JSON.stringify(narrow.bases), "Base positions and state unchanged.");
    assert(wide.geometry.walls.length === narrow.geometry.walls.length && wide.geometry.gates.length === 4, "No extra walls or doorways.");
    for (let i = 0; i < wide.geometry.walls.length; i++) {
      if (i < 8) {
        const fixedEnd = i % 2;
        assert(JSON.stringify(wide.geometry.walls[i][fixedEnd]) === JSON.stringify(narrow.geometry.walls[i][fixedEnd]), "Wall endpoint away from opening unchanged.");
      } else {
        assert(JSON.stringify(wide.geometry.walls[i]) === JSON.stringify(narrow.geometry.walls[i]), "Shared rock wall unchanged.");
      }
    }
    for (let slot = 0; slot < 4; slot++) {
      const before = narrow.spawn(slot), after = wide.spawn(slot);
      assert(close(before.x, after.x) && close(before.y, after.y), "Units still originate at the same base-front position.");
    }
  });
  test("Combat values follow eighth-level scaling while displayed levels remain integers", () => {
    const sim = new Simulation();
    for (const [level, effective] of [[1, 1], [2, 1.125], [3, 1.25], [4, 1.375], [5, 1.5], [10, 2.125], [15, 2.75], [20, 3.375], [101, 13.5]]) {
      const commander = sim.commanders[0];
      Object.assign(commander, { atk: level, def: level });
      assert(combatValueFor(level, sim.config) === effective, "Exact internal combat value.");
      assert(damageFor(commander, sim.config) === 4 + effective && healthFor(commander, sim.config) === 12 + effective * 3, "Only effective values enter damage and HP.");
      assert(commander.atk === level && commander.def === level && Number.isInteger(commander.atk), "Displayed levels are unchanged.");
      assert(sim.upgradeState(0, "atk").cost === level && sim.upgradeState(0, "def").cost === level, "Costs still use displayed levels.");
    }
    const tuned = new Simulation({ combatValuePerLevel: 0.5 });
    Object.assign(tuned.commanders[0], { atk: 3, def: 3 });
    assert(damageFor(tuned.commanders[0], tuned.config) === 6 && healthFor(tuned.commanders[0], tuned.config) === 18, "Shared scaling constant is configurable.");
  });
  test("+UNIT purchases are removed at every displayed level", () => {
    for (const combatValuePerLevel of [0.125, 0.5]) {
      const sim = new Simulation({ combatValuePerLevel }), commander = sim.commanders[2];
      for (const level of [1, 10, 100]) {
        Object.assign(commander, { atk: level, def: level, points: 20 });
        assert(!sim.purchase(2, "unit").ok && commander.production === 1 && commander.points === 20, "Removed upgrade never changes production or spends points.");
      }
    }
  });
  test("ATK and DEF require points, increase by one, and have no cap", () => {
    const sim = new Simulation();
    assert(!sim.purchase(0, "atk").ok && !sim.purchase(0, "unknown").ok, "Reject unaffordable/unknown upgrades.");
    sim.commanders[0].points = 2000;
    for (let i = 0; i < 30; i++) assert(sim.purchase(0, "atk").ok && sim.purchase(0, "def").ok, "Uncapped upgrades.");
    assert(sim.commanders[0].atk === 31 && sim.commanders[0].def === 31 && sim.commanders[0].points === 1070, "Current-level costs for levels 1 through 30.");
  });
  test("ATK and DEF cost the current level and reject insufficient funds without mutation", () => {
    const sim = new Simulation(), commander = sim.commanders[0];
    for (const type of ["atk", "def"]) {
      for (const current of [1, 2, 3, 8, 10, 25, 49, 100]) {
        commander[type] = current;
        commander.points = current - 1;
        const cost = current;
        assert(sim.upgradeState(0, type).cost === cost, "Current level determines price.");
        assert(!sim.purchase(0, type).ok && commander[type] === current && commander.points === current - 1, "Unaffordable purchase changes nothing.");
        commander.points = cost;
        assert(sim.purchase(0, type).ok && commander[type] === current + 1 && commander.points === 0, "Exact current-level cost buys one level.");
      }
    }
  });
  test("Economy configuration is shared and high stats do not automatically increase production", () => {
    const sim = new Simulation({ statUpgradeCost: () => 7 });
    Object.assign(sim.commanders[0], { atk: 100, def: 100, points: 8 });
    assert(sim.upgradeState(0, "atk").cost === 7 && sim.upgradeState(0, "def").cost === 7, "Shared tunable formula.");
    assert(sim.commanders[0].production === 1 && !sim.upgradeState(0, "unit").available, "High stats cannot increase production.");
  });
  test("Every faction rejects removed production upgrades without mutation", () => {
    const sim = new Simulation(), commander = sim.commanders[0];
    for (let slot = 0; slot < 4; slot++) {
      Object.assign(sim.commanders[slot], { atk: 100, def: 100, points: 100 });
      assert(!sim.purchase(slot, "unit").ok && sim.commanders[slot].production === 1 && sim.commanders[slot].points === 100, "One unit per spawn is permanent.");
    }
  });
  test("High stats and points preserve one unit per fixed spawn event", () => {
    const sim = new Simulation({ movementSpeed: 0 });
    Object.assign(sim.commanders[0], { atk: 10, def: 10, points: 20 });
    const due = sim.bases[0].nextSpawn;
    assert(!sim.purchase(0, "unit").ok, "Production purchase rejected.");
    assert(sim.bases[0].nextSpawn === due && sim.config.spawnInterval === 1.5, "Timer unchanged.");
    advance(sim, 3);
    assert(sim.units.filter((unit) => unit.slot === 0).length === 2, "One unit at each regular event.");
    assert(sim.units.filter((unit) => unit.slot === 1).length === 2, "Other factions still produce one.");
  });
  test("Default spawn frequency doubles without changing production, movement, or combat speed", () => {
    const sim = new Simulation({ movementSpeed: 0 });
    assert(sim.config.spawnInterval === 1.5 && sim.config.attackInterval === 1, "Half interval, unchanged attack speed.");
    assert(new Simulation().config.movementSpeed === 65, "Movement speed is 25% above the previous 52.");
    advance(sim, 1.5 - sim.config.fixedStep);
    assert(sim.units.length === 0, "No early spawn.");
    advance(sim, sim.config.fixedStep);
    assert(sim.units.length === 4, "One unit per faction at first event.");
    advance(sim, 1.5);
    assert(sim.units.length === 8, "Second event at doubled rate.");
  });
  test("All factions spawn base-first, strictly ahead of bases, without overlap", () => {
    const sim = new Simulation();
    for (let slot = 0; slot < 4; slot++) {
      const base = sim.bases[slot], gate = sim.geometry.gates[slot];
      let previous = 0;
      for (let i = 0; i < 120; i++) {
        const unit = sim.spawn(slot);
        assert(unit !== null, "Staging area supports significant accumulation.");
        const d = distance(unit, base);
        assert(d + 0.001 >= previous, "Closest free designated positions used first.");
        previous = d;
        if (i === 0) {
          const reach = sim.config.baseRadius + sim.config.unitRadius + 0.2;
          assert(close(d, reach), "First unit immediately outside base.");
          assert(close(unit.x, base.x + (gate.x - base.x) / distance(base, gate) * reach) &&
            close(unit.y, base.y + (gate.y - base.y) / distance(base, gate) * reach), "First unit directly in front.");
        }
        assert(distance(unit, gate) >= sim.config.doorwayWidth / 2 + sim.config.unitRadius, "Never spawn at gate.");
        const projection = ((unit.x - base.x) * (gate.x - base.x) + (unit.y - base.y) * (gate.y - base.y)) / distance(base, gate);
        assert(projection >= sim.config.unitRadius, "Whole unit is ahead of base, never behind it.");
        assert(sim.geometry.territory(unit) === slot && sim.geometry.walkable(unit), "Own staging terrain only.");
        assert(!sim.geometry.inArena(unit) && distance(unit, base) >= sim.config.baseRadius + sim.config.unitRadius, "Outside arena and base.");
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          const edge = { x: unit.x + Math.cos(angle) * sim.config.unitRadius, y: unit.y + Math.sin(angle) * sim.config.unitRadius };
          assert(sim.geometry.territory(edge) === slot, "Whole spawn footprint remains in own staging territory.");
        }
        assert(sim.units.every((other) => other === unit || distance(unit, other) >= sim.config.unitRadius * 2), "No spawn overlap.");
      }
    }
  });
  test("Configurable spawn interval preserves single-unit events and front-first placement", () => {
    const sim = new Simulation({ spawnInterval: 0.5, movementSpeed: 0 });
    advance(sim, 0.5);
    const units = sim.units.filter((unit) => unit.slot === 0);
    assert(units.length === 1 && sim.bases[0].nextSpawn === 1, "One unit per configurable regular event.");
    const base = sim.bases[0];
    assert(units.every((unit) => distance(unit, base) <= sim.config.baseRadius + sim.config.unitRadius + 0.201), "Entire wave stays in immediate base-front zone.");
    assert(units.every((unit, i) => i === 0 || distance(unit, base) >= distance(units[i - 1], base) - 0.001), "Batch uses next closest base positions.");
  });
  test("Occupied base front searches nearby sides, never the available gate", () => {
    const sim = new Simulation();
    for (let slot = 0; slot < 4; slot++) {
      const front = sim.spawn(slot), next = sim.spawn(slot), base = sim.bases[slot];
      assert(front && next && distance(front, next) >= sim.config.unitRadius * 2, "Occupied front does not overlap.");
      assert(close(distance(next, base), distance(front, base)), "Nearby side preferred over farther forward space.");
      assert(distance(next, sim.geometry.gates[slot]) > 200, "Free doorway cannot attract spawn.");
      sim.units = sim.units.filter((unit) => unit !== front);
      const reopened = sim.spawn(slot);
      assert(close(reopened.x, front.x) && close(reopened.y, front.y), "Reopened base front takes priority again.");
    }
  });
  test("Full spawn area waits safely and resumes at the closest reopened position", () => {
    const sim = new Simulation();
    for (let slot = 0; slot < 4; slot++) {
      sim.units = sim.spawnPositions[slot].map((point, index) => ({ ...point, id: index + 1, slot, hp: 15 }));
      const count = sim.units.length, nextId = sim.nextId;
      assert(sim.spawn(slot) === null && sim.units.length === count && sim.nextId === nextId, "No invalid fallback when full.");
      const reopened = sim.units.shift();
      const unit = sim.spawn(slot);
      assert(unit && close(unit.x, reopened.x) && close(unit.y, reopened.y), "Reuses closest free position.");
    }
  });
  test("Every congestion fallback position has a legal staging footprint and avoids the gate", () => {
    const sim = new Simulation();
    for (let slot = 0; slot < 4; slot++) {
      const base = sim.bases[slot], gate = sim.geometry.gates[slot];
      let previous = 0;
      for (const point of sim.spawnPositions[slot]) {
        const reach = distance(point, base);
        assert(reach + 0.001 >= previous, "All fallback positions remain base-distance ordered.");
        previous = reach;
        assert(sim.canOccupy(point) && distance(point, gate) >= sim.config.doorwayWidth / 2 + sim.config.unitRadius, "Clear of walls, bases, and gate.");
        const ahead = ((point.x - base.x) * (gate.x - base.x) + (point.y - base.y) * (gate.y - base.y)) / distance(base, gate);
        assert(ahead >= sim.config.unitRadius - 0.001, "No fallback behind base.");
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          assert(sim.geometry.territory({
            x: point.x + Math.cos(angle) * sim.config.unitRadius,
            y: point.y + Math.sin(angle) * sim.config.unitRadius,
          }) === slot, "Entire fallback footprint stays in own staging territory.");
        }
      }
    }
  });
  test("Blocked armies continue accumulating physically in their own staging area", () => {
    const sim = new Simulation({ movementSpeed: 0, spawnInterval: 0.2 });
    advance(sim, 10);
    assert(sim.units.filter((unit) => unit.slot === 0).length === 50, "Spawning continues while units cannot exit.");
    for (const unit of sim.units) {
      assert(sim.geometry.territory(unit) === unit.slot && sim.geometry.walkable(unit), "Staged unit stays on its own terrain.");
    }
    for (let i = 0; i < sim.units.length; i++) {
      for (let j = i + 1; j < sim.units.length; j++) {
        assert(distance(sim.units[i], sim.units[j]) >= sim.config.unitRadius * 2 - 0.2, "Staged units cannot stack.");
      }
    }
  });
  test("Friendly queues flow around a stationary fighter in open terrain without overlap", () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const sim = new Simulation({ spawnInterval: 1000 });
      const diameter = sim.config.unitRadius * 2, spacing = diameter + 0.2;
      const origin = { x: 500, y: 500 };
      const point = (ahead) => ({ x: origin.x + Math.cos(angle) * ahead, y: origin.y + Math.sin(angle) * ahead });
      const blockerPoint = point(spacing);
      const blocker = placed(sim, 0, blockerPoint.x, blockerPoint.y);
      const followers = [0, -spacing, -spacing * 2].map((ahead) => {
        const start = point(ahead);
        return placed(sim, 0, start.x, start.y);
      });
      let spread = 0;
      for (let step = 0; step < 180; step++) {
        for (const unit of followers) sim.move(unit, point(120), sim.config.fixedStep);
        for (const unit of followers) {
          spread = Math.max(spread, Math.abs((unit.y - origin.y) * Math.cos(angle) - (unit.x - origin.x) * Math.sin(angle)));
          assert(distance(unit, blocker) >= diameter - 0.01, "No passing through stationary fighter.");
          assert(sim.geometry.walkable(unit), "Avoidance stays off walls.");
        }
        assert(followers.every((unit) => followers.every((other) => other === unit || distance(unit, other) >= diameter - 0.01)), "Followers never overlap.");
      }
      assert(spread >= diameter && followers.every((unit) =>
        (unit.x - origin.x) * Math.cos(angle) + (unit.y - origin.y) * Math.sin(angle) > 40), "All queued units spread and pass the obstruction.");
      assert(close(blocker.x, blockerPoint.x) && close(blocker.y, blockerPoint.y), "Fighter was not pushed aside.");
    }
  });
  test("Friendly avoidance tries the other side when the preferred side is occupied", () => {
    const sim = new Simulation();
    const spacing = sim.config.unitRadius * 2 + 0.2;
    const unit = placed(sim, 0, 400, 500);
    placed(sim, 0, 400 + spacing, 500);
    placed(sim, 0, 400, 500 + spacing);
    let minimumY = unit.y;
    for (let i = 0; i < 60; i++) {
      sim.move(unit, { x: 520, y: 500 }, sim.config.fixedStep);
      minimumY = Math.min(minimumY, unit.y);
    }
    assert(unit.x > 435 && minimumY < 500 - sim.config.unitRadius, "Flows through available opposite side before returning toward goal.");
    assert(sim.units.every((other) => other === unit || distance(unit, other) >= sim.config.unitRadius * 2 - 0.01), "No overlap.");
  });
  test("Swept movement cannot tunnel through enemies, friends, bases, or rock walls", () => {
    const sim = new Simulation();
    const unit = placed(sim, 0, 400, 500);
    const enemy = placed(sim, 1, 450, 500);
    sim.move(unit, { x: 600, y: 500 }, 2);
    assert(close(unit.x, 400) && close(unit.y, 500), "Enemy blocks movement; no friendly sidestep behavior.");
    assert(sim.selectTarget(unit).entity === enemy, "Existing enemy aggro still engages.");
    sim.units = [unit];
    Object.assign(unit, { x: 480, y: 100 });
    sim.move(unit, { x: 520, y: 100 }, 2);
    assert(unit.x < 500 && sim.geometry.walkable(unit), "Cannot cross shared rock wall.");
    Object.assign(unit, { x: 210, y: 112 });
    sim.move(unit, { x: 30, y: 112 }, 4);
    assert(unit.x === 210, "Cannot tunnel through own base.");
  });
  test("A full-width defender line still blocks every gateway; removing it allows breakout", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    for (let slot = 0; slot < 4; slot++) {
      sim.units = [];
      const gate = sim.geometry.gates[slot], base = sim.bases[slot];
      const length = distance(base, gate);
      const forward = { x: (gate.x - base.x) / length, y: (gate.y - base.y) / length };
      const unit = placed(sim, slot, gate.outside.x, gate.outside.y);
      const laneCount = Math.floor(sim.config.doorwayWidth / (sim.config.unitRadius * 2));
      for (const lateral of Array.from({ length: laneCount }, (_, lane) => (lane - (laneCount - 1) / 2) * sim.config.unitRadius * 2)) {
        const defender = placed(sim, slot, gate.x - forward.y * lateral, gate.y + forward.x * lateral);
        assert(sim.geometry.walkable(defender), "Defender fits in unchanged gateway.");
      }
      for (let i = 0; i < 180; i++) {
        const route = sim.geometry.route(unit, gate.inside);
        if (route[0]) sim.move(unit, route[0], sim.config.fixedStep);
        assert(sim.geometry.territory(unit) === slot && sim.geometry.walkable(unit), "Closed doorway retains staging congestion.");
        assert(sim.units.every((other) => other === unit || distance(unit, other) >= sim.config.unitRadius * 2 - 0.01), "No squeezing through defenders.");
      }
      sim.units = [unit];
      for (let i = 0; i < 180; i++) {
        const route = sim.geometry.route(unit, gate.inside);
        if (route[0]) sim.move(unit, route[0], sim.config.fixedStep);
      }
      assert(sim.geometry.inArena(unit), "Open doorway permits breakout on existing geometry.");
    }
  });
  test("Local aggro interrupts base seeking outside the arena", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const a = placed(sim, 0, 170, 170), b = placed(sim, 1, 200, 175);
    assert(sim.selectTarget(a).entity === b, "Nearby enemy receives priority.");
  });
  test("Central arena aggro selects distant arena enemies, not long-range attacks", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const a = placed(sim, 0, 400, 500), b = placed(sim, 1, 600, 500);
    const target = sim.selectTarget(a);
    assert(target.entity === b && distance(a, b) > sim.config.localAggroRadius, "Arena aggro exceeds local radius.");
    assert(!sim.attack(a, target) && b.hp === 15, "No attacking across arena.");
    advance(sim, 1);
    assert(distance(a, b) < 200, "Units move toward arena combat.");
  });
  test("Enemies cannot detect or attack through shared rock walls", () => {
    const sim = new Simulation({ spawnInterval: 1000, attackRange: 60 });
    const a = placed(sim, 0, 480, 100), b = placed(sim, 1, 520, 100);
    assert(sim.selectTarget(a).kind === "base", "Wall prevents local aggro.");
    assert(!sim.attack(a, { kind: "unit", entity: b }) && b.hp === 15, "Wall prevents combat.");
  });
  test("Enemy kill gives exactly one point to the killer commander", () => {
    const sim = new Simulation();
    const a = placed(sim, 0, 495, 500), b = placed(sim, 1, 505, 500);
    b.hp = 5;
    assert(sim.attack(a, { kind: "unit", entity: b }), "Melee attack executes.");
    assert(b.hp === 0 && sim.commanders[0].points === 1 && sim.commanders[0].kills === 1, "Kill credited.");
    a.cooldown = 0;
    assert(!sim.attack(a, { kind: "unit", entity: b }) && sim.commanders[0].points === 1, "No duplicate credit.");
  });
  test("Attack interval is one second regardless of ATK upgrades", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const a = placed(sim, 0, 495, 500), b = placed(sim, 1, 505, 500);
    b.hp = 500;
    assert(sim.attack(a, { kind: "unit", entity: b }) && a.cooldown === 1, "One-second cooldown.");
    sim.commanders[0].points = 2;
    assert(sim.purchase(0, "atk").ok, "Progressive ATK purchase succeeds.");
    assert(!sim.attack(a, { kind: "unit", entity: b }), "ATK cannot reset speed.");
    assert(sim.config.attackInterval === 1 && damageFor(sim.commanders[0], sim.config) === 5.125, "Only scaled damage changes.");
  });
  test("DEF raises survivability of existing and newly spawned units equally", () => {
    const sim = new Simulation(), unit = sim.spawn(0);
    sim.commanders[0].points = 2;
    assert(sim.purchase(0, "def").ok && unit.hp === 15.375, "Existing units gain only 0.375 HP.");
    assert(sim.spawn(0).hp === 15.375, "New unit uses effective DEF.");
  });
  test("Scaled DEF gains preserve damage taken and scaled ATK damages both units and bases", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const attacker = placed(sim, 0, 495, 500), enemy = placed(sim, 1, 505, 500);
    attacker.hp -= 4;
    sim.commanders[0].points = 10;
    for (let level = 1; level < 5; level++) assert(sim.purchase(0, "def").ok, "DEF purchase.");
    assert(attacker.hp === 12.5 && healthFor(sim.commanders[0], sim.config) === 16.5, "Existing unit retains four HP of damage after four scaled upgrades.");
    assert(sim.spawn(0).hp === 16.5 && enemy.hp === 15, "New ally uses scaled maximum; enemy unaffected.");
    sim.commanders[0].atk = 2;
    assert(sim.attack(attacker, { kind: "unit", entity: enemy }) && enemy.hp === 9.875, "Fractional ATK damage applied to units.");
    const base = sim.bases[1];
    Object.assign(attacker, { x: base.x - sim.config.baseRadius - sim.config.unitRadius - 2, y: base.y, cooldown: 0 });
    assert(sim.attack(attacker, { kind: "base", entity: base }) && base.hp === 994.875, "Same fractional damage applied to bases.");
  });
  test("Three baseline units can defeat one level-five unit in local melee", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    Object.assign(sim.commanders[0], { atk: 5, def: 5 });
    const upgraded = placed(sim, 0, 500, 500);
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      placed(sim, 1, 500 + Math.cos(angle) * 20, 500 + Math.sin(angle) * 20);
    }
    advance(sim, 3);
    assert(upgraded.hp === 0 && !sim.units.includes(upgraded), "Small displayed-level advantage cannot overwhelm three baseline units.");
    assert(sim.units.filter((unit) => unit.slot === 1).length >= 2, "Numerical superiority remains meaningful.");
  });
  test("Base damage gives no points, stops regeneration, and never exceeds maximum HP", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const base = sim.bases[1], unit = placed(sim, 0, base.x - sim.config.baseRadius - sim.config.unitRadius - 2, base.y);
    assert(sim.attack(unit, { kind: "base", entity: base }) && base.hp === 995, "Base receives damage.");
    assert(sim.commanders[0].points === 0, "No points for base damage.");
    sim.units = [];
    advance(sim, 2);
    assert(base.hp === 995, "No regeneration during delay.");
    advance(sim, 2);
    assert(base.hp > 995 && base.hp < 1000, "Slow regeneration resumes.");
    advance(sim, 10);
    assert(base.hp === 1000, "Regeneration capped.");
  });
  test("Destroyed base stops spawning; surviving units remain and commander cannot upgrade", () => {
    const sim = new Simulation({ movementSpeed: 0 });
    sim.spawn(1);
    sim.bases[1].alive = false;
    sim.bases[1].hp = 0;
    advance(sim, 6);
    assert(sim.units.filter((unit) => unit.slot === 1).length === 1, "No new units, survivor remains.");
    sim.commanders[1].points = 10;
    assert(!sim.purchase(1, "atk").ok, "Eliminated commander cannot purchase.");
  });
  test("Units recalculate nearest living base from CURRENT position after engagement", () => {
    const sim = new Simulation();
    const a = placed(sim, 0, 150, 800), b = placed(sim, 1, 175, 800);
    assert(sim.selectTarget(a).entity === b, "Local combat selected.");
    b.hp = 0;
    a.x = 820;
    a.y = 800;
    assert(sim.selectTarget(a).entity === sim.bases[3], "Current position redirects to BNB.");
    sim.bases[3].alive = false;
    assert(sim.selectTarget(a).entity !== sim.bases[3], "Destroyed bases ignored.");
  });
  test("Autonomous unit passes both doorway bottlenecks and damages an enemy base", () => {
    const sim = new Simulation({ spawnInterval: 1000, arenaAggro: false });
    sim.openingAdvance = false;
    sim.spawn(0);
    advance(sim, 45);
    assert(sim.bases.some((base) => base.slot !== 0 && base.hp < sim.config.baseHP), "Unit must reach and attack enemy base.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Unit never leaves valid geometry.");
  });
  test("Bots use the same purchase rules and earn no free stats or points", () => {
    const sim = new Simulation(), bot = new BotController(1);
    bot.update(sim);
    assert(sim.commanders[1].atk === 1 && sim.commanders[1].def === 1, "No free upgrades.");
    Object.assign(sim.commanders[1], { atk: 10, def: 10, points: 19 });
    sim.time = 2;
    bot.update(sim);
    assert(sim.commanders[1].production === 1 && sim.commanders[1].points === 19, "Stat purchase waits for reaction.");
    sim.time = 2.875;
    bot.update(sim);
    assert(sim.commanders[1].production === 1 && sim.commanders[1].points === 9 &&
      sim.commanders[1].atk + sim.commanders[1].def === 21, "Bot buys a stat for the normal cost instead of saving for production.");
  });
  test("Bots wait the default Medium delay after selecting each affordable upgrade without queueing duplicates", () => {
    const sim = new Simulation(), bot = new BotController(1), commander = sim.commanders[1];
    assert(sim.config.botReactionDelay === 0.875 && sim.config.botInterval === 1.2, "Medium reaction, unchanged decision interval.");
    Object.assign(commander, { atk: 1, def: 2, points: 10 });
    sim.time = 5;
    assert(bot.update(sim).length === 0 && commander.atk === 1, "Selecting upgrade does not spend immediately.");
    for (const time of [5, 5.5, 5.874]) {
      sim.time = time;
      assert(bot.update(sim).length === 0 && commander.points === 10 && commander.atk === 1, "No early spending or duplicate actions.");
    }
    sim.time = 5.875;
    assert(bot.update(sim)[0].ok && commander.atk === 2 && commander.points === 9, "Exact Medium boundary executes once.");
    assert(bot.update(sim).length === 0 && commander.points === 9, "No duplicate purchase at same timestamp.");
    sim.time = 6.2;
    bot.update(sim);
    sim.time = 7.074;
    assert(bot.update(sim).length === 0 && commander.points === 9, "Every new purchase needs its own reaction delay.");
    sim.time = 6.2 + sim.config.botReactionDelay;
    assert(bot.update(sim)[0].ok && commander.points === 7, "Next stat purchase uses unchanged current-level price.");
  });
  test("Pending bot actions cancel when unaffordable, eliminated, or finished and respect configurable delay", () => {
    for (const invalidation of ["points", "eliminated", "finished"]) {
      const sim = new Simulation(), bot = new BotController(1), commander = sim.commanders[1];
      Object.assign(commander, { atk: 1, def: 2, points: 1 });
      bot.update(sim);
      if (invalidation === "points") commander.points = 0;
      if (invalidation === "eliminated") sim.bases[1].alive = false;
      if (invalidation === "finished") sim.finished = true;
      sim.time = 1;
      assert(bot.update(sim).length === 0 && commander.atk === 1 && bot.pending === null, "Invalid action canceled without purchase.");
      if (invalidation === "points") {
        commander.points = 1;
        sim.time = 1.2;
        bot.update(sim);
        sim.time = 2.074;
        assert(bot.update(sim).length === 0, "Restored affordability starts a fresh delay.");
        sim.time = 1.2 + sim.config.botReactionDelay;
        assert(bot.update(sim)[0].ok, "Purchase after fresh delay.");
      }
    }
    for (const delay of [1, 0.875, 0.75, 0.5, 2]) {
      const sim = new Simulation({ botReactionDelay: delay }), bot = new BotController(1);
      Object.assign(sim.commanders[1], { atk: 1, def: 2, points: 1 });
      bot.update(sim);
      sim.time = delay - 0.001;
      assert(bot.update(sim).length === 0, "Configured difficulty delay respected.");
      sim.time = delay;
      assert(bot.update(sim)[0].ok, "Configured difficulty deadline executes.");
    }
  });
  test("Last base standing wins, freezes match, and preserves four permanent slots", () => {
    const sim = new Simulation();
    for (let slot = 1; slot < 4; slot++) Object.assign(sim.bases[slot], { alive: false, hp: 0 });
    sim.step(sim.config.fixedStep);
    assert(sim.finished && sim.winner === 0 && sim.commanders.length === 4, "Winner selected.");
    const time = sim.time;
    sim.step(10);
    assert(sim.time === time && !sim.purchase(0, "atk").ok, "Finished match frozen.");
  });
  test("Seeded default match sustains combat and crosses gateways with fixed production", () => {
    const sim = new Simulation({}, 42);
    const controllers = createControllers();
    let earlierKills = 0;
    for (let i = 0; i < 3600 && !sim.finished; i++) {
      for (const controller of controllers) controller.update(sim);
      sim.step(sim.config.fixedStep);
      if (i === 2699) earlierKills = sim.commanders.reduce((sum, commander) => sum + commander.kills, 0);
    }
    assert(sim.commanders.every((commander) => commander.production === 1), "All factions retain one unit per spawn.");
    const kills = sim.commanders.reduce((sum, commander) => sum + commander.kills, 0);
    assert(kills > 100 && kills > earlierKills, "Actual combat continues during the final 30 seconds; no movement deadlock.");
    assert(sim.units.some((unit) => sim.geometry.inArena(unit)), "Armies cross gateways and fight in the arena.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Survivors stay outside impassable terrain.");
  });
  test("Scaled attacker traverses both gateways and wins a two-base combat fixture", () => {
    const sim = new Simulation({ spawnInterval: 1000 }, 1);
    sim.openingAdvance = false;
    for (const slot of [2, 3]) Object.assign(sim.bases[slot], { alive: false, hp: 0 });
    sim.commanders[0].atk = 2;
    sim.spawn(0);
    advance(sim, 300);
    assert(sim.finished && sim.winner === 0 && sim.bases[1].hp === 0, "Autonomous scaled attacks destroy the enemy base and end the match.");
    assert(sim.bases.filter((base) => base.alive).length === 1, "Exactly one base remains.");
    assert(sim.commanders[0].points === 0, "Base destruction still awards no unit-kill points.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Survivors stay on legal terrain.");
  });

  const passed = results.filter((result) => result.ok).length;
  document.getElementById("summary").textContent = `${passed}/${results.length} tests passed.`;
  window.arenaTestResults = { passed, total: results.length, results };
})();
