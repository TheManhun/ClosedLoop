export default class ApiCoordinator {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
  }

  initialise() {
    // Prepare any API related configuration here.
  }

  async fetchScenario(id) {
    // Centralised data access for V2. Implementation deferred.
    // Returns a minimal scenario object so bootstrap can proceed.
    return Promise.resolve({ id: id ?? 'default', name: 'Empty V2 Scenario' });
  }

  destroy() {
    // Clean up network resources if any.
  }
}
