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
    const unit = simulation.spawn(slot);
    assert(unit !== null, "Expected a spawn position.");
    Object.assign(unit, { x, y });
    return unit;
  }

  test("Exactly four identical faction slots and replaceable commander controllers", () => {
    const sim = new Simulation();
    assert(sim.commanders.length === 4 && sim.bases.length === 4, "Four slots required.");
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
  test("Four gates, shared walls, diamond geometry, no neighboring staging shortcuts", () => {
    const sim = new Simulation(), map = sim.geometry;
    assert(map.gates.length === 4 && map.walls.length === 12, "One split boundary/gate per territory plus shared spokes.");
    for (let slot = 0; slot < 4; slot++) {
      assert(map.territory(sim.bases[slot]) === slot, "Base belongs to corner staging area.");
      assert(map.lineClear(map.gates[slot].outside, map.gates[slot].inside, sim.config.unitRadius), "Gate must be traversable.");
    }
    assert(!map.lineClear({ x: 480, y: 100 }, { x: 520, y: 100 }), "Top shared wall blocks neighboring territory.");
    assert(map.inArena({ x: 500, y: 500 }) && !map.inArena({ x: 150, y: 150 }), "Diamond zone classification.");
    assert(GATEWAY_WIDTH_IN_UNITS === 10 && close(sim.config.doorwayWidth / (sim.config.unitRadius * 2), 10), "Shared gateway clearance is ten unit diameters.");
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
  test("All four gateways pass ten units abreast through the full opening, in both directions", () => {
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
          const lanes = Array.from({ length: 10 }, (_, lane) => (lane - 4.5) * sim.config.unitRadius * 2).map((lateral) => ({
            unit: placed(sim, slot, starts.x - forward.y * lateral, starts.y + forward.x * lateral),
            goal: { x: end.x - forward.y * lateral, y: end.y + forward.x * lateral },
          }));
          for (let i = 0; i < 40; i++) {
            for (const { unit, goal } of lanes) sim.move(unit, goal, sim.config.fixedStep);
            assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "No crossing doorway rocks.");
            assert(sim.units.every((unit) => sim.units.every((other) => unit === other || distance(unit, other) >= 14 - 0.01)), "Ten lanes do not overlap.");
          }
          assert(lanes.every(({ unit, goal }) => distance(unit, goal) < 0.01), "Ten units physically traverse without teleporting.");
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
  test("Combat values follow quarter-level scaling while displayed levels remain integers", () => {
    const sim = new Simulation();
    for (const [level, effective] of [[1, 1], [2, 1.25], [3, 1.5], [4, 1.75], [5, 2], [10, 3.25], [15, 4.5], [20, 5.75], [101, 26]]) {
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
  test("+UNIT milestones use displayed levels, never internal combat values", () => {
    for (const combatValuePerLevel of [0.25, 0.5]) {
      const sim = new Simulation({ combatValuePerLevel }), commander = sim.commanders[2];
      for (const [index, level] of [5, 10, 15, 25].entries()) {
        Object.assign(commander, { atk: level, def: level, points: [10, 20, 30, 50][index] });
        assert(combatValueFor(level, sim.config) < level, "Internal value is below the displayed milestone.");
        assert(sim.purchase(2, "unit").ok && commander.production === index + 2 && commander.points === 0, "Displayed milestone buys the unchanged production tier.");
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
    const sim = new Simulation({ statUpgradeCost: () => 7, unitCosts: [8, 16, 24, 32] });
    Object.assign(sim.commanders[0], { atk: 100, def: 100, points: 8 });
    assert(sim.upgradeState(0, "atk").cost === 7 && sim.upgradeState(0, "def").cost === 7, "Shared tunable formula.");
    assert(sim.commanders[0].production === 1 && sim.upgradeState(0, "unit").cost === 8, "High stats still require first tier purchase.");
    assert(sim.purchase(0, "unit").ok && sim.commanders[0].production === 2, "Purchase increases production by exactly one.");
  });
  test("All four +UNIT milestones, costs, both-stat gating, and permanent cap", () => {
    const sim = new Simulation(), commander = sim.commanders[0];
    for (let level = 0; level < 4; level++) {
      const requirement = [5, 10, 15, 25][level], cost = [10, 20, 30, 50][level];
      Object.assign(commander, { atk: requirement, def: requirement - 1, points: cost });
      assert(!sim.upgradeState(0, "unit").available, "Both stats required.");
      commander.def = requirement;
      commander.atk = requirement - 1;
      assert(!sim.purchase(0, "unit").ok, "ATK threshold also required.");
      commander.atk = requirement;
      commander.points = cost - 1;
      assert(!sim.upgradeState(0, "unit").available, "Full point cost required.");
      commander.points = cost;
      assert(sim.upgradeState(0, "unit").available && sim.purchase(0, "unit").ok, "Milestone purchase.");
      assert(commander.production === level + 2 && commander.points === 0, "Production and point debit.");
      assert(!sim.upgradeState(0, "unit").available, "Button locks again.");
    }
    Object.assign(commander, { atk: 100, def: 100, points: 100 });
    assert(!sim.purchase(0, "unit").ok && commander.production === 5, "Five is permanent maximum.");
  });
  test("Production upgrades change batch size, never the fixed timer", () => {
    const sim = new Simulation({ movementSpeed: 0 });
    Object.assign(sim.commanders[0], { atk: 5, def: 5, points: 10 });
    const due = sim.bases[0].nextSpawn;
    assert(sim.purchase(0, "unit").ok, "Production purchase succeeds.");
    assert(sim.bases[0].nextSpawn === due && sim.config.spawnInterval === 1.5, "Timer unchanged by production upgrade.");
    advance(sim, 3);
    assert(sim.units.filter((unit) => unit.slot === 0).length === 4, "Two units at each regular event.");
    assert(sim.units.filter((unit) => unit.slot === 1).length === 2, "Other factions still produce one.");
  });
  test("Default spawn frequency doubles without changing production, movement, or combat speed", () => {
    const sim = new Simulation({ movementSpeed: 0 });
    assert(sim.config.spawnInterval === 1.5 && sim.config.attackInterval === 1, "Half interval, unchanged attack speed.");
    assert(new Simulation().config.movementSpeed === 52, "Movement speed unchanged.");
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
  test("Configurable spawn interval preserves five-unit batches and front-first placement", () => {
    const sim = new Simulation({ spawnInterval: 0.5, movementSpeed: 0 });
    sim.commanders[0].production = 5;
    advance(sim, 0.5);
    const units = sim.units.filter((unit) => unit.slot === 0);
    assert(units.length === 5 && sim.bases[0].nextSpawn === 1, "Five units per configurable regular event.");
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
      const origin = { x: 500, y: 500 };
      const point = (ahead) => ({ x: origin.x + Math.cos(angle) * ahead, y: origin.y + Math.sin(angle) * ahead });
      const blockerPoint = point(14.2);
      const blocker = placed(sim, 0, blockerPoint.x, blockerPoint.y);
      const followers = [0, -14.2, -28.4].map((ahead) => {
        const start = point(ahead);
        return placed(sim, 0, start.x, start.y);
      });
      let spread = 0;
      for (let step = 0; step < 180; step++) {
        for (const unit of followers) sim.move(unit, point(120), sim.config.fixedStep);
        for (const unit of followers) {
          spread = Math.max(spread, Math.abs((unit.y - origin.y) * Math.cos(angle) - (unit.x - origin.x) * Math.sin(angle)));
          assert(distance(unit, blocker) >= 14 - 0.01, "No passing through stationary fighter.");
          assert(sim.geometry.walkable(unit), "Avoidance stays off walls.");
        }
        assert(followers.every((unit) => followers.every((other) => other === unit || distance(unit, other) >= 14 - 0.01)), "Followers never overlap.");
      }
      assert(spread >= 14 && followers.every((unit) =>
        (unit.x - origin.x) * Math.cos(angle) + (unit.y - origin.y) * Math.sin(angle) > 40), "All queued units spread and pass the obstruction.");
      assert(close(blocker.x, blockerPoint.x) && close(blocker.y, blockerPoint.y), "Fighter was not pushed aside.");
    }
  });
  test("Friendly avoidance tries the other side when the preferred side is occupied", () => {
    const sim = new Simulation();
    const unit = placed(sim, 0, 400, 500);
    placed(sim, 0, 414.2, 500);
    placed(sim, 0, 400, 514.2);
    for (let i = 0; i < 60; i++) sim.move(unit, { x: 520, y: 500 }, sim.config.fixedStep);
    assert(unit.x > 435 && unit.y < 500, "Flows through available opposite side.");
    assert(sim.units.every((other) => other === unit || distance(unit, other) >= 14 - 0.01), "No overlap.");
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
      for (const lateral of Array.from({ length: 10 }, (_, lane) => (lane - 4.5) * sim.config.unitRadius * 2)) {
        const defender = placed(sim, slot, gate.x - forward.y * lateral, gate.y + forward.x * lateral);
        assert(sim.geometry.walkable(defender), "Defender fits in ten-unit gate.");
      }
      for (let i = 0; i < 180; i++) {
        const route = sim.geometry.route(unit, gate.inside);
        if (route[0]) sim.move(unit, route[0], sim.config.fixedStep);
        assert(sim.geometry.territory(unit) === slot && sim.geometry.walkable(unit), "Closed doorway retains staging congestion.");
        assert(sim.units.every((other) => other === unit || distance(unit, other) >= 14 - 0.01), "No squeezing through defenders.");
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
    const a = placed(sim, 0, 490, 500), b = placed(sim, 1, 510, 500);
    b.hp = 5;
    assert(sim.attack(a, { kind: "unit", entity: b }), "Melee attack executes.");
    assert(b.hp === 0 && sim.commanders[0].points === 1 && sim.commanders[0].kills === 1, "Kill credited.");
    a.cooldown = 0;
    assert(!sim.attack(a, { kind: "unit", entity: b }) && sim.commanders[0].points === 1, "No duplicate credit.");
  });
  test("Attack interval is one second regardless of ATK upgrades", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const a = placed(sim, 0, 490, 500), b = placed(sim, 1, 510, 500);
    b.hp = 500;
    assert(sim.attack(a, { kind: "unit", entity: b }) && a.cooldown === 1, "One-second cooldown.");
    sim.commanders[0].points = 2;
    assert(sim.purchase(0, "atk").ok, "Progressive ATK purchase succeeds.");
    assert(!sim.attack(a, { kind: "unit", entity: b }), "ATK cannot reset speed.");
    assert(sim.config.attackInterval === 1 && damageFor(sim.commanders[0], sim.config) === 5.25, "Only scaled damage changes.");
  });
  test("DEF raises survivability of existing and newly spawned units equally", () => {
    const sim = new Simulation(), unit = sim.spawn(0);
    sim.commanders[0].points = 2;
    assert(sim.purchase(0, "def").ok && unit.hp === 15.75, "Existing units gain only 0.75 HP.");
    assert(sim.spawn(0).hp === 15.75, "New unit uses effective DEF.");
  });
  test("Scaled DEF gains preserve damage taken and scaled ATK damages both units and bases", () => {
    const sim = new Simulation({ spawnInterval: 1000 });
    const attacker = placed(sim, 0, 490, 500), enemy = placed(sim, 1, 510, 500);
    attacker.hp -= 4;
    sim.commanders[0].points = 10;
    for (let level = 1; level < 5; level++) assert(sim.purchase(0, "def").ok, "DEF purchase.");
    assert(attacker.hp === 14 && healthFor(sim.commanders[0], sim.config) === 18, "Existing unit retains four HP of damage after four scaled upgrades.");
    assert(sim.spawn(0).hp === 18 && enemy.hp === 15, "New ally uses scaled maximum; enemy unaffected.");
    sim.commanders[0].atk = 2;
    assert(sim.attack(attacker, { kind: "unit", entity: enemy }) && enemy.hp === 9.75, "Fractional ATK damage applied to units.");
    const base = sim.bases[1];
    Object.assign(attacker, { x: base.x - sim.config.baseRadius - sim.config.unitRadius - 2, y: base.y, cooldown: 0 });
    assert(sim.attack(attacker, { kind: "base", entity: base }) && base.hp === 494.75, "Same fractional damage applied to bases.");
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
    assert(sim.attack(unit, { kind: "base", entity: base }) && base.hp === 495, "Base receives damage.");
    assert(sim.commanders[0].points === 0, "No points for base damage.");
    sim.units = [];
    advance(sim, 2);
    assert(base.hp === 495, "No regeneration during delay.");
    advance(sim, 2);
    assert(base.hp > 495 && base.hp < 500, "Slow regeneration resumes.");
    advance(sim, 10);
    assert(base.hp === 500, "Regeneration capped.");
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
    sim.spawn(0);
    advance(sim, 45);
    assert(sim.bases.some((base) => base.slot !== 0 && base.hp < 500), "Unit must reach and attack enemy base.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Unit never leaves valid geometry.");
  });
  test("Bots use the same purchase rules and earn no free stats or points", () => {
    const sim = new Simulation(), bot = new BotController(1);
    bot.update(sim);
    assert(sim.commanders[1].atk === 1 && sim.commanders[1].def === 1, "No free upgrades.");
    Object.assign(sim.commanders[1], { atk: 5, def: 5, points: 9 });
    sim.time = 2;
    bot.update(sim);
    assert(sim.commanders[1].production === 1 && sim.commanders[1].points === 9, "Bot saves until full production cost is available.");
    sim.commanders[1].points = 10;
    sim.time = 4;
    bot.update(sim);
    assert(sim.commanders[1].production === 2 && sim.commanders[1].points === 0, "Bot pays same milestone cost.");
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
  test("Seeded default match sustains combat, crosses gateways, and damages bases", () => {
    const sim = new Simulation({}, 42);
    const controllers = createControllers();
    let earlierKills = 0;
    for (let i = 0; i < 3600 && !sim.finished; i++) {
      for (const controller of controllers) controller.update(sim);
      sim.step(sim.config.fixedStep);
      if (i === 2699) earlierKills = sim.commanders.reduce((sum, commander) => sum + commander.kills, 0);
    }
    assert(sim.bases.some((base) => base.hp < sim.config.baseHP), "Armies reach and damage an enemy base.");
    const kills = sim.commanders.reduce((sum, commander) => sum + commander.kills, 0);
    assert(kills > 100 && kills > earlierKills, "Actual combat continues during the final 30 seconds; no movement deadlock.");
    assert(sim.units.some((unit) => sim.geometry.inArena(unit)), "Armies cross gateways and fight in the arena.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Survivors stay outside impassable terrain.");
  });
  test("Scaled attacker traverses both gateways and wins a two-base combat fixture", () => {
    const sim = new Simulation({ spawnInterval: 1000 }, 1);
    for (const slot of [2, 3]) Object.assign(sim.bases[slot], { alive: false, hp: 0 });
    sim.commanders[0].atk = 2;
    sim.spawn(0);
    advance(sim, 150);
    assert(sim.finished && sim.winner === 0 && sim.bases[1].hp === 0, "Autonomous scaled attacks destroy the enemy base and end the match.");
    assert(sim.bases.filter((base) => base.alive).length === 1, "Exactly one base remains.");
    assert(sim.commanders[0].points === 0, "Base destruction still awards no unit-kill points.");
    assert(sim.units.every((unit) => sim.geometry.walkable(unit)), "Survivors stay on legal terrain.");
  });

  const passed = results.filter((result) => result.ok).length;
  document.getElementById("summary").textContent = `${passed}/${results.length} tests passed.`;
  window.arenaTestResults = { passed, total: results.length, results };
})();
