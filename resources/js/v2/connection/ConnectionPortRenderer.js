export default class ConnectionPortRenderer {
  constructor({ eventBus = null, cellSize = 64 } = {}) {
    this.eventBus = eventBus;
    this.cellSize = Number.isFinite(Number(cellSize)) ? Number(cellSize) : 64;
    this._scene = null;
    this._initialised = false;
    this._bound = {};
    this._scenario = null;
    this._selectedObjectId = null;
    this._connectionState = {
      active: false,
      source_object_id: null,
      resource_id: null,
      target_object_id: null,
      compatible_target_ids: [],
    };
    this._portObjects = [];
    this._portRadius = 8;
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add) {
      throw new Error('ConnectionPortRenderer.initialise requires a Phaser Scene');
    }

    this._scene = scene;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onSelectionChanged = (payload) => this._onSelectionChanged(payload);
      this.eventBus.on('selection:changed', this._bound.onSelectionChanged);

      this._bound.onScenarioLoaded = (scenario) => {
        this._scenario = scenario || null;
        this.render();
      };
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);

      this._bound.onConnectionModeChanged = (payload) => {
        this._connectionState = {
          active: !!(payload && payload.active),
          source_object_id: payload && payload.source_object_id != null ? Number(payload.source_object_id) : null,
          resource_id: payload && payload.resource_id != null ? Number(payload.resource_id) : null,
          target_object_id: payload && payload.target_object_id != null ? Number(payload.target_object_id) : null,
          compatible_target_ids: Array.isArray(payload && payload.compatible_target_ids) ? payload.compatible_target_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [],
        };
        this.render();
      };
      this.eventBus.on('connection:mode:changed', this._bound.onConnectionModeChanged);
    }

    this._initialised = true;
    this.render();
  }

  _onSelectionChanged(payload = {}) {
    const kind = payload && payload.kind;
    const id = payload && payload.id != null ? Number(payload.id) : null;
    if (kind === 'object' && Number.isFinite(id)) {
      this._selectedObjectId = id;
    } else if (kind === 'ground' || kind === 'resource') {
      this._selectedObjectId = null;
    }
    this.render();
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

  _getObjectWorldRect(so) {
    if (!so) return { left: 0, top: 0, width: this.cellSize, height: this.cellSize, right: this.cellSize, bottom: this.cellSize, centerX: 0, centerY: 0 };
    const machine = so.machine || null;
    const dims = this._getFootprintDimensions(machine);
    const gridX = Number(so.grid_x ?? so.gridX ?? 0);
    const gridY = Number(so.grid_y ?? so.gridY ?? 0);
    const left = gridX * this.cellSize;
    const top = gridY * this.cellSize;
    const width = dims.width;
    const height = dims.height;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      centerX: left + (width / 2),
      centerY: top + (height / 2),
    };
  }

  _getResourceTransportClasses(resource = null) {
    if (!resource) return [];
    const candidates = [
      resource.transport_classes,
      resource.resource_transport_classes,
      resource.transportClass,
      resource.resource_transport_class,
    ];

    const values = [];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          if (item == null) continue;
          if (typeof item === 'string') values.push(item.toLowerCase());
          else if (item && typeof item.transport_class === 'string') values.push(item.transport_class.toLowerCase());
          else if (item && typeof item.name === 'string') values.push(item.name.toLowerCase());
        }
      } else if (typeof candidate === 'string') {
        values.push(candidate.toLowerCase());
      } else if (candidate && Array.isArray(candidate.value)) {
        for (const item of candidate.value) {
          if (typeof item === 'string') values.push(item.toLowerCase());
          else if (item && typeof item.transport_class === 'string') values.push(item.transport_class.toLowerCase());
        }
      }
    }
    return [...new Set(values.filter(Boolean))];
  }

  _getPortColor(direction = 'input', transportClasses = []) {
    const transport = String((transportClasses && transportClasses[0]) || (direction === 'input' ? 'water' : 'gas')).toLowerCase();
    const palette = {
      water: 0x3b82f6,
      gas: 0xfbbf24,
      power: 0x8b5cf6,
      heat: 0xf97316,
      conveyor: 0x22c55e,
    };
    return palette[transport] || (direction === 'input' ? 0x60a5fa : 0x34d399);
  }

  _normaliseDirection(direction = null) {
    return String(direction || '').trim().toLowerCase();
  }

  _resolveVisualPortAnchor(machine, resource, direction = null) {
    if (!machine || !resource || !Array.isArray(machine.visual_ports)) return null;

    const resourceId = Number(resource && (resource.id ?? resource.resource_id ?? resource.resourceId ?? null));
    const expectedDirection = this._normaliseDirection(direction || (resource && (resource.direction || resource.type)));
    if (!Number.isFinite(resourceId)) return null;

    for (const anchor of machine.visual_ports) {
      if (!anchor || typeof anchor !== 'object') continue;

      const anchorId = Number(anchor.resource_id ?? anchor.resourceId ?? null);
      if (!Number.isFinite(anchorId) || anchorId !== resourceId) continue;

      const anchorDirection = this._normaliseDirection(anchor.direction || anchor.type || expectedDirection);
      if (expectedDirection && anchorDirection && anchorDirection !== expectedDirection) continue;

      const x = Number(anchor.x ?? null);
      const y = Number(anchor.y ?? null);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      return { x: Number(x), y: Number(y), direction: anchorDirection || expectedDirection || null };
    }

    return null;
  }

  _getArtRelativePortWorld(so, machine, resource = null, anchor = null) {
    if (!so) return { x: 0, y: 0 };

    const rect = this._getObjectWorldRect(so);
    const targetAnchor = anchor || this._resolveVisualPortAnchor(machine, resource, resource && (resource.direction || resource.type));
    if (!targetAnchor) {
      return { x: rect.centerX, y: rect.centerY };
    }

    const artWidth = rect.width * 0.85;
    const artHeight = rect.height * 0.85;
    const localX = Number(targetAnchor.x);
    const localY = Number(targetAnchor.y);
    const dx = (localX - 0.5) * artWidth;
    const dy = (localY - 0.5) * artHeight;

    const rotation = Number(so.rotation ?? 0) || 0;
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rotatedX = (dx * cos) - (dy * sin);
    const rotatedY = (dx * sin) + (dy * cos);

    return {
      x: rect.centerX + rotatedX,
      y: rect.centerY + rotatedY,
    };
  }

  _makePortDefinition(so, resource, index, side = 'left') {
    const direction = String(resource && (resource.direction || resource.type || '')).toLowerCase();
    const resourceId = Number(resource && (resource.id ?? resource.resource_id ?? resource.resourceId ?? null));
    if (!Number.isFinite(resourceId)) return null;

    const rect = this._getObjectWorldRect(so);
    const machine = so && so.machine ? so.machine : null;
    const anchor = this._resolveVisualPortAnchor(machine, resource, direction);
    const transportClasses = this._getResourceTransportClasses(resource);

    if (anchor) {
      const world = this._getArtRelativePortWorld(so, machine, resource, anchor);
      return {
        scenario_object_id: Number(so.id),
        machine_id: Number(so.machine_id ?? (so.machine && so.machine.id) ?? null),
        resource_id: resourceId,
        direction,
        transport_classes: transportClasses,
        world,
        color: this._getPortColor(direction, transportClasses),
      };
    }

    const slotHeight = 18;
    const xOffset = 12;
    const startY = rect.top + 20;
    const y = startY + (index * slotHeight) + (slotHeight / 2);
    const worldX = side === 'left' ? (rect.left - xOffset) : (rect.right + xOffset);
    const worldY = y;

    return {
      scenario_object_id: Number(so.id),
      machine_id: Number(so.machine_id ?? (so.machine && so.machine.id) ?? null),
      resource_id: resourceId,
      direction,
      transport_classes: transportClasses,
      world: { x: worldX, y: worldY },
      color: this._getPortColor(direction, transportClasses),
    };
  }

  _clearPorts() {
    if (!this._portObjects.length) return;
    for (const port of this._portObjects) {
      try { if (port.zone && typeof port.zone.destroy === 'function') port.zone.destroy(); } catch (e) {}
      try { if (port.visual && typeof port.visual.destroy === 'function') port.visual.destroy(); } catch (e) {}
    }
    this._portObjects = [];
  }

  _getPortsForSelection() {
    const scenario = this._scenario;
    const selectedId = this._selectedObjectId;
    if (!scenario || !Number.isFinite(selectedId)) return [];

    const selected = this._findScenarioObject(selectedId, scenario);
    if (!selected) return [];

    const machine = selected.machine || null;
    const resources = Array.isArray(machine && machine.resources) ? machine.resources : [];

    const ports = [];
    let inputIndex = 0;
    let outputIndex = 0;
    for (const resource of resources) {
      const direction = String(resource && (resource.direction || resource.type || '')).toLowerCase();
      if (!['input', 'output'].includes(direction)) continue;
      const port = this._makePortDefinition(selected, resource, direction === 'input' ? inputIndex++ : outputIndex++, direction === 'input' ? 'left' : 'right');
      if (port) ports.push(port);
    }
    return ports;
  }

  _getCompatibleInputPortsForSource() {
    if (!this._connectionState.active || !this._scenario || !this._connectionState.source_object_id || !this._connectionState.resource_id) {
      return [];
    }

    const sourceId = Number(this._connectionState.source_object_id);
    const resourceId = Number(this._connectionState.resource_id);
    const compatible = [];
    for (const so of this._scenario.scenario_objects || []) {
      if (!so || Number(so.id) === sourceId) continue;
      const machine = so.machine || null;
      const resources = Array.isArray(machine && machine.resources) ? machine.resources : [];
      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const direction = String(resource && (resource.direction || resource.type || '')).toLowerCase();
        const rid = Number(resource && (resource.id ?? resource.resource_id ?? resource.resourceId ?? null));
        if (direction !== 'input') continue;
        if (!Number.isFinite(rid) || rid !== resourceId) continue;
        const port = this._makePortDefinition(so, resource, i, 'left');
        if (port) compatible.push(port);
      }
    }
    return compatible;
  }

  _renderPort(port, highlighted = false) {
    if (!this._scene || !this._scene.add) return null;
    const zone = this._scene.add.zone(port.world.x, port.world.y, 16, 16);
    zone.setInteractive();
    zone.setDepth(60);
    zone._connectionPortMeta = {
      scenario_object_id: port.scenario_object_id,
      machine_id: port.machine_id,
      resource_id: port.resource_id,
      direction: port.direction,
      transport_classes: port.transport_classes,
    };

    const graphic = this._scene.add.graphics();
    if (typeof graphic.setPosition === 'function') {
      graphic.setPosition(port.world.x, port.world.y);
    }
    if (typeof graphic.setDepth === 'function') {
      graphic.setDepth(61);
    }
    if (typeof graphic.fillStyle === 'function') {
      graphic.fillStyle(highlighted ? 0xfbbf24 : port.color, 1);
    }
    if (typeof graphic.fillCircle === 'function') {
      graphic.fillCircle(0, 0, 7);
    }
    if (typeof graphic.lineStyle === 'function') {
      graphic.lineStyle(2, highlighted ? 0xffffff : 0x0f172a, 1);
    }
    if (typeof graphic.strokeCircle === 'function') {
      graphic.strokeCircle(0, 0, 7);
    }

    const eventName = port.direction === 'output' ? 'connection:port:output:selected' : 'connection:port:input:hover';
    const leaveName = 'connection:port:input:leave';
    const clickName = 'connection:port:input:clicked';

    zone.on('pointerover', () => {
      if (!this.eventBus || typeof this.eventBus.emit !== 'function') return;
      if (port.direction === 'output') return;
      this.eventBus.emit('connection:port:input:hover', {
        scenario_object_id: port.scenario_object_id,
        machine_id: port.machine_id,
        resource_id: port.resource_id,
        direction: port.direction,
        transport_classes: port.transport_classes,
        world: { ...port.world },
      });
    });

    zone.on('pointerout', () => {
      if (!this.eventBus || typeof this.eventBus.emit !== 'function') return;
      if (port.direction === 'output') return;
      this.eventBus.emit('connection:port:input:leave', {
        scenario_object_id: port.scenario_object_id,
        machine_id: port.machine_id,
        resource_id: port.resource_id,
        direction: port.direction,
        transport_classes: port.transport_classes,
        world: { ...port.world },
      });
    });

    zone.on('pointerdown', () => {
      if (!this.eventBus || typeof this.eventBus.emit !== 'function') return;
      if (port.direction === 'output') {
        this.eventBus.emit('connection:port:output:selected', {
          scenario_object_id: port.scenario_object_id,
          machine_id: port.machine_id,
          resource_id: port.resource_id,
          direction: port.direction,
          transport_classes: port.transport_classes,
          world: { ...port.world },
          scenario: this._scenario,
        });
        return;
      }
      this.eventBus.emit('connection:port:input:clicked', {
        scenario_object_id: port.scenario_object_id,
        machine_id: port.machine_id,
        resource_id: port.resource_id,
        direction: port.direction,
        transport_classes: port.transport_classes,
        world: { ...port.world },
      });
    });

    this._portObjects.push({ port, zone, visual: graphic, eventName, leaveName, clickName });
    return { port, zone, visual: graphic };
  }

  render() {
    if (!this._scene || !this._scenario) {
      this._clearPorts();
      return;
    }

    this._clearPorts();

    const sourcePorts = this._connectionState.active ? this._getCompatibleInputPortsForSource() : [];
    const activeCompatible = new Set(sourcePorts.map((port) => Number(port.scenario_object_id)));

    let portsToRender = [];
    if (this._selectedObjectId != null) {
      const selected = this._findScenarioObject(this._selectedObjectId, this._scenario);
      if (selected) {
        const machine = selected.machine || null;
        const resources = Array.isArray(machine && machine.resources) ? machine.resources : [];

        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i];
          const direction = String(resource && (resource.direction || resource.type || '')).toLowerCase();
          if (!['input', 'output'].includes(direction)) continue;
          const port = this._makePortDefinition(selected, resource, i, direction === 'input' ? 'left' : 'right');
          if (port) portsToRender.push(port);
        }
      }
    }

    if (this._connectionState.active && this._connectionState.source_object_id) {
      const source = this._findScenarioObject(this._connectionState.source_object_id, this._scenario);
      if (source && source.machine) {
        const machine = source.machine;
        const sourceResources = Array.isArray(machine.resources) ? machine.resources : [];
        for (let i = 0; i < sourceResources.length; i++) {
          const resource = sourceResources[i];
          const direction = String(resource && (resource.direction || resource.type || '')).toLowerCase();
          if (direction !== 'output') continue;
          const port = this._makePortDefinition(source, resource, i, 'right');
          if (port) portsToRender.push(port);
        }
      }
      for (const port of sourcePorts) {
        portsToRender.push(port);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const port of portsToRender) {
      const key = `${port.scenario_object_id}:${port.resource_id}:${port.direction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(port);
    }

    for (const port of deduped) {
      const isHighlight = this._connectionState.active && port.direction === 'input' && activeCompatible.has(Number(port.scenario_object_id));
      this._renderPort(port, isHighlight);
    }
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function') {
      if (this._bound.onSelectionChanged) this.eventBus.off('selection:changed', this._bound.onSelectionChanged);
      if (this._bound.onScenarioLoaded) this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded);
      if (this._bound.onConnectionModeChanged) this.eventBus.off('connection:mode:changed', this._bound.onConnectionModeChanged);
    }

    this._clearPorts();
    this._scene = null;
    this._scenario = null;
    this._selectedObjectId = null;
    this._initialised = false;
    this._bound = {};
  }
}
