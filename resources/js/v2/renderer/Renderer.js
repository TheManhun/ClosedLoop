import GridRenderer from './GridRenderer.js';
import CameraController from './CameraController.js';
import GridHighlightRenderer from './GridHighlightRenderer.js';
import InputController from './InputController.js';
import StockpileRenderer from './StockpileRenderer.js';
import ScenarioObjectRenderer from './ScenarioObjectRenderer.js';
import ScenarioMapRenderer from './ScenarioMapRenderer.js';
import SelectionController from '../selection/SelectionController.js';
import PlacementController from '../placement/PlacementController.js';

export default class Renderer {
  constructor({ eventBus, mountId = 'closed-loop-v2-canvas' } = {}) {
    this.eventBus = eventBus;
    this.mountId = mountId;
    this.initialised = false;
    this._game = null;
    this._gridRenderer = null;
    this._placementController = new PlacementController({ eventBus, cellSize: 64 });
  }

  _initialisePlacementController(scene, inputController) {
    const placementController = this._placementController;
    if (!placementController || typeof placementController.initialise !== 'function') return;
    if (typeof placementController.isInitialised === 'function' && placementController.isInitialised()) return;
    placementController.initialise(scene, inputController);
  }

  initialise() {
    // In Node/non-browser environments we must not attempt to import or instantiate Phaser.
    if (typeof document === 'undefined') return;

    if (this.initialised) return;

    const mountEl = document.getElementById(this.mountId);
    if (!mountEl) {
      throw new Error(`Renderer initialise failed: mount element #${this.mountId} not found`);
      this._gridHighlight = new GridHighlightRenderer();
    }

    // Ensure grid highlight renderer instance exists before Phaser scene captures it.
    // Create it here so BlankScene.create() can call initialise on the instance.
    this._gridHighlight = this._gridHighlight || new GridHighlightRenderer();

    // Dynamically import Phaser so Node tests won't evaluate it at load time.
    // eslint-disable-next-line no-undef
    const gridHighlight = this._gridHighlight;
    return import('phaser').then((PhaserModule) => {
      const Phaser = PhaserModule.default || PhaserModule;

      // create CameraController, GridRenderer and InputController before Phaser game so the scene can initialise them in create()
      this._camera = new CameraController();
      this._gridRenderer = new GridRenderer();
      this._inputController = new InputController();
      const camera = this._camera;
      const gridRenderer = this._gridRenderer;
      const inputController = this._inputController;
      const placementController = this._placementController;

      const stockpileRenderer = new StockpileRenderer({ eventBus: this.eventBus, cellSize: gridRenderer.cellSize || 64 });
      this._stockpileRenderer = stockpileRenderer;
      const selectionController = new SelectionController({ eventBus: this.eventBus });
      this._selectionController = selectionController;
      const scenarioObjectRenderer = new ScenarioObjectRenderer({ eventBus: this.eventBus, cellSize: gridRenderer.cellSize || 64 });
      this._scenarioObjectRenderer = scenarioObjectRenderer;
      const scenarioMapRenderer = new ScenarioMapRenderer({ eventBus: this.eventBus, cellSize: gridRenderer.cellSize || 64 });
      this._scenarioMapRenderer = scenarioMapRenderer;
      // production: do not expose internals to window

      // Create a minimal blank scene that initialises the grid during its create() phase.
      const BlankScene = class extends Phaser.Scene {
        constructor() {
          super({ key: 'BlankScene' });
        }
        preload() {}
        create() {
          // Initialise camera and grid using instances captured in closure
          try {
            if (typeof camera !== 'undefined' && camera && typeof camera.initialise === 'function') {
              camera.initialise(this);
            }
          if (typeof gridHighlight !== 'undefined' && gridHighlight && typeof gridHighlight.initialise === 'function') {
            gridHighlight.initialise(this, inputController);
          }
          } catch (e) {
            // ignore
          }

          if (typeof scenarioMapRenderer !== 'undefined' && scenarioMapRenderer && typeof scenarioMapRenderer.initialise === 'function') {
            try { scenarioMapRenderer.initialise(this); } catch (e) { /* ignore */ }
          }
          if (typeof gridRenderer !== 'undefined' && gridRenderer && typeof gridRenderer.initialise === 'function') {
            gridRenderer.initialise(this);
          }
          if (typeof stockpileRenderer !== 'undefined' && stockpileRenderer && typeof stockpileRenderer.initialise === 'function') {
            // keep a reference on the renderer instance so destroy() can clean up
            try { stockpileRenderer.initialise(this); } catch (e) { /* ignore */ }
          }
          if (typeof selectionController !== 'undefined' && selectionController && typeof selectionController.initialise === 'function') {
            try { selectionController.initialise(this, inputController); } catch (e) { /* ignore */ }
          }
          if (typeof scenarioObjectRenderer !== 'undefined' && scenarioObjectRenderer && typeof scenarioObjectRenderer.initialise === 'function') {
            try { scenarioObjectRenderer.initialise(this); } catch (e) { /* ignore */ }
          }
          if (typeof inputController !== 'undefined' && inputController && typeof inputController.initialise === 'function') {
            inputController.initialise(this);
          }
          if (placementController && typeof placementController.initialise === 'function') {
            try { placementController.initialise(this, inputController); } catch (e) { /* ignore */ }
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
    // Destroy grid highlight renderer first
    if (this._gridHighlight) {
      try { this._gridHighlight.destroy(); } catch (e) { /* ignore */ }
      this._gridHighlight = null;
    }

    // Destroy grid renderer (if any) before destroying the Phaser game
    if (this._gridRenderer) {
      try { this._gridRenderer.destroy(); } catch (e) { /* ignore */ }
      this._gridRenderer = null;
    }

    // Destroy input controller before destroying Phaser so it can unbind listeners
    if (this._inputController) {
      try { this._inputController.destroy(); } catch (e) { /* ignore */ }
      this._inputController = null;
    }

    if (this._placementController) {
      try { this._placementController.destroy(); } catch (e) { /* ignore */ }
      this._placementController = null;
    }

    // Destroy stockpile renderer if present
    if (this._stockpileRenderer) {
      try { this._stockpileRenderer.destroy(); } catch (e) { /* ignore */ }
      this._stockpileRenderer = null;
    }

    if (this._scenarioObjectRenderer) {
      try { this._scenarioObjectRenderer.destroy(); } catch (e) { /* ignore */ }
      this._scenarioObjectRenderer = null;
    }

    // Destroy camera controller before destroying Phaser so it can unbind any references
    if (this._camera) {
      try { this._camera.destroy(); } catch (e) { /* ignore */ }
      this._camera = null;
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
