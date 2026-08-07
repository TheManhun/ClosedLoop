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

    // Load resources via DataLoader here. Non-fatal: capture error for UI.
    if (this.dataLoader && typeof this.dataLoader.loadResources === 'function') {
      try {
        await this.dataLoader.loadResources();
        this._resourceLoadError = null;
      } catch (e) {
        this._resourceLoadError = e && e.message ? e.message : String(e);
      }
      try {
        if (this.uiManager && this.uiManager.statusProviders) {
          this.uiManager.statusProviders.resourceLoadError = this._resourceLoadError;
        }
      } catch (e) {
        // ignore
      }
    }

    // Now initialise UI and game engine.
    this.uiManager?.initialise();
    this.gameEngine?.initialise();
    // Load initial scenario (Stage 2): non-fatal, default to scenario id 2
    try {
      if (this.scenarioLoader && typeof this.scenarioLoader.load === 'function') {
        await this.scenarioLoader.load(2);
        this._scenarioLoadError = null;
      }
    } catch (e) {
      this._scenarioLoadError = e && e.message ? e.message : String(e);
    }
    try {
      if (this.uiManager && this.uiManager.statusProviders) {
        this.uiManager.statusProviders.scenarioLoadError = this._scenarioLoadError;
      }
    } catch (e) {
      // ignore
    }
    // Reinitialise UI to reflect scenario load status
    try {
      this.uiManager?.initialise();
    } catch (e) {
      // ignore
    }
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
