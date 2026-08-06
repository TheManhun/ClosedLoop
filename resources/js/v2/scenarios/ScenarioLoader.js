export default class ScenarioLoader {
  constructor({ dataLoader, eventBus } = {}) {
    if (!dataLoader) throw new Error('ScenarioLoader requires DataLoader');
    this.dataLoader = dataLoader;
    this.eventBus = eventBus;
  }

  initialise() {
    // No-op for now.
  }

  async load(id) {
    const scenario = await this.dataLoader.loadScenario(id);
    this.eventBus?.emit('scenario:loaded', scenario);
    return scenario;
  }

  destroy() {
    // Tear down listeners if any.
  }
}
