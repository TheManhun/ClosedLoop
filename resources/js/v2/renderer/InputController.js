export default class InputController {
  constructor() {
    this._scene = null;
    this._input = null;
    this._bound = {};
    this._lastScreen = { x: 0, y: 0 };
    this._lastWorld = { x: 0, y: 0 };
    this._initialised = false;
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
          const w = cam.getWorldPoint(sx, sy);
          // Ensure shape
          this._lastWorld = { x: w.x, y: w.y };
        }
      } catch (e) {
        // ignore
      }
    };

    try {
      this._input.on('pointermove', this._bound.onPointerMove);
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

  destroy() {
    if (this._input && this._bound.onPointerMove) {
      try { this._input.off('pointermove', this._bound.onPointerMove); } catch (e) { /* ignore */ }
    }

    this._scene = null;
    this._input = null;
    this._bound = {};
    this._initialised = false;
    this._lastScreen = { x: 0, y: 0 };
    this._lastWorld = { x: 0, y: 0 };
  }
}
