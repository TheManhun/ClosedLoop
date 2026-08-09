export default class TechnologyEngine {
  constructor({ eventBus, dataLoader } = {}) {
    this.eventBus = eventBus;
    this.dataLoader = dataLoader;
    this.technologies = new Map();
  }

  initialise() {
    // Load technology data when required via DataLoader.
  }

  /**
   * Return machines that accept the given resourceId as an exact input.
   * Only strict exact-id matching is performed: a machine is compatible
   * when one of its `resources` entries has `direction === 'input'`
   * and `id === resourceId`.
   * Returns an array of machine objects (possibly empty).
   */
  getCompatibleMachinesForResource(resourceId) {
    if (!this.dataLoader || typeof this.dataLoader.getMachines !== 'function') return [];
    const machines = this.dataLoader.getMachines() || [];
    const rid = Number(resourceId);
    const matches = [];
    for (const m of machines) {
      if (!m || !Array.isArray(m.resources)) continue;
      const found = m.resources.some((r) => Number(r.id) === rid && String(r.direction) === 'input');
      if (found) matches.push(m);
    }
    return matches;
  }

  destroy() {
    this.technologies.clear();
  }
}
