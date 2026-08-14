export default class DataLoader {
  constructor({ apiCoordinator } = {}) {
    if (!apiCoordinator) throw new Error('DataLoader requires ApiCoordinator');
    this.api = apiCoordinator;
  }

  initialise() {
    // Prepare caches or adapters if needed.
  }

  _normalizeScenarioObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const machine = obj.machine || {};
    const footprintX = Number(machine.footprint_x ?? machine.footprintX ?? obj.footprint_x ?? obj.footprintX ?? 1) || 1;
    const footprintY = Number(machine.footprint_y ?? machine.footprintY ?? obj.footprint_y ?? obj.footprintY ?? 1) || 1;

    const explicitGridX = Number(obj.grid_x ?? obj.gridX ?? Number.NaN);
    const explicitGridY = Number(obj.grid_y ?? obj.gridY ?? Number.NaN);
    const legacyX = Number(obj.position_x ?? obj.positionX ?? obj.x ?? 0);
    const legacyY = Number(obj.position_y ?? obj.positionY ?? obj.y ?? 0);
    const cellSize = 64;

    const gridX = Number.isFinite(explicitGridX) ? explicitGridX : Math.floor((legacyX - ((footprintX * cellSize) / 2)) / cellSize);
    const gridY = Number.isFinite(explicitGridY) ? explicitGridY : Math.floor((legacyY - ((footprintY * cellSize) / 2)) / cellSize);

    return {
      ...obj,
      grid_x: gridX,
      grid_y: gridY,
      position_x: legacyX,
      position_y: legacyY,
    };
  }

  async loadScenario(id) {
    const res = await this.api.fetchScenario(id);
    // Expect a single scenario object. Store canonical scenarios in a map.
    this._scenarios = this._scenarios || {};
    // Defensive: if API returned an array, take first
    const scenario = Array.isArray(res) ? (res[0] || null) : res;
    if (!scenario) throw new Error('DataLoader.loadScenario: unexpected empty response');

    if (Array.isArray(scenario.scenario_objects)) {
      scenario.scenario_objects = scenario.scenario_objects.map((obj) => this._normalizeScenarioObject(obj));
    }

    // Link scenario_resources to canonical resources where possible
    if (Array.isArray(scenario.scenario_resources)) {
      scenario.scenario_resources = scenario.scenario_resources.map((sr) => {
        const copy = Object.assign({}, sr);
        // resource may be embedded under `resource`
        const embedded = sr.resource || sr.resources || null;
        if (embedded) copy.resource = embedded;
        // Attempt to resolve canonical resource by id
        const canonical = this.getResourceById(sr.resource_id);
        if (canonical) copy.resource_canonical = canonical;
        return copy;
      });
    }

    this._scenarios[Number(scenario.id)] = scenario;
    return scenario;
  }

  getScenarioById(id) {
    if (!this._scenarios) return null;
    return this._scenarios[Number(id)] || null;
  }

  /**
   * Load machines from ApiCoordinator and keep them in-memory.
   * Returns the stored machines array.
   */
  async loadMachines() {
    const res = await this.api.fetchMachines();
    // Preserve API shape where practical. Accept either an array or an
    // envelope with `value` (existing backend returns { value: [...], Count }).
    let list = [];
    if (Array.isArray(res)) list = res;
    else if (res && Array.isArray(res.value)) list = res.value;
    else throw new Error('DataLoader.loadMachines: unexpected response shape');
    this._machines = list;
    return this._machines;
  }

  /**
   * Load resources from ApiCoordinator and keep them in-memory.
   * The backend returns a top-level array of resources. If the response is not an array,
   * this method throws a descriptive error.
   */
  async loadResources() {
    const res = await this.api.fetchResources();
    if (!Array.isArray(res)) {
      throw new Error('DataLoader.loadResources: expected array response from API');
    }
    this._resources = res.slice();
    return this._resources;
  }

  getResources() {
    return (this._resources || []).slice();
  }

  getResourceById(id) {
    return (this._resources || []).find((r) => Number(r.id) === Number(id)) || null;
  }

  getMachines() {
    return (this._machines || []).slice();
  }

  getMachineById(id) {
    return (this._machines || []).find((m) => Number(m.id) === Number(id)) || null;
  }

  destroy() {
    // Release any cached data.
  }
}
