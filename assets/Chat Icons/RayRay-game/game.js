(() => {
  "use strict";
  const { Simulation, Renderer, createControllers, DEFAULT_HUMAN_SLOT, FACTIONS } = window.RayRayArena;
  const element = (id) => document.getElementById(id);
  const renderer = new Renderer(element("arena"));
  let simulation, controllers, humanController, paused = false, ready = false;
  let previousTime = 0, accumulator = 0, nextUI = 0, frame = null;
  const cardElements = FACTIONS.map((faction, slot) => {
    const card = document.createElement("article");
    card.className = "faction-card";
    card.style.setProperty("--faction-color", faction.color);
    card.innerHTML = `<h3>${faction.name}<span>${slot === DEFAULT_HUMAN_SLOT ? "HUMAN" : "BOT"}</span></h3><div class="base-meter"><span></span></div><p class="base-info"></p><p class="army-info"></p>`;
    element("factions").append(card);
    return card;
  });

  function updateUI() {
    const humanSlot = humanController.slot;
    const human = simulation.commanders[humanSlot];
    element("commander-title").textContent = `${human.name} · Your command`;
    element("points").textContent = human.points;
    element("attack").textContent = human.atk;
    element("defense").textContent = human.def;
    element("production").textContent = human.production;
    element("production-label").textContent = human.production === 1 ? "unit/spawn" : "units/spawn";
    const unit = simulation.upgradeState(humanSlot, "unit");
    element("unit-cost").textContent = unit.cost ? `Next: ${unit.cost} points` : human.production === 5 ? "Maximum" : "Unavailable";
    element("unit-requirement").textContent = unit.requirement ? `Needs ATK ${unit.requirement} / DEF ${unit.requirement}` : "";
    for (const type of ["atk", "def", "unit"]) {
      const state = simulation.upgradeState(humanSlot, type);
      const button = element(`upgrade-${type}`);
      button.disabled = paused || !state.available;
      button.title = state.available ? "" : state.reason;
      if (type !== "unit") {
        const cost = state.cost ?? simulation.config.statUpgradeCost(human[type]);
        button.querySelector("small").textContent = `Next: ${cost} point${cost === 1 ? "" : "s"}`;
      }
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
    element("pause").disabled = simulation.finished;
    element("pause").textContent = paused ? "Resume" : "Pause";
    const status = simulation.finished
      ? simulation.winner === null ? "No bases remain." : `${FACTIONS[simulation.winner].name} wins — last base standing.`
      : paused ? "Paused. Resume to continue."
      : !simulation.bases[humanSlot].alive ? "Your base was destroyed. Watching the remaining factions."
      : `You command ${human.name}. Your army fights automatically.`;
    if (element("match-status").textContent !== status) element("match-status").textContent = status;
  }

  function start() {
    simulation = new Simulation({}, (Date.now() ^ Math.floor(Math.random() * 1000000)) >>> 0);
    controllers = createControllers();
    humanController = controllers.find((controller) => controller.kind === "HUMAN");
    paused = false;
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
    if (!paused && !simulation.finished) {
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

  for (const type of ["atk", "def", "unit"]) {
    element(`upgrade-${type}`).addEventListener("click", () => {
      if (!ready || paused || simulation.finished) return;
      humanController.request(type);
    });
  }
  element("pause").addEventListener("click", () => {
    paused = !paused;
    humanController.pending.length = 0;
    accumulator = 0;
    updateUI();
  });
  element("restart").addEventListener("click", () => start());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ready && !simulation.finished) {
      paused = true;
      humanController.pending.length = 0;
      updateUI();
    }
  });
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
    start();
    frame = requestAnimationFrame(tick);
  }).catch((error) => {
    ready = false;
    if (frame !== null) cancelAnimationFrame(frame);
    element("match-status").textContent = `Cannot start the match: ${error.message}`;
    console.error("RayRay Arena failed to start.", error);
  });
})();
