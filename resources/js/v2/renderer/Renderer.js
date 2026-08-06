import GridRenderer from './GridRenderer.js';

export default class Renderer {
  constructor({ eventBus, mountId = 'closed-loop-v2-canvas' } = {}) {
    this.eventBus = eventBus;
    this.mountId = mountId;
    this.initialised = false;
    this._game = null;
    this._gridRenderer = null;
  }

  initialise() {
    // In Node/non-browser environments we must not attempt to import or instantiate Phaser.
    if (typeof document === 'undefined') return;

    if (this.initialised) return;

    const mountEl = document.getElementById(this.mountId);
    if (!mountEl) {
      throw new Error(`Renderer initialise failed: mount element #${this.mountId} not found`);
    }

    // Dynamically import Phaser so Node tests won't evaluate it at load time.
    // eslint-disable-next-line no-undef
    return import('phaser').then((PhaserModule) => {
      const Phaser = PhaserModule.default || PhaserModule;

      // create GridRenderer before Phaser game so the scene can initialise it in create()
      this._gridRenderer = new GridRenderer();
      const gridRenderer = this._gridRenderer;

      // Create a minimal blank scene that initialises the grid during its create() phase.
      const BlankScene = class extends Phaser.Scene {
        constructor() {
          super({ key: 'BlankScene' });
        }
        preload() {}
        create() {
          // Initialise the grid using the instance captured in closure
          if (typeof gridRenderer !== 'undefined' && gridRenderer && typeof gridRenderer.initialise === 'function') {
            gridRenderer.initialise(this);
          }
        }
        update() {}
      };

      // Use the mount element's current size for initial numeric width/height.
      const initialWidth = Math.max(1, Math.floor(mountEl.clientWidth || mountEl.offsetWidth || 800));
      const initialHeight = Math.max(1, Math.floor(mountEl.clientHeight || mountEl.offsetHeight || 600));

      const config = {
        type: Phaser.AUTO,
        parent: this.mountId,
        width: initialWidth,
        height: initialHeight,
        scene: [BlankScene],
        // Configure Phaser Scale Manager to use RESIZE so the canvas matches the parent size.
        scale: {
          parent: this.mountId,
          mode: Phaser.Scale.RESIZE
        }
      };

      // eslint-disable-next-line no-new
      this._game = new Phaser.Game(config);
      this.initialised = true;

      return this._game;
    });
  }

  render(frame) {
    if (!this.initialised) return;
    // Phaser manages its own render loop.
  }

  destroy() {
    // Destroy grid renderer (if any) before destroying the Phaser game
    if (this._gridRenderer) {
      try { this._gridRenderer.destroy(); } catch (e) { /* ignore */ }
      this._gridRenderer = null;
    }

    if (this._game && this._game.destroy) {
      try {
        this._game.destroy(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error destroying Phaser game', e);
      }
    }
    this._game = null;
    this.initialised = false;
  }
}
