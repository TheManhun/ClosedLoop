export default class Renderer {
  constructor({ eventBus, mountId = 'closed-loop-v2-canvas' } = {}) {
    this.eventBus = eventBus;
    this.mountId = mountId;
    this.initialised = false;
    this._game = null;
    this._phaserModule = null;
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
      this._phaserModule = Phaser;

      // Create a minimal blank scene
      const BlankScene = class extends Phaser.Scene {
        constructor() {
          super({ key: 'BlankScene' });
        }
        preload() {}
        create() {}
        update() {}
      };

      const config = {
        type: Phaser.AUTO,
        parent: this.mountId,
        width: '100%',
        height: '100%',
        scene: [BlankScene],
      };

      // eslint-disable-next-line no-new
      this._game = new Phaser.Game(config);
      this.initialised = true;
      return this._game;
    });
  }

  render(frame) {
    // Renderer is responsible only for visual rendering. No simulation logic here.
    if (!this.initialised) return;
    // Phaser manages its own render loop.
  }

  destroy() {
    if (this._game && this._game.destroy) {
      try {
        this._game.destroy(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error destroying Phaser game', e);
      }
    }
    this._game = null;
    this._phaserModule = null;
    this.initialised = false;
  }
}
