export default class ScenarioLoader {
  constructor({ dataLoader, eventBus, localScenarioStore = null } = {}) {
    if (!dataLoader) throw new Error('ScenarioLoader requires DataLoader');
    this.dataLoader = dataLoader;
    this.eventBus = eventBus;
    this.localScenarioStore = localScenarioStore;
  }

  initialise() {
    // No-op for now.
  }

  async load(id) {
    const scenario = await this.dataLoader.loadScenario(id);
    let runtimeScenario = scenario;

    if (this.localScenarioStore && typeof this.localScenarioStore.initialise === 'function') {
      await this.localScenarioStore.initialise({ templateId: id, canonicalScenario: scenario });
      runtimeScenario = this.localScenarioStore.getRuntimeScenario(scenario);
    }

    this.eventBus?.emit('scenario:loaded', runtimeScenario);
    return runtimeScenario;
  }

  destroy() {
    // Tear down listeners if any.
  }
}
