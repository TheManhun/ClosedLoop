export default class App {
  constructor({ eventBus, renderer, gameEngine, uiManager, scenario, scenarioLoader, dataLoader } = {}) {
    this.eventBus = eventBus;
    this.renderer = renderer;
    this.gameEngine = gameEngine;
    this.uiManager = uiManager;
    this.scenario = scenario;
    this.scenarioLoader = scenarioLoader;
    this.dataLoader = dataLoader;
    this._machineLoadError = null;
    this.started = false;
  }

  initialise() {
    // Initialise independent subsystems in the documented order: renderer, UI, then game initialisation.
    this.renderer?.initialise();
    this.uiManager?.initialise();
    this.gameEngine?.initialise();
  }

  async start() {
    if (this.started) return;
    // Initialise renderer first so the canvas exists for scene initialisation.
    try {
      this.renderer?.initialise();
    } catch (e) {
      // swallow so UI can show error
      // eslint-disable-next-line no-console
      console.error('Renderer initialise error', e);
    }

    // Load machines via DataLoader here. Non-fatal: capture error for UI.
    if (this.dataLoader && typeof this.dataLoader.loadMachines === 'function') {
      try {
        await this.dataLoader.loadMachines();
        this._machineLoadError = null;
      } catch (e) {
        this._machineLoadError = e && e.message ? e.message : String(e);
      }
      // Surface machine load error to UI via statusProviders on the uiManager if available.
      try {
        if (this.uiManager && this.uiManager.statusProviders) {
          this.uiManager.statusProviders.machineLoadError = this._machineLoadError;
        }
      } catch (e) {
        // ignore
      }
    }

    // Now initialise UI and game engine.
    this.uiManager?.initialise();
    this.gameEngine?.initialise();
    // Game start remains responsibility of GameEngine.
    this.gameEngine?.start();
    this.started = true;
  }

  destroy() {
    // Reverse lifecycle: stop/destroy game, then UI, then renderer.
    try {
      this.gameEngine?.destroy();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error destroying gameEngine', e);
    }
    try {
      this.uiManager?.destroy();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error destroying uiManager', e);
    }
    try {
      this.renderer?.destroy();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error destroying renderer', e);
    }
    this.started = false;
  }
}
