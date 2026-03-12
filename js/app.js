function fitCanvas(canvas) {
  const maxWidth = window.innerWidth * 0.9;
  const maxHeight = window.innerHeight * 0.75;
  const scale = Math.max(
    1,
    Math.floor(Math.min(maxWidth / canvas.width, maxHeight / canvas.height))
  );
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}

class SceneManager {
  constructor() {
    this.scenes = new Map();
    this.activeScene = null;
    this.running = false;
    this.lastTime = 0;
    this.boundLoop = this.loop.bind(this);
  }

  register(name, scene) {
    this.scenes.set(name, scene);
    scene.manager = this;
  }

  change(name) {
    if (this.activeScene && this.activeScene.onExit) {
      this.activeScene.onExit();
    }
    this.activeScene = this.scenes.get(name) || null;
    if (this.activeScene && this.activeScene.onEnter) {
      this.activeScene.onEnter();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.boundLoop);
  }

  stop() {
    this.running = false;
  }

  loop(timestamp) {
    const delta = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    if (this.activeScene) {
      this.activeScene.update(delta);
      this.activeScene.render();
    }
    if (this.running) {
      requestAnimationFrame(this.boundLoop);
    }
  }
}

class InputController {
  constructor() {
    this.keys = new Set();
    this.axes = { x: 0, y: 0 };
    this.attach();
  }

  attach() {
    window.addEventListener("keydown", (event) => {
      if (
        event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight" ||
        event.code === "Space"
      ) {
        event.preventDefault();
      }
      this.keys.add(event.code);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  updateAxes() {
    const left = this.isDown("ArrowLeft") || this.isDown("KeyA");
    const right = this.isDown("ArrowRight") || this.isDown("KeyD");
    const up = this.isDown("ArrowUp") || this.isDown("KeyW");
    const down = this.isDown("ArrowDown") || this.isDown("KeyS");

    this.axes.x = (right ? 1 : 0) - (left ? 1 : 0);
    this.axes.y = (down ? 1 : 0) - (up ? 1 : 0);
  }
}

class Camera {
  constructor({ viewportWidth, viewportHeight, worldWidth, worldHeight }) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.x = 0;
    this.y = 0;
  }

  follow(target) {
    this.x = target.x + target.width / 2 - this.viewportWidth / 2;
    this.y = target.y + target.height / 2 - this.viewportHeight / 2;

    this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.viewportWidth));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.viewportHeight));
  }
}

class TileMap {
  constructor({ width, height, tileSize }) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.tiles = new Uint8Array(width * height);
    this.generate();
  }

  generate() {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const index = y * this.width + x;
        const isBorder =
          x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
        const isPillar = x % 9 === 0 && y % 7 === 0;
        this.tiles[index] = isBorder || isPillar ? 1 : 0;
      }
    }
  }

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 1;
    return this.tiles[y * this.width + x];
  }
}

class Player {
  constructor({ x, y }) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 14;
    this.speed = 90;
  }
}

class GameScene {
  constructor({ canvas, context, input }) {
    this.canvas = canvas;
    this.context = context;
    this.input = input;
    this.tileSize = 16;
    this.map = new TileMap({
      width: 64,
      height: 40,
      tileSize: this.tileSize,
    });
    this.player = new Player({
      x: this.tileSize * 4,
      y: this.tileSize * 4,
    });
    this.camera = new Camera({
      viewportWidth: this.canvas.width,
      viewportHeight: this.canvas.height,
      worldWidth: this.map.width * this.tileSize,
      worldHeight: this.map.height * this.tileSize,
    });
  }

  update(delta) {
    this.input.updateAxes();

    let moveX = this.input.axes.x;
    let moveY = this.input.axes.y;

    if (moveX !== 0 && moveY !== 0) {
      moveX *= Math.SQRT1_2;
      moveY *= Math.SQRT1_2;
    }

    this.player.x += moveX * this.player.speed * delta;
    this.player.y += moveY * this.player.speed * delta;

    const maxX = this.map.width * this.tileSize - this.player.width;
    const maxY = this.map.height * this.tileSize - this.player.height;
    this.player.x = Math.max(0, Math.min(this.player.x, maxX));
    this.player.y = Math.max(0, Math.min(this.player.y, maxY));

    this.camera.follow(this.player);
  }

  render() {
    const ctx = this.context;
    ctx.fillStyle = "#0b0e13";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const startCol = Math.floor(this.camera.x / this.tileSize);
    const endCol = Math.ceil(
      (this.camera.x + this.canvas.width) / this.tileSize
    );
    const startRow = Math.floor(this.camera.y / this.tileSize);
    const endRow = Math.ceil(
      (this.camera.y + this.canvas.height) / this.tileSize
    );

    for (let y = startRow; y < endRow; y += 1) {
      for (let x = startCol; x < endCol; x += 1) {
        const tile = this.map.tileAt(x, y);
        const screenX = x * this.tileSize - this.camera.x;
        const screenY = y * this.tileSize - this.camera.y;
        if (tile === 1) {
          ctx.fillStyle = "#1f3a44";
        } else {
          ctx.fillStyle = "#263346";
        }
        ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
        if (tile === 1) {
          ctx.fillStyle = "#2f5461";
          ctx.fillRect(
            screenX + 2,
            screenY + 2,
            this.tileSize - 4,
            this.tileSize - 4
          );
        }
      }
    }

    const playerScreenX = this.player.x - this.camera.x;
    const playerScreenY = this.player.y - this.camera.y;
    ctx.fillStyle = "#f7d788";
    ctx.fillRect(
      playerScreenX,
      playerScreenY,
      this.player.width,
      this.player.height
    );
    ctx.fillStyle = "#5a3928";
    ctx.fillRect(
      playerScreenX + 2,
      playerScreenY + 2,
      this.player.width - 4,
      this.player.height - 4
    );
  }
}

(() => {
  "use strict";

  document.documentElement.classList.remove("no-js");

  const GAME_SCENE_ID = "game";
  const dom = {
    menu: document.querySelector("#main-menu"),
    game: document.querySelector("#game-scene"),
    canvas: document.querySelector("#game-canvas"),
  };

  if (!dom.menu || !dom.game || !dom.canvas) {
    return;
  }

  const context = dom.canvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = false;

  const input = new InputController();
  const sceneManager = new SceneManager();
  const gameScene = new GameScene({
    canvas: dom.canvas,
    context,
    input,
  });

  sceneManager.register(GAME_SCENE_ID, gameScene);

  const menuActions = dom.menu.querySelectorAll("[data-action]");
  menuActions.forEach((button) => {
    button.addEventListener("click", (event) => {
      const action = event.currentTarget.dataset.action;
      if (action === "start") {
        startGame();
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      startGame();
    }
  });

  let hasStarted = false;

  function setSceneActive(sceneEl, isActive) {
    if (!sceneEl) return;
    sceneEl.classList.toggle("is-active", isActive);
    sceneEl.setAttribute("aria-hidden", (!isActive).toString());
  }

  function startGame() {
    if (hasStarted) return;
    hasStarted = true;
    setSceneActive(dom.menu, false);
    setSceneActive(dom.game, true);
    sceneManager.change(GAME_SCENE_ID);
    sceneManager.start();
  }

  setSceneActive(dom.menu, true);
  setSceneActive(dom.game, false);
  fitCanvas(dom.canvas);
  window.addEventListener("resize", () => fitCanvas(dom.canvas));
})();
