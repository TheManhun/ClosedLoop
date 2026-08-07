export default class GridHighlightRenderer {
  constructor({ cellSize = 64, color = 0xffff00, alpha = 0.25 } = {}) {
    this.cellSize = cellSize;
    this._scene = null;
    this._graphics = null;
    this._initialised = false;
    this._bound = {};
    this._lastCell = null; // { x,y }
    this._color = color;
    this._alpha = alpha;
    this._input = null;
  }

  initialise(scene, inputController) {
    if (this._initialised) return;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function' || !scene.events || typeof scene.events.on !== 'function') {
      throw new Error('GridHighlightRenderer.initialise requires a Phaser Scene with add.graphics() and events.on()');
    }

    this._scene = scene;
    this._input = inputController;
    this._graphics = scene.add.graphics();

    // initialise without diagnostic logging

    this._bound.onUpdate = () => {
      try {
        if (!this._firstUpdateDone) {
          this._firstUpdateDone = true;
        }
        if (!this._input || typeof this._input.isPointerInside !== 'function') return;

        if (!this._input.isPointerInside()) {
          // hide
          try { if (typeof this._graphics.clear === 'function') this._graphics.clear(); } catch (e) {}
          this._lastCell = null;
          return;
        }

        const wp = this._input.getPointerWorld();
        if (!wp) return;
        const cellX = Math.floor(wp.x / this.cellSize) * this.cellSize;
        const cellY = Math.floor(wp.y / this.cellSize) * this.cellSize;

        if (this._lastCell && this._lastCell.x === cellX && this._lastCell.y === cellY) return;

        this._lastCell = { x: cellX, y: cellY };

        // drawing cell (no diagnostic log)
        try { if (typeof this._graphics.clear === 'function') this._graphics.clear(); } catch (e) {}
        if (typeof this._graphics.fillStyle === 'function') this._graphics.fillStyle(this._color, this._alpha);
        if (typeof this._graphics.fillRect === 'function') {
          this._graphics.fillRect(cellX, cellY, this.cellSize, this.cellSize);
        } else if (typeof this._graphics.fillRoundedRect === 'function') {
          this._graphics.fillRoundedRect(cellX, cellY, this.cellSize, this.cellSize, 4);
        }
      } catch (e) {
        // ignore drawing errors
      }
    };

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
    this._lastCell = null;
    this._bound = {};
    this._input = null;
  }
}
