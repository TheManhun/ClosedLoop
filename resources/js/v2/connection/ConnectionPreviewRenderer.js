export default class ConnectionPreviewRenderer {
  constructor({ eventBus = null, cellSize = 64 } = {}) {
    this.eventBus = eventBus;
    this.cellSize = Number.isFinite(Number(cellSize)) ? Number(cellSize) : 64;
    this._initialised = false;
    this._bound = {};
    this._scene = null;
    this._input = null;
    this._graphics = null;
    this._scenario = null;
    this._active = false;
    this._state = {
      active: false,
      source_object_id: null,
      resource_id: null,
      target_object_id: null,
      compatible_target_ids: [],
      transport_class: null,
    };
    this._pointerWorld = { x: 0, y: 0 };
  }

  initialise(scene, inputController = null) {
    if (this._initialised) return;
    if (!scene || !scene.add) {
      throw new Error('ConnectionPreviewRenderer.initialise requires a Phaser Scene');
    }

    this._scene = scene;
    this._input = inputController || null;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onConnectionModeChanged = (payload) => this._onConnectionModeChanged(payload);
      this.eventBus.on('connection:mode:changed', this._bound.onConnectionModeChanged);

      this._bound.onScenarioLoaded = (scenario) => this._setScenario(scenario);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);

      this._bound.onPlacementModeChanged = (payload) => {
        if (payload && payload.active) this.clear();
      };
      this.eventBus.on('placement:mode:changed', this._bound.onPlacementModeChanged);
    }

    this._initialised = true;
    this._ensureGraphics();
    this.update();
  }

  _setScenario(scenario) {
    this._scenario = scenario || null;
    this.update();
  }

  _onConnectionModeChanged(payload = {}) {
    const active = !!(payload && payload.active);
    this._active = active;
    this._state = {
      active,
      source_object_id: payload && payload.source_object_id != null ? Number(payload.source_object_id) : null,
      resource_id: payload && payload.resource_id != null ? Number(payload.resource_id) : null,
      target_object_id: payload && payload.target_object_id != null ? Number(payload.target_object_id) : null,
      compatible_target_ids: Array.isArray(payload && payload.compatible_target_ids) ? payload.compatible_target_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [],
      transport_class: payload && payload.transport_class ? String(payload.transport_class) : (payload && payload.resource && payload.resource.transport_class ? String(payload.resource.transport_class) : null),
      source_port: payload && payload.source_port && Number.isFinite(Number(payload.source_port.x)) && Number.isFinite(Number(payload.source_port.y)) ? { x: Number(payload.source_port.x), y: Number(payload.source_port.y) } : null,
      target_port: payload && payload.target_port && Number.isFinite(Number(payload.target_port.x)) && Number.isFinite(Number(payload.target_port.y)) ? { x: Number(payload.target_port.x), y: Number(payload.target_port.y) } : null,
    };

    if (!this._active) {
      this.clear();
      return;
    }

    this.update();
  }

  _findScenarioObject(objectId, scenario = this._scenario) {
    const targetId = Number(objectId);
    if (!Number.isFinite(targetId)) return null;
    const list = Array.isArray(scenario && scenario.scenario_objects) ? scenario.scenario_objects : [];
    return list.find((obj) => Number(obj && obj.id) === targetId) || null;
  }

  _getFootprintDimensions(machine) {
    if (!machine) return { width: this.cellSize, height: this.cellSize, footprintX: 1, footprintY: 1 };
    const footprintX = Number(machine.footprint_x ?? machine.footprintX ?? machine.width ?? 1) || 1;
    const footprintY = Number(machine.footprint_y ?? machine.footprintY ?? machine.height ?? 1) || 1;
    return {
      width: footprintX * this.cellSize,
      height: footprintY * this.cellSize,
      footprintX,
      footprintY,
    };
  }

  _getObjectRect(so) {
    if (!so) {
      return { left: 0, top: 0, width: this.cellSize, height: this.cellSize, centerX: 0, centerY: 0 };
    }

    const machine = so.machine || null;
    const dims = this._getFootprintDimensions(machine);
    const gridX = Number(so.grid_x ?? so.gridX ?? 0);
    const gridY = Number(so.grid_y ?? so.gridY ?? 0);
    const left = gridX * this.cellSize;
    const top = gridY * this.cellSize;
    const width = dims.width;
    const height = dims.height;
    const centerX = left + (width / 2);
    const centerY = top + (height / 2);

    return { left, top, width, height, centerX, centerY };
  }

  _getAnchorForObject(so, endpoint) {
    if (!so) {
      return { x: 0, y: 0 };
    }

    const rect = this._getObjectRect(so);
    const centerX = rect.centerX;
    const centerY = rect.centerY;
    const targetX = Number.isFinite(Number(endpoint && endpoint.x)) ? Number(endpoint.x) : centerX;
    const targetY = Number.isFinite(Number(endpoint && endpoint.y)) ? Number(endpoint.y) : centerY;

    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!Number.isFinite(absX) || !Number.isFinite(absY)) {
      return { x: centerX, y: centerY };
    }

    let anchorX = centerX;
    let anchorY = centerY;

    if (absX >= absY) {
      anchorX = (dx >= 0) ? (rect.left + rect.width) : rect.left;
      anchorY = centerY;
    } else {
      anchorY = (dy >= 0) ? (rect.top + rect.height) : rect.top;
      anchorX = centerX;
    }

    if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
      return { x: centerX, y: centerY };
    }

    return { x: anchorX, y: anchorY };
  }

  _getStyleForTransportClass(transportClass = null) {
    const value = String(transportClass || 'water').toLowerCase();
    const palette = {
      water: { stroke: 0x3b82f6, alpha: 0.9 },
      gas: { stroke: 0xfbbf24, alpha: 0.9 },
      power: { stroke: 0x8b5cf6, alpha: 0.95 },
      heat: { stroke: 0xf97316, alpha: 0.9 },
      conveyor: { stroke: 0x22c55e, alpha: 0.9 },
    };

    return palette[value] || { stroke: 0x60a5fa, alpha: 0.85 };
  }

  _buildGeometryForState(state, scenario = this._scenario, pointerWorld = this._pointerWorld) {
    const active = !!(state && state.active);
    if (!active) {
      return { active: false, sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 0, y: 0 }, endpoint: { x: 0, y: 0 }, validTarget: false, source_object_id: null, target_object_id: null, transport_class: null };
    }

    const sourceId = state && state.source_object_id != null ? Number(state.source_object_id) : null;
    const source = Number.isFinite(sourceId) ? this._findScenarioObject(sourceId, scenario) : null;
    if (!source) {
      return { active: false, sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 0, y: 0 }, endpoint: { x: 0, y: 0 }, validTarget: false, source_object_id: null, target_object_id: null, transport_class: this._state.transport_class || null };
    }

    const pointer = pointerWorld && Number.isFinite(Number(pointerWorld.x)) && Number.isFinite(Number(pointerWorld.y)) ? { x: Number(pointerWorld.x), y: Number(pointerWorld.y) } : { x: 0, y: 0 };
    const defaultSourceAnchor = this._getAnchorForObject(source, pointer);
    const sourcePort = state && state.source_port && Number.isFinite(Number(state.source_port.x)) && Number.isFinite(Number(state.source_port.y)) ? { x: Number(state.source_port.x), y: Number(state.source_port.y) } : defaultSourceAnchor;
    const compatibleIds = Array.isArray(state && state.compatible_target_ids) ? state.compatible_target_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [];
    const targetId = state && state.target_object_id != null ? Number(state.target_object_id) : null;
    const target = Number.isFinite(targetId) && compatibleIds.includes(targetId) ? this._findScenarioObject(targetId, scenario) : null;

    if (target) {
      const defaultTargetAnchor = this._getAnchorForObject(target, sourcePort);
      const targetPort = state && state.target_port && Number.isFinite(Number(state.target_port.x)) && Number.isFinite(Number(state.target_port.y)) ? { x: Number(state.target_port.x), y: Number(state.target_port.y) } : defaultTargetAnchor;
      return {
        active: true,
        sourceAnchor: sourcePort,
        targetAnchor: targetPort,
        endpoint: { x: targetPort.x, y: targetPort.y },
        validTarget: true,
        source_object_id: sourceId,
        target_object_id: targetId,
        transport_class: state && state.transport_class ? String(state.transport_class) : this._state.transport_class || null,
      };
    }

    return {
      active: true,
      sourceAnchor: sourcePort,
      targetAnchor: { x: sourcePort.x, y: sourcePort.y },
      endpoint: { x: pointer.x, y: pointer.y },
      validTarget: false,
      source_object_id: sourceId,
      target_object_id: null,
      transport_class: state && state.transport_class ? String(state.transport_class) : this._state.transport_class || null,
    };
  }

  _ensureGraphics() {
    if (!this._scene || !this._scene.add || !this._scene.add.graphics) return null;
    if (!this._graphics) {
      const graphics = this._scene.add.graphics();
      if (graphics && typeof graphics.setDepth === 'function') graphics.setDepth(90);
      this._graphics = graphics;
    }
    return this._graphics;
  }

  update() {
    if (!this._active || !this._scene) return;

    if (this._input && typeof this._input.getPointerWorld === 'function') {
      this._pointerWorld = this._input.getPointerWorld();
    }

    const geometry = this._buildGeometryForState(this._state, this._scenario, this._pointerWorld);
    this._draw(geometry);
  }

  _draw(geometry) {
    const graphics = this._ensureGraphics();
    if (!graphics) return;

    graphics.clear();
    const style = this._getStyleForTransportClass(geometry && geometry.transport_class);
    if (typeof graphics.lineStyle === 'function') graphics.lineStyle(4, style.stroke, style.alpha);
    if (typeof graphics.strokeLineStyle === 'function') graphics.strokeLineStyle();
    if (typeof graphics.lineBetween === 'function') {
      graphics.lineBetween(
        Number(geometry && geometry.sourceAnchor ? geometry.sourceAnchor.x : 0),
        Number(geometry && geometry.sourceAnchor ? geometry.sourceAnchor.y : 0),
        Number(geometry && geometry.endpoint ? geometry.endpoint.x : 0),
        Number(geometry && geometry.endpoint ? geometry.endpoint.y : 0),
      );
    }

    if (geometry && geometry.validTarget && geometry.targetAnchor) {
      if (typeof graphics.fillStyle === 'function') graphics.fillStyle(0x34d399, 0.8);
      if (typeof graphics.fillCircle === 'function') graphics.fillCircle(geometry.targetAnchor.x, geometry.targetAnchor.y, 6);
    }
  }

  clear() {
    this._active = false;
    this._state = {
      active: false,
      source_object_id: null,
      resource_id: null,
      target_object_id: null,
      compatible_target_ids: [],
      transport_class: null,
      source_port: null,
      target_port: null,
    };
    if (this._graphics) {
      try {
        if (typeof this._graphics.clear === 'function') this._graphics.clear();
        if (typeof this._graphics.destroy === 'function') this._graphics.destroy();
      } catch (e) {}
      this._graphics = null;
    }
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function') {
      if (this._bound.onConnectionModeChanged) this.eventBus.off('connection:mode:changed', this._bound.onConnectionModeChanged);
      if (this._bound.onScenarioLoaded) this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded);
      if (this._bound.onPlacementModeChanged) this.eventBus.off('placement:mode:changed', this._bound.onPlacementModeChanged);
    }

    this.clear();
    this._scene = null;
    this._input = null;
    this._scenario = null;
    this._initialised = false;
    this._bound = {};
  }
}
