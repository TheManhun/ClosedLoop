export default class App {
  constructor({ eventBus, gameEngine, uiManager, scenario } = {}) {
    this.eventBus = eventBus;
    this.gameEngine = gameEngine;
    this.uiManager = uiManager;
    this.scenario = scenario;
    this.started = false;
  }

  initialise() {
    this.uiManager?.initialise();
    this.gameEngine?.initialise();
  }

  async start() {
    if (this.started) return;
    this.initialise();
    // Scenario is available on construction; Game start remains responsibility of GameEngine.
    this.gameEngine?.start();
    this.started = true;
  }

  destroy() {
    this.gameEngine?.destroy();
    this.uiManager?.destroy();
    this.started = false;
  }
}
