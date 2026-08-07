export default class InputController {
  constructor() {
    this._scene = null;
    this._input = null;
    this._bound = {};
    this._lastScreen = { x: 0, y: 0 };
    this._lastWorld = { x: 0, y: 0 };
    this._initialised = false;
    this._inside = false;
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.input || typeof scene.input.on !== 'function' || typeof scene.input.off !== 'function') {
      throw new Error('InputController.initialise requires a Phaser Scene with input.on/off');
    }

    this._scene = scene;
    this._input = scene.input;

    this._bound.onPointerMove = (pointer) => {
      try {
        const sx = pointer.x;
        const sy = pointer.y;
        this._lastScreen = { x: sx, y: sy };

        // Use the current active camera to convert screen -> world
        const cam = (this._scene.cameras && this._scene.cameras.main) ? this._scene.cameras.main : null;
        if (cam && typeof cam.getWorldPoint === 'function') {
          const c = (this._scene && this._scene.game && this._scene.game.canvas) ? this._scene.game.canvas : null;
          const rect = (c && c.getBoundingClientRect) ? c.getBoundingClientRect() : null;
          const w = rect ? cam.getWorldPoint(sx - rect.left, sy - rect.top) : cam.getWorldPoint(sx, sy);
          // Ensure shape
          this._lastWorld = { x: w.x, y: w.y };
            try {
              // determine inside by checking against the game canvas bounds as a robust fallback
              try {
                const c = (this._scene && this._scene.game && this._scene.game.canvas) ? this._scene.game.canvas : null;
                if (c && c.getBoundingClientRect) {
                  const r = c.getBoundingClientRect();
                  this._inside = sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom;
                }
              } catch (e) {}
            } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    };

    this._bound.onPointerOver = (pointer) => { this._inside = true; };
    this._bound.onPointerOut = (pointer) => { this._inside = false; };
    // Also support pointerenter/pointerleave if available in this Phaser build
    this._bound.onPointerEnter = (pointer) => { this._inside = true; };
    this._bound.onPointerLeave = (pointer) => { this._inside = false; };

    try {
      this._input.on('pointermove', this._bound.onPointerMove);
      // track enter/leave so other renderers can hide when pointer leaves canvas
      if (typeof this._input.on === 'function') {
        // keep pointerover/out for compatibility with existing tests
        try { this._input.on('pointerover', this._bound.onPointerOver); } catch (e) {}
        try { this._input.on('pointerout', this._bound.onPointerOut); } catch (e) {}
        // also register pointerenter/pointerleave if present in this Phaser build
        try { this._input.on('pointerenter', this._bound.onPointerEnter); } catch (e) {}
        try { this._input.on('pointerleave', this._bound.onPointerLeave); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }

    this._initialised = true;
  }

  getPointerScreen() {
    return { x: this._lastScreen.x, y: this._lastScreen.y };
  }

  getPointerWorld() {
    return { x: this._lastWorld.x, y: this._lastWorld.y };
  }

  isPointerInside() {
    return !!this._inside;
  }

  destroy() {
    if (this._input && this._bound.onPointerMove) {
      try { this._input.off('pointermove', this._bound.onPointerMove); } catch (e) { /* ignore */ }
    }
    if (this._input && this._bound.onPointerOver) {
      try { this._input.off('pointerover', this._bound.onPointerOver); } catch (e) { /* ignore */ }
    }
    if (this._input && this._bound.onPointerOut) {
      try { this._input.off('pointerout', this._bound.onPointerOut); } catch (e) { /* ignore */ }
    }

    this._scene = null;
    this._input = null;
    this._bound = {};
    this._initialised = false;
    this._lastScreen = { x: 0, y: 0 };
    this._lastWorld = { x: 0, y: 0 };
  }
}
