(() => {
  "use strict";
  const { FACTIONS } = window.RayRayArena;
  const DEFAULT_HUMAN_SLOT = FACTIONS.findIndex((faction) => faction.name === "SOL");

  class LocalHumanController {
    constructor(slot) {
      this.slot = slot;
      this.kind = "HUMAN";
      this.pending = [];
    }

    request(type) {
      this.pending.push(type);
    }

    update(simulation) {
      const results = this.pending.map((type) => simulation.purchase(this.slot, type));
      this.pending.length = 0;
      return results;
    }
  }

  class BotController {
    constructor(slot) {
      this.slot = slot;
      this.kind = "BOT";
      this.nextDecision = 0;
    }

    update(simulation) {
      if (simulation.time < this.nextDecision || !simulation.bases[this.slot].alive || simulation.finished) return [];
      this.nextDecision = simulation.time + simulation.config.botInterval;
      const commander = simulation.commanders[this.slot];
      if (simulation.upgradeState(this.slot, "unit").available) return [simulation.purchase(this.slot, "unit")];
      const next = simulation.upgradeState(this.slot, "unit");
      // Save the production cost when the next milestone has already been reached.
      if (next.requirement && commander.atk >= next.requirement && commander.def >= next.requirement) return [];
      const type = commander.atk < commander.def ? "atk" : commander.def < commander.atk ? "def" : simulation.random() < 0.5 ? "atk" : "def";
      if (!simulation.upgradeState(this.slot, type).available) return [];
      return [simulation.purchase(this.slot, type)];
    }
  }

  function createControllers(humanSlot = DEFAULT_HUMAN_SLOT) {
    return FACTIONS.map((faction, slot) => slot === humanSlot ? new LocalHumanController(slot) : new BotController(slot));
  }

  Object.assign(window.RayRayArena, { LocalHumanController, BotController, DEFAULT_HUMAN_SLOT, createControllers });
})();
