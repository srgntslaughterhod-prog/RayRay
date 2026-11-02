(() => {
  "use strict";
  const { FACTIONS, healthFor } = window.RayRayArena;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load approved artwork: ${src}`));
      image.src = src;
    });
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      if (!this.context) throw new Error("This browser does not support a 2D canvas.");
    }

    async load() {
      [this.mapImage, this.unitImage, ...this.logos] = await Promise.all([
        loadImage("game-assets/reference/arena-terrain (2).png"),
        loadImage("game-assets/reference/unit.png"),
        ...FACTIONS.map((faction) => loadImage(`game-assets/${faction.name.toLowerCase()}-logo.svg`)),
      ]);
      // Only orange suit/pickaxe accents are recolored; helmet and silhouette stay intact.
      const working = document.createElement("canvas");
      working.width = 512;
      working.height = Math.round(512 * 945 / 820);
      const context = working.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Unable to prepare faction sprites.");
      context.drawImage(this.unitImage, 235, 205, 820, 945, 0, 0, working.width, working.height);
      const original = context.getImageData(0, 0, working.width, working.height);
      this.sprites = FACTIONS.map((faction) => {
        const sprite = document.createElement("canvas");
        sprite.width = working.width;
        sprite.height = working.height;
        const spriteContext = sprite.getContext("2d");
        if (!spriteContext) throw new Error("Unable to create faction sprite.");
        const pixels = new ImageData(new Uint8ClampedArray(original.data), working.width, working.height);
        const rgb = faction.color.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16));
        for (let i = 0; i < pixels.data.length; i += 4) {
          const [r, g, b] = pixels.data.slice(i, i + 3);
          if (r > 110 && g > 35 && g < r * 0.8 && b < g * 0.65) {
            const light = Math.min(1.25, Math.max(0.4, r / 220));
            for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, rgb[c] * light);
          }
        }
        spriteContext.putImageData(pixels, 0, 0);
        return sprite;
      });
    }

    resize() {
      const parent = this.canvas.parentElement;
      const size = Math.max(1, Math.floor(Math.min(parent.clientWidth, parent.clientHeight)));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.canvas.width = Math.round(size * ratio);
      this.canvas.height = Math.round(size * ratio);
    }

    render(simulation) {
      const ctx = this.context, config = simulation.config, map = simulation.geometry;
      const scale = this.canvas.width / config.mapSize;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, config.mapSize, config.mapSize);
      // The approved map provides the terrain/base artwork; collision geometry is drawn on top.
      ctx.drawImage(this.mapImage, 0, 0, config.mapSize, config.mapSize);
      ctx.fillStyle = "#10172235";
      ctx.fillRect(0, 0, config.mapSize, config.mapSize);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [a, b] of map.walls) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineWidth = config.wallRadius * 2;
        ctx.strokeStyle = "#292a2c";
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#797674";
        ctx.stroke();
      }
      ctx.strokeStyle = "#6d7073";
      ctx.lineWidth = config.outerWall * 2;
      ctx.strokeRect(0, 0, config.mapSize, config.mapSize);
      for (const base of simulation.bases) {
        if (!base.alive) {
          ctx.beginPath();
          ctx.arc(base.x, base.y, 75, 0, Math.PI * 2);
          ctx.fillStyle = "#161719e8";
          ctx.fill();
          ctx.strokeStyle = "#7d7470";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(base.x - 25, base.y - 25);
          ctx.lineTo(base.x + 25, base.y + 25);
          ctx.moveTo(base.x + 25, base.y - 25);
          ctx.lineTo(base.x - 25, base.y + 25);
          ctx.stroke();
        }
        ctx.fillStyle = "#071018db";
        ctx.fillRect(base.x - 48, base.y + 68, 96, 9);
        ctx.fillStyle = FACTIONS[base.slot].color;
        ctx.fillRect(base.x - 48, base.y + 68, 96 * base.hp / config.baseHP, 9);
        const logoX = base.x < config.mapSize / 2 ? base.x + 94 : base.x - 94;
        ctx.drawImage(this.logos[base.slot], logoX - 15, base.y - 15, 30, 30);
      }
      for (const unit of simulation.units) {
        const commander = simulation.commanders[unit.slot];
        ctx.save();
        ctx.translate(unit.x, unit.y);
        ctx.rotate(unit.heading + Math.PI / 2 + (unit.swing > 0 ? Math.sin(unit.swing / 0.22 * Math.PI) * 0.45 : 0));
        const width = 22 * 1.1 * 1.15 * 1.15;
        const height = width * this.sprites[unit.slot].height / this.sprites[unit.slot].width;
        ctx.drawImage(this.sprites[unit.slot], -width / 2, -height / 2, width, height);
        ctx.restore();
        if (unit.hp < healthFor(commander, config)) {
          ctx.fillStyle = "#111";
          ctx.fillRect(unit.x - 8, unit.y - 15, 16, 2);
          ctx.fillStyle = commander.color;
          ctx.fillRect(unit.x - 8, unit.y - 15, 16 * unit.hp / healthFor(commander, config), 2);
        }
      }
      if (simulation.finished) {
        ctx.fillStyle = "#080e19c9";
        ctx.fillRect(0, 410, config.mapSize, 160);
        ctx.textAlign = "center";
        ctx.fillStyle = simulation.winner === null ? "#fff" : FACTIONS[simulation.winner].color;
        ctx.font = "bold 40px system-ui";
        ctx.fillText(simulation.winner === null ? "NO BASES REMAIN" : `${FACTIONS[simulation.winner].name} WINS`, 500, 480);
        ctx.font = "20px system-ui";
        ctx.fillStyle = "#fff";
        ctx.fillText("Last base standing. Start a new match to play again.", 500, 524);
      }
    }
  }

  window.RayRayArena.Renderer = Renderer;
})();
