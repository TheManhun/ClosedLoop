export default class GameEngine {
  constructor({ eventBus, simulationEngine, technologyEngine } = {}) {
    if (!simulationEngine) throw new Error('GameEngine requires SimulationEngine');
    this.eventBus = eventBus;
    this.simulation = simulationEngine;
    this.technology = technologyEngine;
    this.initialised = false;
  }

  initialise() {
    this.initialised = true;
  }

  start() {
    if (!this.initialised) this.initialise();
    this.simulation.start();
    this.eventBus?.emit('game:started');
  }

  stop() {
    this.simulation.stop();
    this.eventBus?.emit('game:stopped');
  }

  destroy() {
    this.stop();
    this.initialised = false;
  }
}
