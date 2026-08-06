export default class Renderer {
  constructor({ eventBus, mountId = 'closed-loop-v2-canvas' } = {}) {
    this.eventBus = eventBus;
    this.mountId = mountId;
    this.initialised = false;
    this._game = null;
    this._resizeObserver = null;
    this._windowResizeHandler = null;
    this._rafId = null;
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

      // Create a minimal blank scene
      const BlankScene = class extends Phaser.Scene {
        constructor() {
          super({ key: 'BlankScene' });
        }
        preload() {}
        create() {}
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

      // Helper that routes all resize requests through Phaser Scale Manager as the sole authority.
      this._applyResize = (width, height) => {
        if (!this._game) return;
        const scale = this._game.scale;
        if (!scale || typeof scale.setParentSize !== 'function') {
          // Fail loudly in development if Phaser Scale Manager API is missing.
          throw new Error('Phaser Scale Manager API `setParentSize(width,height)` is not available.');
        }

        // setParentSize will update parentSize and call refresh(), emitting RESIZE.
        scale.setParentSize(width, height);
      };

      // Resize helper: coalesce notifications via RAF and route to Phaser Scale Manager.
      const scheduleResize = () => {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(() => {
          this._rafId = null;
          const w = Math.max(1, Math.floor(mountEl.clientWidth));
          const h = Math.max(1, Math.floor(mountEl.clientHeight));
          this._applyResize(w, h);
        });
      };

      // ResizeObserver to detect container size changes.
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(scheduleResize);
        this._resizeObserver.observe(mountEl);
      } else {
        // Fallback: listen to window resize and coalesce. Phaser's Scale Manager already listens
        // to window resize internally, but when ResizeObserver is unavailable we proactively
        // notify Phaser of parent size changes via setParentSize so behavior is consistent.
        this._windowResizeHandler = scheduleResize;
        window.addEventListener('resize', this._windowResizeHandler);
      }

      return this._game;
    });
  }

  render(frame) {
    // Renderer is responsible only for visual rendering. No simulation logic here.
    if (!this.initialised) return;
    // Phaser manages its own render loop.
  }

  destroy() {
    // Disconnect observer/handlers first to avoid resize callbacks during destroy.
    try {
      if (this._resizeObserver) {
        try { this._resizeObserver.disconnect(); } catch (e) { /* ignore */ }
        this._resizeObserver = null;
      }
      if (this._windowResizeHandler) {
        try { window.removeEventListener('resize', this._windowResizeHandler); } catch (e) { /* ignore */ }
        this._windowResizeHandler = null;
      }
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error cleaning resize handlers', e);
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
