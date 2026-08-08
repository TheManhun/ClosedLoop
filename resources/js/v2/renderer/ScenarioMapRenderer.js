import { uiImage } from './AssetPaths.js';

export default class ScenarioMapRenderer {
  constructor({ eventBus, cellSize = 64 } = {}) {
    this.eventBus = eventBus;
    this.cellSize = cellSize;
    this._scene = null;
    this._initialised = false;
    this._bound = {};
    this._mapSprite = null; // Phaser Image
    this._texKeyPrefix = 'scenario_map_img_';
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add || !scene.events) throw new Error('ScenarioMapRenderer.initialise requires a Phaser Scene');
    this._scene = scene;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onScenarioLoaded = (scenario) => this._onScenarioLoaded(scenario);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);
    }

    this._initialised = true;
  }

  _onScenarioLoaded(scenario) {
    try {
      // remove previous map if any
      this._clearMap();

      // For simulator ground, always use generic UI background image.
      const filename = 'background.png';
      const url = uiImage(filename) || `/images/ui/${filename}`;
      const texKey = `sim_background`;

      const textureExists = (this._scene.textures && typeof this._scene.textures.exists === 'function') ? this._scene.textures.exists(texKey) : false;

      const createAndPlace = () => {
        try {
          // Prefer tileSprite for repeating background when available
          let bg = null;
          if (this._scene.add && typeof this._scene.add.tileSprite === 'function') {
            try {
              const targetW = Math.max(1600, this.cellSize * 20);
              const targetH = Math.max(1200, this.cellSize * 15);
              bg = this._scene.add.tileSprite(0, 0, targetW, targetH, texKey);
              if (typeof bg.setOrigin === 'function') bg.setOrigin(0.5, 0.5);
            } catch (e) { bg = null; }
          }
          if (!bg) {
            // fallback to single image when tileSprite is not available
            bg = this._scene.add.image(0, 0, texKey);
            if (typeof bg.setOrigin === 'function') bg.setOrigin(0.5, 0.5);
            // scale to reasonable size
            try {
              const iw = bg.width || (bg.texture && bg.texture.source && bg.texture.source[0] && bg.texture.source[0].width) || null;
              if (iw) {
                const targetWidth = Math.max(800, this.cellSize * 12);
                const scale = Math.max(0.0001, Math.min(10, targetWidth / iw));
                if (typeof bg.setScale === 'function') bg.setScale(scale);
                else if (typeof bg.setDisplaySize === 'function') bg.setDisplaySize(Math.round(iw * scale), Math.round((bg.height || 0) * scale));
              }
            } catch (e) {}
          }

          if (bg && typeof bg.setDepth === 'function') bg.setDepth(-20);
          if (bg && typeof bg.setAlpha === 'function') bg.setAlpha(0.5);

          this._mapSprite = bg;
        } catch (e) {
          // swallow
        }
      };

      if (!textureExists && this._scene.load && typeof this._scene.load.image === 'function') {
        try {
          this._scene.load.image(texKey, url);
          this._scene.load.once('complete', () => {
            try { createAndPlace(); } catch (e) {}
          });
          this._scene.load.start();
        } catch (e) {
          // fallback: create without texture
          createAndPlace();
        }
      } else {
        createAndPlace();
      }
    } catch (e) {
      // swallow
    }
  }

  _clearMap() {
    if (this._mapSprite) {
      try { if (typeof this._mapSprite.destroy === 'function') this._mapSprite.destroy(); } catch (e) {}
      this._mapSprite = null;
    }
  }

  destroy() {
    try { if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onScenarioLoaded) this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded); } catch (e) {}
    this._clearMap();
    this._scene = null;
    this._initialised = false;
  }
}
