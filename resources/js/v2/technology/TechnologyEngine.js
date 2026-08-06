export default class TechnologyEngine {
  constructor({ eventBus, dataLoader } = {}) {
    this.eventBus = eventBus;
    this.dataLoader = dataLoader;
    this.technologies = new Map();
  }

  initialise() {
    // Load technology data when required via DataLoader.
  }

  destroy() {
    this.technologies.clear();
  }
}
