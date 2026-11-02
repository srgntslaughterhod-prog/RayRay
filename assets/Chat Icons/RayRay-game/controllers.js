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
      this.pending = null;
    }

    update(simulation) {
      if (!simulation.bases[this.slot].alive || simulation.finished) {
        this.pending = null;
        return [];
      }
      if (this.pending) {
        if (!simulation.upgradeState(this.slot, this.pending.type).available) {
          this.pending = null;
          return [];
        }
        if (simulation.time < this.pending.purchaseAt) return [];
        const { type } = this.pending;
        this.pending = null;
        return [simulation.purchase(this.slot, type)];
      }
      if (simulation.time < this.nextDecision) return [];
      this.nextDecision = simulation.time + simulation.config.botInterval;
      const commander = simulation.commanders[this.slot];
      const type = commander.atk < commander.def ? "atk" : commander.def < commander.atk ? "def" : simulation.random() < 0.5 ? "atk" : "def";
      if (!simulation.upgradeState(this.slot, type).available) return [];
      this.pending = { type, purchaseAt: simulation.time + simulation.config.botReactionDelay };
      return [];
    }
  }

  function createControllers(humanSlot = DEFAULT_HUMAN_SLOT) {
    return FACTIONS.map((faction, slot) => slot === humanSlot ? new LocalHumanController(slot) : new BotController(slot));
  }

  Object.assign(window.RayRayArena, { LocalHumanController, BotController, DEFAULT_HUMAN_SLOT, createControllers });
})();
