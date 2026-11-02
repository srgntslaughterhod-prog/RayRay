(() => {
  "use strict";
  const { Simulation, Renderer, createControllers, FACTIONS, BALANCE } = window.RayRayArena;
  const element = (id) => document.getElementById(id);
  const renderer = new Renderer(element("arena"));
  const difficultyDelays = Object.freeze({ easy: 1, medium: 0.875, hard: 0.75 });
  const fastestDifficultyDelays = Object.freeze({ easy: 1, medium: 0.75, hard: 0.5 });
  const speedMultipliers = Object.freeze({ normal: 1, fast: 1.5, fastest: 2 });
  let simulation, controllers, humanController, ready = false, inSetup = true;
  let difficulty = "medium";
  let speed = "normal";
  let selectedSlot = null;
  let botBattleSelected = false;
  const factionButtons = ["SOL", "BTC", "ETH", "BNB"].map((name) => element(`faction-${name}`));
  const difficultyButtons = Object.keys(difficultyDelays).map((name) => element(`difficulty-${name}`));
  const speedButtons = Object.keys(speedMultipliers).map((name) => element(`speed-${name}`));
  let previousTime = 0, accumulator = 0, nextUI = 0, frame = null;
  const cardElements = FACTIONS.map((faction, slot) => {
    const card = document.createElement("article");
    card.className = "faction-card";
    card.style.setProperty("--faction-color", faction.color);
    card.innerHTML = `<h3>${faction.name}<span>BOT</span></h3><div class="base-meter"><span></span></div><p class="base-info"></p><p class="army-info"></p>`;
    element("factions").append(card);
    return card;
  });

  function updateUI() {
    const humanSlot = humanController ? humanController.slot : selectedSlot ?? 0;
    const human = simulation.commanders[humanSlot];
    element("commander-title").textContent = inSetup && !botBattleSelected && selectedSlot === null
      ? "Choose your faction"
      : `${human.name} · ${humanController ? "Your command" : "Bot command"}`;
    element("points").textContent = human.points;
    element("attack").textContent = human.atk;
    element("defense").textContent = human.def;
    for (const type of ["atk", "def"]) {
      const state = simulation.upgradeState(humanSlot, type);
      const button = element(`upgrade-${type}`);
      button.disabled = inSetup || !humanController || !state.available;
      button.title = state.available ? "" : state.reason;
      const cost = state.cost ?? simulation.config.statUpgradeCost(human[type]);
      button.querySelector("small").textContent = `Next: ${cost} point${cost === 1 ? "" : "s"}`;
    }
    for (const [slot, card] of cardElements.entries()) {
      const base = simulation.bases[slot], commander = simulation.commanders[slot];
      const count = simulation.units.filter((unit) => unit.slot === slot).length;
      card.querySelector("h3 span").textContent = controllers[slot].kind;
      card.classList.toggle("eliminated", !base.alive);
      card.querySelector(".base-meter span").style.width = `${base.hp / simulation.config.baseHP * 100}%`;
      card.querySelector(".base-info").textContent = `${base.alive ? `Base ${Math.ceil(base.hp)}/${simulation.config.baseHP} HP` : "BASE ELIMINATED"} · ${count} units`;
      card.querySelector(".army-info").textContent = `ATK ${commander.atk} · DEF ${commander.def} · ${commander.production}/spawn · ${commander.points} points`;
    }
    const seconds = Math.floor(simulation.time);
    element("clock").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    element("restart").disabled = !ready || ((inSetup || simulation.finished) && !botBattleSelected && selectedSlot === null);
    element("bot-battle").setAttribute("aria-pressed", String(botBattleSelected));
    for (const button of factionButtons) {
      button.disabled = !ready || (!inSetup && !simulation.finished);
      button.setAttribute("aria-pressed", String(selectedSlot !== null && button.id === `faction-${FACTIONS[selectedSlot].name}`));
    }
    for (const button of difficultyButtons) {
      button.disabled = !ready || (!inSetup && !simulation.finished);
      button.setAttribute("aria-pressed", String(button.id === `difficulty-${difficulty}`));
    }
    for (const button of speedButtons) {
      button.disabled = !ready || (!inSetup && !simulation.finished);
      button.setAttribute("aria-pressed", String(button.id === `speed-${speed}`));
    }
    const status = inSetup
      ? botBattleSelected ? "BOT BATTLE setup. Set speed and difficulty, then press BOT BATTLE."
        : "Choose a faction for New Game, or start BOT BATTLE."
      : simulation.finished
      ? simulation.winner === null ? "No bases remain." : `${FACTIONS[simulation.winner].name} wins — last base standing.`
      : !humanController ? "BOT BATTLE. Press BOT BATTLE to stop and change settings."
      : !simulation.bases[humanSlot].alive ? "Your base was destroyed. Watching the remaining factions."
      : `You command ${human.name}. Your army fights automatically.`;
    if (element("match-status").textContent !== status) element("match-status").textContent = status;
  }

  function start(setup, botBattle = false) {
    inSetup = setup;
    botBattleSelected = botBattle;
    simulation = new Simulation({
      botReactionDelay: (speed === "fastest" ? fastestDifficultyDelays : difficultyDelays)[difficulty],
      movementSpeed: BALANCE.movementSpeed * speedMultipliers[speed],
    }, (Date.now() ^ Math.floor(Math.random() * 1000000)) >>> 0);
    controllers = createControllers(botBattleSelected ? null : selectedSlot);
    humanController = controllers.find((controller) => controller.kind === "HUMAN");
    accumulator = 0;
    previousTime = 0;
    nextUI = 0;
    element("command-message").textContent = "";
    updateUI();
    renderer.render(simulation);
  }

  function tick(timestamp) {
    const elapsed = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.1) : 0;
    previousTime = timestamp;
    if (!inSetup && !simulation.finished) {
      accumulator += elapsed;
      while (accumulator >= simulation.config.fixedStep) {
        for (const controller of controllers) {
          const results = controller.update(simulation);
          if (controller.kind === "HUMAN" && results.length) element("command-message").textContent = results.at(-1).message;
        }
        simulation.step(simulation.config.fixedStep);
        accumulator -= simulation.config.fixedStep;
      }
    }
    if (timestamp >= nextUI) {
      updateUI();
      nextUI = timestamp + 150;
    }
    renderer.render(simulation);
    frame = requestAnimationFrame(tick);
  }

  for (const type of ["atk", "def"]) {
    element(`upgrade-${type}`).addEventListener("click", () => {
      if (!ready || inSetup || !humanController || simulation.finished) return;
      humanController.request(type);
    });
  }
  element("restart").addEventListener("click", () => {
    if (!ready) return;
    if (botBattleSelected) {
      start(selectedSlot === null);
      return;
    }
    if ((inSetup || simulation.finished) && selectedSlot === null) {
      element("command-message").textContent = "Choose a faction before starting New Game.";
      return;
    }
    start(!inSetup && !simulation.finished);
  });
  for (const button of factionButtons) {
    button.addEventListener("click", () => {
      if (!ready || (!inSetup && !simulation.finished)) return;
      selectedSlot = FACTIONS.findIndex((faction) => button.id === `faction-${faction.name}`);
      if (inSetup) start(true);
      else updateUI();
    });
  }
  element("bot-battle").addEventListener("click", () => {
    if (!ready) return;
    start(!inSetup && !simulation.finished, true);
  });
  for (const button of difficultyButtons) {
    button.addEventListener("click", () => {
      if (!ready || (!inSetup && !simulation.finished)) return;
      difficulty = button.id.slice("difficulty-".length);
      updateUI();
    });
  }
  for (const button of speedButtons) {
    button.addEventListener("click", () => {
      if (!ready || (!inSetup && !simulation.finished)) return;
      speed = button.id.slice("speed-".length);
      updateUI();
    });
  }
  const resize = new ResizeObserver(() => {
    renderer.resize();
    if (ready) renderer.render(simulation);
  });
  resize.observe(element("arena").parentElement);
  window.addEventListener("resize", () => {
    renderer.resize();
    if (ready) renderer.render(simulation);
  });

  renderer.load().then(() => {
    renderer.resize();
    ready = true;
    element("restart").disabled = false;
    element("bot-battle").disabled = false;
    start(true);
    frame = requestAnimationFrame(tick);
  }).catch((error) => {
    ready = false;
    if (frame !== null) cancelAnimationFrame(frame);
    element("match-status").textContent = `Cannot start the match: ${error.message}`;
    console.error("RayRay Arena failed to start.", error);
  });
})();
