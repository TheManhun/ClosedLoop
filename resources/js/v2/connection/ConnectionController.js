export default class ConnectionController {
  constructor({ eventBus, scenario = null } = {}) {
    this.eventBus = eventBus || null;
    this._scenario = scenario || null;
    this._initialised = false;
    this._bound = {};
    this._active = false;
    this._source_object_id = null;
    this._resource_id = null;
    this._compatibility = [];
    this._target_object_id = null;
    this._placementModeActive = false;
  }

  initialise() {
    if (this._initialised) return;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onScenarioLoaded = (payload) => this.setScenario(payload);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);

      this._bound.onConnectionBegin = (payload) => this.beginConnection(payload);
      this.eventBus.on('connection:begin', this._bound.onConnectionBegin);

      this._bound.onPlacementModeChanged = (payload) => {
        const active = !!(payload && payload.active);
        this._placementModeActive = active;
        if (active && this._active) {
          this.cancel();
        }
      };
      this.eventBus.on('placement:mode:changed', this._bound.onPlacementModeChanged);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._bound.onKeydown = (event) => {
        const key = event && (event.key || event.code);
        if (key === 'Escape' || key === 'Esc' || event?.code === 'Escape') {
          this.cancel();
        }
      };
      window.addEventListener('keydown', this._bound.onKeydown);
    }

    this._initialised = true;
  }

  setScenario(scenario) {
    this._scenario = scenario || null;
    if (this._active) {
      this._recalculateCompatibility();
    }
    return this._scenario;
  }

  isActive() {
    return !!this._active;
  }

  getState() {
    return {
      active: !!this._active,
      source_object_id: this._source_object_id,
      resource_id: this._resource_id,
      target_object_id: this._target_object_id,
      compatible_target_ids: this.getCompatibleTargetIds(),
      placement_mode_active: !!this._placementModeActive,
    };
  }

  getCompatibleTargetIds() {
    return Array.isArray(this._compatibility) ? this._compatibility.slice() : [];
  }

  _deriveResourceId(resourceLike) {
    if (resourceLike == null) return null;
    if (typeof resourceLike === 'number' || typeof resourceLike === 'string') {
      const value = Number(resourceLike);
      return Number.isFinite(value) ? value : null;
    }
    const candidates = [
      resourceLike.id,
      resourceLike.resource_id,
      resourceLike.resourceId,
      resourceLike.resource && resourceLike.resource.id,
      resourceLike.resource && resourceLike.resource.resource_id,
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
    return null;
  }

  _asScenarioObjects() {
    const scenario = this._scenario || null;
    return Array.isArray(scenario && scenario.scenario_objects) ? scenario.scenario_objects : [];
  }

  _findScenarioObject(objectId, scenario = this._scenario) {
    const targetId = Number(objectId);
    if (!Number.isFinite(targetId)) return null;
    const list = Array.isArray(scenario && scenario.scenario_objects) ? scenario.scenario_objects : this._asScenarioObjects();
    return list.find((obj) => Number(obj && obj.id) === targetId) || null;
  }

  _machineResources(machine) {
    if (!machine || !Array.isArray(machine.resources)) return [];
    return machine.resources;
  }

  _machineHasOutputForResource(machine, resourceId) {
    if (!machine) return false;
    return this._machineResources(machine).some((entry) => {
      const matchId = this._deriveResourceId(entry);
      const direction = String(entry && (entry.direction || entry.type || '')).toLowerCase();
      return Number.isFinite(Number(matchId)) && Number(matchId) === Number(resourceId) && direction === 'output';
    });
  }

  _machineHasInputForResource(machine, resourceId) {
    if (!machine) return false;
    return this._machineResources(machine).some((entry) => {
      const matchId = this._deriveResourceId(entry);
      const direction = String(entry && (entry.direction || entry.type || '')).toLowerCase();
      return Number.isFinite(Number(matchId)) && Number(matchId) === Number(resourceId) && direction === 'input';
    });
  }

  _recalculateCompatibility() {
    if (!this._active || this._source_object_id == null || this._resource_id == null) {
      this._compatibility = [];
      this._target_object_id = null;
      return;
    }

    const source = this._findScenarioObject(this._source_object_id, this._scenario);
    if (!source) {
      this._compatibility = [];
      this._target_object_id = null;
      return;
    }

    const sourceMachine = source.machine || null;
    if (!this._machineHasOutputForResource(sourceMachine, this._resource_id)) {
      this._compatibility = [];
      this._target_object_id = null;
      return;
    }

    const matches = [];
    for (const candidate of this._asScenarioObjects()) {
      if (!candidate || Number(candidate.id) === Number(this._source_object_id)) continue;
      const candidateMachine = candidate.machine || null;
      if (!candidateMachine) continue;
      if (!this._machineHasInputForResource(candidateMachine, this._resource_id)) continue;
      matches.push(Number(candidate.id));
    }

    this._compatibility = matches;
    if (this._target_object_id != null && !matches.includes(Number(this._target_object_id))) {
      this._target_object_id = null;
    }

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('connection:compatibility:changed', {
        active: true,
        source_object_id: this._source_object_id,
        resource_id: this._resource_id,
        compatible_target_ids: this._compatibility.slice(),
      });
    }
  }

  beginConnection(payload = {}) {
    if (this._placementModeActive) {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('connection:blocked', {
          reason: 'placement-mode-active',
          source_object_id: payload && payload.source_object_id != null ? Number(payload.source_object_id) : null,
          resource_id: Number(payload && payload.resource_id),
        });
      }
      return false;
    }

    const scenario = payload && payload.scenario ? payload.scenario : this._scenario;
    const sourceObjectId = payload && payload.source_object_id != null ? Number(payload.source_object_id) : null;
    const resourceId = this._deriveResourceId(payload && payload.resource_id != null ? payload.resource_id : (payload && payload.resource ? payload.resource : null));

    if (!Number.isFinite(sourceObjectId) || !Number.isFinite(resourceId)) {
      return false;
    }

    const source = this._findScenarioObject(sourceObjectId, scenario || this._scenario);
    if (!source) {
      return false;
    }

    this._scenario = scenario || this._scenario;
    this._active = true;
    this._source_object_id = Number(source.id);
    this._resource_id = Number(resourceId);
    this._target_object_id = null;
    this._recalculateCompatibility();

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('connection:mode:changed', {
        active: true,
        source_object_id: this._source_object_id,
        resource_id: this._resource_id,
        compatible_target_ids: this._compatibility.slice(),
      });
      this.eventBus.emit('connection:highlight:changed', {
        active: true,
        source_object_id: this._source_object_id,
        compatible_target_ids: this._compatibility.slice(),
      });
    }

    return true;
  }

  confirmTarget(targetObjectId) {
    if (!this._active) return false;
    const targetId = Number(targetObjectId);
    if (!Number.isFinite(targetId)) return false;
    if (Number(targetId) === Number(this._source_object_id)) return false;
    if (!this._compatibility.includes(targetId)) return false;

    this._target_object_id = targetId;

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('connection:target:selected', {
        active: true,
        source_object_id: this._source_object_id,
        resource_id: this._resource_id,
        target_object_id: targetId,
      });
    }

    return true;
  }

  cancel() {
    if (!this._active && this._source_object_id == null && this._resource_id == null && this._target_object_id == null && (!Array.isArray(this._compatibility) || this._compatibility.length === 0)) {
      return false;
    }

    this._active = false;
    this._source_object_id = null;
    this._resource_id = null;
    this._target_object_id = null;
    this._compatibility = [];

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('connection:mode:changed', {
        active: false,
        source_object_id: null,
        resource_id: null,
        compatible_target_ids: [],
      });
      this.eventBus.emit('connection:highlight:changed', {
        active: false,
        source_object_id: null,
        compatible_target_ids: [],
      });
    }

    return true;
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function') {
      if (this._bound.onScenarioLoaded) this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded);
      if (this._bound.onConnectionBegin) this.eventBus.off('connection:begin', this._bound.onConnectionBegin);
      if (this._bound.onPlacementModeChanged) this.eventBus.off('placement:mode:changed', this._bound.onPlacementModeChanged);
    }

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this._bound.onKeydown) {
      window.removeEventListener('keydown', this._bound.onKeydown);
    }

    this._scenario = null;
    this._initialised = false;
    this._bound = {};
    this._active = false;
    this._source_object_id = null;
    this._resource_id = null;
    this._compatibility = [];
    this._target_object_id = null;
    this._placementModeActive = false;
  }
}
