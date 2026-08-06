export default class App {
  constructor({ eventBus, renderer, gameEngine, uiManager, scenario } = {}) {
    this.eventBus = eventBus;
    this.renderer = renderer;
    this.gameEngine = gameEngine;
    this.uiManager = uiManager;
    this.scenario = scenario;
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
    this.initialise();
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
