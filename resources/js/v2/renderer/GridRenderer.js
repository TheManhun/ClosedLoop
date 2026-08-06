export default class GridRenderer {
  constructor({ cellSize = 64, width = 4096, height = 4096 } = {}) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this._graphics = null;
    this._initialised = false;
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') {
      throw new Error('GridRenderer.initialise requires a Phaser Scene with add.graphics()');
    }

    // Use the Phaser Graphics API: lineStyle + lineBetween.
    // Increase alpha/contrast for visibility against dark canvas backgrounds.
    const graphics = scene.add.graphics();
    const color = 0x666666;
    const alpha = 0.6;
    graphics.lineStyle(1, color, alpha);

    // draw vertical lines at x = 0..width
    for (let x = 0; x <= this.width; x += this.cellSize) {
      graphics.lineBetween(x, 0, x, this.height);
    }

    // draw horizontal lines at y = 0..height
    for (let y = 0; y <= this.height; y += this.cellSize) {
      graphics.lineBetween(0, y, this.width, y);
    }

    this._graphics = graphics;
    this._initialised = true;
    // No diagnostics; keep drawing only.
  }

  destroy() {
    if (this._graphics) {
      try {
        if (typeof this._graphics.destroy === 'function') this._graphics.destroy();
      } catch (e) {
        // ignore
      }
      this._graphics = null;
    }
    this._initialised = false;
  }
}
