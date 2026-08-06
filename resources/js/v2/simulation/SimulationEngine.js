export default class SimulationEngine {
  constructor({ eventBus, technologyEngine } = {}) {
    this.eventBus = eventBus;
    this.technologyEngine = technologyEngine;
    this.running = false;
  }

  initialise() {
    // Configure simulation state. No simulation logic here.
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
  }
}
