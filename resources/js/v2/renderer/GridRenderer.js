export default class GridRenderer {
  constructor({ cellSize = 64 } = {}) {
    this.cellSize = cellSize;
    this._graphics = null;
    this._initialised = false;
    this._scene = null;
    this._lastState = null; // { x,y,width,height,zoom }
    this._bound = {};
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function' || !scene.events || typeof scene.events.on !== 'function') {
      throw new Error('GridRenderer.initialise requires a Phaser Scene with add.graphics() and events.on()');
    }

    this._scene = scene;
    const graphics = scene.add.graphics();
    this._graphics = graphics;

    // Bound update handler
    this._bound.onUpdate = () => {
      try {
        const cam = scene.cameras && scene.cameras.main;
        if (!cam) return;
        const vw = cam.worldView;
        if (!vw) return;

        const state = { x: vw.x, y: vw.y, width: vw.width, height: vw.height, zoom: cam.zoom };
        // Compare with last state to avoid unnecessary redraws
        if (this._lastState &&
          this._lastState.x === state.x &&
          this._lastState.y === state.y &&
          this._lastState.width === state.width &&
          this._lastState.height === state.height &&
          this._lastState.zoom === state.zoom) {
          return;
        }

        // Update last state
        this._lastState = state;

        // Clear and draw lines covering the visible world area
        try { if (typeof graphics.clear === 'function') graphics.clear(); } catch (e) {}

        const color = 0x666666;
        const alpha = 0.6;
        if (typeof graphics.lineStyle === 'function') graphics.lineStyle(1, color, alpha);

        const cs = this.cellSize;
        // Align first visible line to nearest lower multiple of cellSize
        const startX = Math.floor(vw.x / cs) * cs;
        const startY = Math.floor(vw.y / cs) * cs;
        // Draw through right and bottom bounds, with one extra cell to avoid gaps
        const endX = Math.ceil((vw.x + vw.width) / cs) * cs + cs;
        const endY = Math.ceil((vw.y + vw.height) / cs) * cs + cs;

        // Vertical lines
        for (let x = startX; x <= endX; x += cs) {
          if (typeof graphics.lineBetween === 'function') {
            graphics.lineBetween(x, startY, x, endY);
          }
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += cs) {
          if (typeof graphics.lineBetween === 'function') {
            graphics.lineBetween(startX, y, endX, y);
          }
        }
      } catch (e) {
        // ignore drawing errors
      }
    };

    // Register update listener
    try {
      scene.events.on('update', this._bound.onUpdate);
    } catch (e) {
      // ignore
    }

    this._initialised = true;
  }

  destroy() {
    if (this._scene && this._bound.onUpdate) {
      try { this._scene.events.off('update', this._bound.onUpdate); } catch (e) { /* ignore */ }
    }

    if (this._graphics) {
      try { if (typeof this._graphics.destroy === 'function') this._graphics.destroy(); } catch (e) { /* ignore */ }
      this._graphics = null;
    }

    this._initialised = false;
    this._scene = null;
    this._lastState = null;
    this._bound = {};
  }
}
