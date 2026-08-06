export default class DataLoader {
  constructor({ apiCoordinator } = {}) {
    if (!apiCoordinator) throw new Error('DataLoader requires ApiCoordinator');
    this.api = apiCoordinator;
  }

  initialise() {
    // Prepare caches or adapters if needed.
  }

  async loadScenario(id) {
    return this.api.fetchScenario(id);
  }

  destroy() {
    // Release any cached data.
  }
}
