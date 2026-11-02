(() => {
  "use strict";

  const GATEWAY_WIDTH_IN_UNITS = 10;
  const GATEWAY_REFERENCE_UNIT_DIAMETER = 14;
  const UNIT_RADIUS = 3.5 * 1.1 * 1.15 * 1.15;
  const BALANCE = Object.freeze({
    mapSize: 1000,
    outerWall: 14,
    diamondReach: 334,
    wallRadius: 9,
    unitRadius: UNIT_RADIUS,
    doorwayWidth: GATEWAY_WIDTH_IN_UNITS * GATEWAY_REFERENCE_UNIT_DIAMETER,
    baseRadius: 55,
    baseHP: 1000,
    baseRegeneration: 2,
    regenerationDelay: 3,
    spawnInterval: 1.5,
    movementSpeed: 65,
    attackInterval: 1,
    attackRange: 8,
    localAggroRadius: 85,
    arenaAggro: true,
    aiInterval: 0.45,
    botInterval: 1.2,
    botReactionDelay: 0.875,
    initialATK: 1,
    initialDEF: 1,
    initialPoints: 0,
    healthBase: 12,
    healthPerDEF: 3,
    damageBase: 4,
    damagePerATK: 1,
    combatValuePerLevel: 0.125,
    statUpgradeCost: (currentLevel) => currentLevel,
    fixedStep: 1 / 30,
    collisionPasses: 3,
  });
  const FACTIONS = Object.freeze([
    { name: "BTC", color: "#f69c36", x: 112, y: 112 },
    { name: "ETH", color: "#7198ff", x: 888, y: 112 },
    { name: "SOL", color: "#58e4ac", x: 112, y: 888 },
    { name: "BNB", color: "#f7d552", x: 888, y: 888 },
  ]);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const combatValueFor = (displayedLevel, config) => 1 + (displayedLevel - 1) * config.combatValuePerLevel;
  const healthFor = (commander, config) => config.healthBase + combatValueFor(commander.def, config) * config.healthPerDEF;
  const damageFor = (commander, config) => config.damageBase + combatValueFor(commander.atk, config) * config.damagePerATK;

  function closestOnSegment(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  class Geometry {
    constructor(config) {
      this.config = config;
      const c = config.mapSize / 2, r = config.diamondReach;
      this.center = { x: c, y: c };
      this.vertices = [{ x: c, y: c - r }, { x: c + r, y: c }, { x: c, y: c + r }, { x: c - r, y: c }];
      this.walls = [];
      this.gates = [];
      const edges = [[3, 0], [0, 1], [2, 3], [1, 2]];
      for (const [aIndex, bIndex] of edges) {
        const a = this.vertices[aIndex], b = this.vertices[bIndex];
        const length = distance(a, b);
        const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const normal = { x: (midpoint.x - c) / (r / Math.SQRT2), y: (midpoint.y - c) / (r / Math.SQRT2) };
        // Rounded wall ends consume one wall radius on each side of the opening.
        const halfGap = config.doorwayWidth / 2 + config.wallRadius;
        const start = { x: midpoint.x - tangent.x * halfGap, y: midpoint.y - tangent.y * halfGap };
        const end = { x: midpoint.x + tangent.x * halfGap, y: midpoint.y + tangent.y * halfGap };
        this.walls.push([a, start], [end, b]);
        const offset = config.wallRadius + config.unitRadius + 10;
        this.gates.push({
          ...midpoint,
          outside: { x: midpoint.x + normal.x * offset, y: midpoint.y + normal.y * offset },
          inside: { x: midpoint.x - normal.x * offset, y: midpoint.y - normal.y * offset },
        });
      }
      this.walls.push(
        [this.vertices[0], { x: c, y: 0 }],
        [this.vertices[1], { x: config.mapSize, y: c }],
        [this.vertices[2], { x: c, y: config.mapSize }],
        [this.vertices[3], { x: 0, y: c }],
      );
      this.nodes = [this.center, ...this.gates.flatMap((gate) => [gate.inside, gate.outside])];
      this.links = this.nodes.map((a) => this.nodes.map((b) => this.lineClear(a, b, config.unitRadius) ? distance(a, b) : Infinity));
    }

    inArena(point) {
      return Math.abs(point.x - this.center.x) + Math.abs(point.y - this.center.y) < this.config.diamondReach;
    }

    territory(point) {
      if (this.inArena(point)) return -1;
      return (point.y >= this.center.y ? 2 : 0) + (point.x >= this.center.x ? 1 : 0);
    }

    walkable(point, radius = this.config.unitRadius) {
      const margin = this.config.outerWall + radius;
      if (point.x < margin || point.y < margin || point.x > this.config.mapSize - margin || point.y > this.config.mapSize - margin) return false;
      return this.walls.every(([a, b]) => distance(point, closestOnSegment(point, a, b)) >= this.config.wallRadius + radius - 0.001);
    }

    lineClear(a, b, radius = 0) {
      const steps = Math.max(1, Math.ceil(distance(a, b) / 4));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (!this.walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, radius)) return false;
      }
      return true;
    }

    route(start, goal) {
      if (this.lineClear(start, goal, this.config.unitRadius)) return [goal];
      const nodes = [...this.nodes, start, goal], source = nodes.length - 2, target = nodes.length - 1;
      const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
      costs[source] = 0;
      while (!visited.has(target)) {
        let current = -1;
        for (let i = 0; i < nodes.length; i++) {
          if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
        }
        if (current < 0 || !Number.isFinite(costs[current])) return [];
        visited.add(current);
        for (let next = 0; next < nodes.length; next++) {
          if (visited.has(next)) continue;
          const edge = current < this.nodes.length && next < this.nodes.length
            ? this.links[current][next]
            : this.lineClear(nodes[current], nodes[next], this.config.unitRadius) ? distance(nodes[current], nodes[next]) : Infinity;
          if (costs[current] + edge < costs[next]) {
            costs[next] = costs[current] + edge;
            previous[next] = current;
          }
        }
      }
      const route = [];
      for (let node = target; node !== source; node = previous[node]) route.unshift(nodes[node]);
      return route;
    }
  }

  class Simulation {
    constructor(overrides = {}, seed = 2026) {
      this.config = { ...BALANCE, ...overrides };
      this.geometry = new Geometry(this.config);
      this.randomState = seed >>> 0;
      this.time = 0;
      this.nextId = 1;
      this.units = [];
      this.winner = null;
      this.finished = false;
      this.openingAdvance = true;
      this.commanders = FACTIONS.map((faction, slot) => ({
        slot, name: faction.name, color: faction.color,
        atk: this.config.initialATK, def: this.config.initialDEF,
        points: this.config.initialPoints, production: 1, kills: 0,
      }));
      this.bases = FACTIONS.map((faction, slot) => ({
        slot, x: faction.x, y: faction.y, hp: this.config.baseHP,
        alive: true, lastDamage: -Infinity, nextSpawn: this.config.spawnInterval,
      }));
      this.spawnPositions = this.bases.map((base, slot) => {
        const gate = this.geometry.gates[slot];
        const length = distance(base, gate);
        const forward = { x: (gate.x - base.x) / length, y: (gate.y - base.y) / length };
        const radius = this.config.unitRadius, spacing = radius * 2 + 0.2;
        const positions = [];
        // Search concentric front-half rings: base proximity always wins over gate proximity.
        for (let reach = this.config.baseRadius + radius + 0.2; reach <= this.config.mapSize * Math.SQRT2; reach += spacing) {
          const angleStep = 2 * Math.asin(spacing / (2 * reach));
          const maxAngle = Math.acos(radius / reach);
          for (let offset = 0; offset * angleStep <= maxAngle; offset++) {
            for (const angle of offset === 0 ? [0] : [offset * angleStep, -offset * angleStep]) {
              const ahead = Math.cos(angle) * reach, lateral = Math.sin(angle) * reach;
              const point = {
                x: base.x + forward.x * ahead - forward.y * lateral,
                y: base.y + forward.y * ahead + forward.x * lateral,
              };
              if (this.geometry.territory(point) !== slot || !this.geometry.walkable(point)) continue;
              const arenaDistance = Math.abs(point.x - this.geometry.center.x) + Math.abs(point.y - this.geometry.center.y);
              if (arenaDistance < this.config.diamondReach + radius * Math.SQRT2) continue;
              if (distance(point, gate) < this.config.doorwayWidth / 2 + radius) continue;
              if (this.bases.some((other) => distance(point, other) < this.config.baseRadius + radius)) continue;
              positions.push(point);
            }
          }
        }
        return positions;
      });
    }

    random() {
      this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
      return this.randomState / 4294967296;
    }

    upgradeState(slot, type) {
      const commander = this.commanders[slot];
      if (!commander || !this.bases[slot].alive || this.finished) return { available: false, reason: "Commander is not active." };
      if (type === "atk" || type === "def") {
        const cost = this.config.statUpgradeCost(commander[type]);
        return { available: commander.points >= cost, cost, reason: `Requires ${cost} point${cost === 1 ? "" : "s"}.` };
      }
      return { available: false, reason: "Unknown upgrade." };
    }

    purchase(slot, type) {
      const state = this.upgradeState(slot, type);
      if (!state.available) return { ok: false, message: state.reason };
      const commander = this.commanders[slot];
      commander.points -= state.cost;
      const previousHealth = healthFor(commander, this.config);
      commander[type]++;
      if (type === "def") {
        const healthGain = healthFor(commander, this.config) - previousHealth;
        for (const unit of this.units) {
          if (unit.slot === slot) unit.hp += healthGain;
        }
      }
      return { ok: true, message: `${type.toUpperCase()} purchased.` };
    }

    nearestEnemyBase(unit) {
      let nearest = null;
      for (const base of this.bases) {
        if (base.alive && base.slot !== unit.slot && (!nearest || distance(unit, base) < distance(unit, nearest))) nearest = base;
      }
      return nearest;
    }

    selectTarget(unit) {
      if (this.openingAdvance) return { kind: "rally", entity: this.geometry.center };
      const inArena = this.geometry.inArena(unit);
      let local = null, arena = null;
      for (const enemy of this.units) {
        if (enemy.slot === unit.slot || enemy.hp <= 0) continue;
        const d = distance(unit, enemy);
        if (d <= this.config.localAggroRadius && this.geometry.lineClear(unit, enemy) && (!local || d < local.distance)) local = { entity: enemy, distance: d };
        if (inArena && this.config.arenaAggro && this.geometry.inArena(enemy) && (!arena || d < arena.distance)) arena = { entity: enemy, distance: d };
      }
      const target = local?.entity || arena?.entity;
      if (target) return { kind: "unit", entity: target };
      const base = this.nearestEnemyBase(unit);
      return base ? { kind: "base", entity: base } : null;
    }

    canOccupy(point, ignoreUnit = null) {
      return this.geometry.walkable(point) &&
        this.bases.every((base) => !base.alive || distance(point, base) >= this.config.baseRadius + this.config.unitRadius) &&
        this.units.every((unit) => unit === ignoreUnit || unit.hp <= 0 || distance(point, unit) >= this.config.unitRadius * 2 - 0.1);
    }

    spawn(slot) {
      const base = this.bases[slot];
      if (!base.alive || this.finished) return null;
      const radius = this.config.unitRadius;
      for (const point of this.spawnPositions[slot]) {
        if (!this.canOccupy(point) || this.units.some((unit) => unit.hp > 0 && distance(point, unit) < radius * 2)) continue;
        const unit = {
          ...point, id: this.nextId++, slot, hp: healthFor(this.commanders[slot], this.config),
          cooldown: 0, thinkAt: this.time + this.random() * this.config.aiInterval,
          target: null, path: [], heading: Math.atan2(this.geometry.gates[slot].y - point.y, this.geometry.gates[slot].x - point.x), swing: 0,
        };
        this.units.push(unit);
        return unit;
      }
      return null;
    }

    movePoint(unit, point) {
      if (!this.geometry.walkable(point)) return false;
      if (this.bases.some((base) => base.alive && distance(point, base) < this.config.baseRadius + this.config.unitRadius)) return false;
      unit.x = point.x;
      unit.y = point.y;
      return true;
    }

    move(unit, goal, dt) {
      const d = distance(unit, goal);
      if (d < 0.01) return;
      const amount = Math.min(d, this.config.movementSpeed * dt);
      unit.heading = Math.atan2(goal.y - unit.y, goal.x - unit.x);
      const dx = Math.cos(unit.heading) * amount, dy = Math.sin(unit.heading) * amount;
      const direct = { x: unit.x + dx, y: unit.y + dy };
      const diameter = this.config.unitRadius * 2;
      const nearby = this.units.filter((other) => other !== unit && other.hp > 0 && distance(unit, other) < amount + diameter);
      const blocks = (other, point) => {
        const clearance = Math.min(diameter, distance(unit, other));
        return distance(other, closestOnSegment(other, unit, point)) < clearance - 0.001;
      };
      const tryMove = (point) => {
        if (!this.geometry.lineClear(unit, point, this.config.unitRadius)) return false;
        if (this.bases.some((base) => base.alive &&
          distance(base, closestOnSegment(base, unit, point)) < this.config.baseRadius + this.config.unitRadius)) return false;
        if (nearby.some((other) => blocks(other, point))) return false;
        return this.movePoint(unit, point);
      };
      if (tryMove(direct)) return;
      const blockers = nearby.filter((other) => blocks(other, direct));
      if (blockers.some((other) => other.slot !== unit.slot)) return;
      if (blockers.length) {
        const blocker = blockers.reduce((nearest, other) => distance(unit, other) < distance(unit, nearest) ? other : nearest);
        const cross = dx * (blocker.y - unit.y) - dy * (blocker.x - unit.x);
        const side = Math.abs(cross) > 0.001 ? -Math.sign(cross) : unit.id % 2 ? 1 : -1;
        // Try both sides, keeping a forward component or sliding tangentially around a friend.
        for (const turn of [Math.PI / 6, Math.PI / 3, Math.PI / 2]) {
          for (const direction of [side, -side]) {
            const heading = unit.heading + turn * direction;
            if (tryMove({ x: unit.x + Math.cos(heading) * amount, y: unit.y + Math.sin(heading) * amount })) {
              unit.heading = heading;
              return;
            }
          }
        }
        return;
      }
      if (tryMove({ x: unit.x + dx, y: unit.y })) return;
      tryMove({ x: unit.x, y: unit.y + dy });
    }

    separateUnits() {
      const diameter = this.config.unitRadius * 2;
      for (let pass = 0; pass < this.config.collisionPasses; pass++) {
        const buckets = new Map();
        for (const unit of this.units) {
          if (unit.hp <= 0) continue;
          const x = Math.floor(unit.x / diameter), y = Math.floor(unit.y / diameter);
          for (let cx = x - 1; cx <= x + 1; cx++) {
            for (let cy = y - 1; cy <= y + 1; cy++) {
              for (const other of buckets.get(`${cx},${cy}`) || []) {
                const d = distance(unit, other);
                if (d >= diameter || !this.geometry.lineClear(unit, other)) continue;
                const angle = d > 0.001 ? Math.atan2(unit.y - other.y, unit.x - other.x) : (unit.id % 8) * Math.PI / 4;
                const push = (diameter - d) / 2 + 0.01;
                const dx = Math.cos(angle) * push, dy = Math.sin(angle) * push;
                const moved = this.movePoint(unit, { x: unit.x + dx, y: unit.y + dy });
                const otherMoved = this.movePoint(other, { x: other.x - dx, y: other.y - dy });
                if (!moved && otherMoved) this.movePoint(other, { x: other.x - dx, y: other.y - dy });
                if (moved && !otherMoved) this.movePoint(unit, { x: unit.x + dx, y: unit.y + dy });
              }
            }
          }
          const key = `${Math.floor(unit.x / diameter)},${Math.floor(unit.y / diameter)}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(unit);
        }
      }
    }

    attack(unit, target) {
      if (target.kind === "rally") return false;
      const entity = target.entity;
      const range = this.config.unitRadius + (target.kind === "base" ? this.config.baseRadius : this.config.unitRadius) + this.config.attackRange;
      if (unit.cooldown > 0 || distance(unit, entity) > range || !this.geometry.lineClear(unit, entity)) return false;
      if (entity.hp <= 0 || (target.kind === "base" && !entity.alive)) return false;
      entity.hp = Math.max(0, entity.hp - damageFor(this.commanders[unit.slot], this.config));
      unit.cooldown = this.config.attackInterval;
      unit.swing = 0.22;
      unit.heading = Math.atan2(entity.y - unit.y, entity.x - unit.x);
      if (target.kind === "base") {
        entity.lastDamage = this.time;
        if (entity.hp === 0) entity.alive = false;
      } else if (entity.hp === 0) {
        this.commanders[unit.slot].points++;
        this.commanders[unit.slot].kills++;
      }
      return true;
    }

    step(dt) {
      if (this.finished) return;
      this.time += dt;
      for (const base of this.bases) {
        if (!base.alive) continue;
        if (this.time - base.lastDamage >= this.config.regenerationDelay) base.hp = Math.min(this.config.baseHP, base.hp + this.config.baseRegeneration * dt);
        while (this.time + 1e-8 >= base.nextSpawn) {
          this.spawn(base.slot);
          base.nextSpawn += this.config.spawnInterval;
        }
      }
      if (this.openingAdvance && this.units.some((unit) => unit.hp > 0 && this.units.some((enemy) =>
        enemy.hp > 0 && enemy.slot !== unit.slot &&
        distance(unit, enemy) <= this.config.unitRadius * 2 + this.config.attackRange &&
        this.geometry.lineClear(unit, enemy)))) {
        this.openingAdvance = false;
        for (const unit of this.units) {
          unit.target = null;
          unit.path = [];
          unit.thinkAt = this.time;
        }
      }
      if (this.openingAdvance && this.bases.filter((base) => base.alive).length < 2) this.openingAdvance = false;
      // Rotate the processing order so one faction never receives permanent first-strike priority.
      const start = this.units.length ? Math.floor(this.time / this.config.fixedStep) % this.units.length : 0;
      for (let i = 0; i < this.units.length; i++) {
        const unit = this.units[(i + start) % this.units.length];
        if (unit.hp <= 0) continue;
        unit.cooldown = Math.max(0, unit.cooldown - dt);
        unit.swing = Math.max(0, unit.swing - dt);
        const stale = unit.target && (unit.target.entity.hp <= 0 || (unit.target.kind === "base" && !unit.target.entity.alive));
        if (this.time >= unit.thinkAt || stale || !unit.target) {
          unit.target = this.selectTarget(unit);
          unit.path = unit.target ? this.geometry.route(unit, unit.target.entity) : [];
          unit.thinkAt = this.time + this.config.aiInterval;
        }
        if (!unit.target) continue;
        const target = unit.target.entity;
        const range = this.config.unitRadius + (unit.target.kind === "base" ? this.config.baseRadius : this.config.unitRadius) + this.config.attackRange;
        if (unit.target.kind !== "rally" && distance(unit, target) <= range && this.geometry.lineClear(unit, target)) this.attack(unit, unit.target);
        else {
          while (unit.path.length > 1 && distance(unit, unit.path[0]) < this.config.movementSpeed * dt + 2) unit.path.shift();
          const goal = unit.path[0];
          if (goal) this.move(unit, goal, dt);
        }
      }
      this.separateUnits();
      this.units = this.units.filter((unit) => unit.hp > 0);
      const alive = this.bases.filter((base) => base.alive);
      if (alive.length <= 1) {
        this.finished = true;
        this.winner = alive.length ? alive[0].slot : null;
      }
    }
  }

  window.RayRayArena = { BALANCE, GATEWAY_WIDTH_IN_UNITS, FACTIONS, Geometry, Simulation, distance, combatValueFor, healthFor, damageFor };
})();
