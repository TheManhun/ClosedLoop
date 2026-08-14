export default class PlacementController {
  constructor({ eventBus, cellSize = 64, worldWidth = Number.POSITIVE_INFINITY, worldHeight = Number.POSITIVE_INFINITY } = {}) {
    this.eventBus = eventBus;
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this._initialised = false;
    this._bound = {};
    this._scene = null;
    this._input = null;
    this._graphics = null;
    this._ghost = null;
    this._previewMachine = null;
    this._scenarioObjects = [];
    this._previewState = {
      visible: false,
      valid: false,
      reason: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      placed: false,
      scenarioObjectCreated: false,
    };
    this._lastPointerWorld = { x: 0, y: 0 };
  }

  initialise(scene = null, inputController = null) {
    if (this._initialised) return;
    this._scene = scene || null;
    this._input = inputController || (scene && scene.input ? scene.input : null);

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onTechnologySelected = (payload) => this._onTechnologySelected(payload);
      this.eventBus.on('technology:selected', this._bound.onTechnologySelected);
      this._bound.onScenarioLoaded = (scenario) => this._onScenarioLoaded(scenario);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);
    }

    if (this._scene && this._scene.input && typeof this._scene.input.on === 'function') {
      this._bound.onPointerMove = (pointer) => {
        const world = this._pointerWorldFromPointer(pointer);
        if (world) {
          this._lastPointerWorld = world;
          if (this._previewMachine) {
            this._updateGhostPosition(world.x, world.y);
          }
        }
      };
      this._scene.input.on('pointermove', this._bound.onPointerMove);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._bound.onKeydown = (event) => {
        if ((event && event.key === 'Escape') || (event && event.code === 'Escape')) {
          this.cancelPreview();
        }
      };
      window.addEventListener('keydown', this._bound.onKeydown);
    }

    this._initialised = true;
    this._renderGhost();
  }

  isInitialised() {
    return this._initialised;
  }

  getPreviewMachine() {
    return this._previewMachine || null;
  }

  getPreviewState() {
    return { ...this._previewState };
  }

  getScenarioObjects() {
    return Array.isArray(this._scenarioObjects) ? this._scenarioObjects.slice() : [];
  }

  getOccupiedRectangles() {
    return this._getOccupiedRectanglesFromScenarioObjects();
  }

  _getOccupiedRectanglesFromScenarioObjects() {
    const objects = Array.isArray(this._scenarioObjects) ? this._scenarioObjects : [];
    return objects.reduce((rects, obj) => {
      if (!obj) return rects;
      const { gridX, gridY, footprintX, footprintY } = this._getCanonicalGridForObject(obj);
      rects.push({
        id: obj.id ?? obj.object_key ?? null,
        x: gridX * this.cellSize,
        y: gridY * this.cellSize,
        width: footprintX * this.cellSize,
        height: footprintY * this.cellSize,
      });
      return rects;
    }, []);
  }

  _getCanonicalGridForObject(obj) {
    const machine = obj && (obj.machine || obj.machine_data || obj);
    const footprintX = Number(machine && (machine.footprint_x ?? machine.footprintX ?? machine.width ?? 1)) || 1;
    const footprintY = Number(machine && (machine.footprint_y ?? machine.footprintY ?? machine.height ?? 1)) || 1;

    const explicitGridX = Number(obj && (obj.grid_x ?? obj.gridX ?? null));
    const explicitGridY = Number(obj && (obj.grid_y ?? obj.gridY ?? null));
    if (Number.isFinite(explicitGridX) && Number.isFinite(explicitGridY)) {
      return { gridX: explicitGridX, gridY: explicitGridY, footprintX, footprintY };
    }

    const legacyX = Number(obj && (obj.position_x ?? obj.x ?? 0)) || 0;
    const legacyY = Number(obj && (obj.position_y ?? obj.y ?? 0)) || 0;
    const gridX = Math.floor((legacyX - ((footprintX * this.cellSize) / 2)) / this.cellSize);
    const gridY = Math.floor((legacyY - ((footprintY * this.cellSize) / 2)) / this.cellSize);
    return { gridX, gridY, footprintX, footprintY };
  }

  _getOccupiedCellSetFromScenarioObjects() {
    const set = new Set();
    const objects = Array.isArray(this._scenarioObjects) ? this._scenarioObjects : [];
    for (const obj of objects) {
      if (!obj) continue;
      const { gridX, gridY, footprintX, footprintY } = this._getCanonicalGridForObject(obj);
      for (let dx = 0; dx < footprintX; dx++) {
        for (let dy = 0; dy < footprintY; dy++) {
          set.add(`${gridX + dx},${gridY + dy}`);
        }
      }
    }
    return set;
  }

  updatePointerWorld(worldPos = { x: 0, y: 0 }) {
    const x = Number(worldPos && worldPos.x != null ? worldPos.x : 0) || 0;
    const y = Number(worldPos && worldPos.y != null ? worldPos.y : 0) || 0;
    this._lastPointerWorld = { x, y };
    if (this._previewMachine) this._updateGhostPosition(x, y);
  }

  cancelPreview() {
    this._previewMachine = null;
    this._previewState = {
      visible: false,
      valid: false,
      reason: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      placed: false,
      scenarioObjectCreated: false,
    };
    this._destroyGhost();
  }

  _onScenarioLoaded(scenario) {
    this._scenarioObjects = Array.isArray(scenario && scenario.scenario_objects) ? scenario.scenario_objects.slice() : [];
    if (this._previewMachine) {
      this._updateGhostPosition(this._lastPointerWorld.x, this._lastPointerWorld.y, true);
    }
  }

  _pointerWorldFromPointer(pointer) {
    if (!pointer) return this._lastPointerWorld;
    if (typeof pointer.worldX === 'number' && typeof pointer.worldY === 'number') {
      return { x: pointer.worldX, y: pointer.worldY };
    }
    if (this._scene && this._scene.cameras && this._scene.cameras.main && typeof this._scene.cameras.main.getWorldPoint === 'function') {
      try {
        const world = this._scene.cameras.main.getWorldPoint(pointer.x || 0, pointer.y || 0);
        if (world) return { x: world.x, y: world.y };
      } catch (e) {}
    }
    return { x: Number(pointer.x) || 0, y: Number(pointer.y) || 0 };
  }

  _onTechnologySelected(payload = {}) {
    const machine = payload && (payload.machine || payload.technology || null);
    if (!machine) {
      this.cancelPreview();
      return;
    }

    this._previewMachine = machine;
    const width = Number(machine.footprint_x ?? machine.footprintX ?? machine.width ?? 2) || 2;
    const height = Number(machine.footprint_y ?? machine.footprintY ?? machine.height ?? 2) || 2;
    const ghostWidth = Math.max(this.cellSize, width * this.cellSize);
    const ghostHeight = Math.max(this.cellSize, height * this.cellSize);
    this._previewState = {
      visible: true,
      valid: true,
      reason: null,
      x: 0,
      y: 0,
      width: ghostWidth,
      height: ghostHeight,
      placed: false,
      scenarioObjectCreated: false,
    };

    const world = this._lastPointerWorld && Number.isFinite(this._lastPointerWorld.x) ? this._lastPointerWorld : { x: 0, y: 0 };
    this._updateGhostPosition(world.x, world.y, true);
  }

  _snapToGrid(x, y) {
    const cellX = Math.floor(x / this.cellSize) * this.cellSize;
    const cellY = Math.floor(y / this.cellSize) * this.cellSize;
    return { x: cellX, y: cellY };
  }

  _gridCoordsFromWorld(x, y) {
    return {
      gridX: Math.floor(x / this.cellSize),
      gridY: Math.floor(y / this.cellSize),
    };
  }

  _isValidWorldPoint(x, y, width = this._previewState.width || this.cellSize, height = this._previewState.height || this.cellSize) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
    if (width <= 0 || height <= 0) return false;

    // V2 uses an expandable engineering workspace rather than a fixed parcel-size bound.
    // A finite world coordinate is valid; future placement rules may reject specific
    // collisions, reserved zones, or infrastructure constraints later.
    return true;
  }

  _hasCollision(gridX, gridY, footprintX, footprintY) {
    const occupied = this._getOccupiedCellSetFromScenarioObjects();
    for (let dx = 0; dx < footprintX; dx++) {
      for (let dy = 0; dy < footprintY; dy++) {
        if (occupied.has(`${gridX + dx},${gridY + dy}`)) {
          return true;
        }
      }
    }
    return false;
  }

  _updateGhostPosition(x, y, force = false) {
    if (!this._previewMachine) {
      this._hideGhost();
      return;
    }

    const snapped = this._snapToGrid(x, y);
    const footprintX = Number(this._previewMachine.footprint_x ?? this._previewMachine.footprintX ?? 2) || 2;
    const footprintY = Number(this._previewMachine.footprint_y ?? this._previewMachine.footprintY ?? 2) || 2;
    const previewWidth = footprintX * this.cellSize;
    const previewHeight = footprintY * this.cellSize;
    const worldValid = this._isValidWorldPoint(snapped.x, snapped.y, previewWidth, previewHeight);

    if (!worldValid) {
      this._previewState = {
        ...this._previewState,
        visible: false,
        valid: false,
        reason: null,
        x: snapped.x,
        y: snapped.y,
        width: previewWidth,
        height: previewHeight,
        placed: false,
        scenarioObjectCreated: false,
      };
      this._destroyGhost();
      return;
    }

    const { gridX, gridY } = this._gridCoordsFromWorld(snapped.x, snapped.y);
    const collision = this._hasCollision(gridX, gridY, footprintX, footprintY);
    const valid = !collision;

    this._previewState = {
      ...this._previewState,
      visible: true,
      valid,
      reason: collision ? 'collision' : null,
      x: snapped.x,
      y: snapped.y,
      width: previewWidth,
      height: previewHeight,
      placed: false,
      scenarioObjectCreated: false,
    };

    this._renderGhost();
  }

  _renderGhost() {
    if (!this._previewMachine) {
      this._destroyGhost();
      return;
    }

    const width = Number(this._previewMachine.footprint_x ?? this._previewMachine.footprintX ?? 2) || 2;
    const height = Number(this._previewMachine.footprint_y ?? this._previewMachine.footprintY ?? 2) || 2;
    const drawWidth = Math.max(this.cellSize, width * this.cellSize);
    const drawHeight = Math.max(this.cellSize, height * this.cellSize);

    const scene = this._scene;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') {
      return;
    }

    const drawX = this._previewState.x;
    const drawY = this._previewState.y;
    const valid = !!this._previewState.valid;
    const color = valid ? 0x7dd3fc : 0xff5c5c;

    if (this._previewMachine.image && scene.add.image) {
      if (!this._ghost || typeof this._ghost.setTint !== 'function') {
        this._destroyGhost();
        const img = scene.add.image(this._previewState.x + (drawWidth / 2), this._previewState.y + (drawHeight / 2), this._previewMachine.image);
        if (!img) {
          return;
        }
        if (typeof img.setOrigin === 'function') img.setOrigin(0.5, 0.5);
        this._ghost = img;
        this._graphics = null;
      }

      const img = this._ghost;
      if (img) {
        if (typeof img.setPosition === 'function') img.setPosition(this._previewState.x + (drawWidth / 2), this._previewState.y + (drawHeight / 2));
        if (typeof img.setTint === 'function') img.setTint(color);
        img.setAlpha(valid ? 0.45 : 0.75);
        if (typeof img.setDisplaySize === 'function') img.setDisplaySize(drawWidth, drawHeight);
        if (typeof img.setVisible === 'function') img.setVisible(true);
      }
      return;
    }

    if (!this._ghost || typeof this._ghost.clear !== 'function') {
      this._destroyGhost();
      const graphics = scene.add.graphics();
      this._graphics = graphics;
      this._ghost = graphics;
    }

    const graphics = this._ghost;
    if (typeof graphics.clear === 'function') graphics.clear();
    if (typeof graphics.lineStyle === 'function') graphics.lineStyle(2, color, 0.9);
    if (typeof graphics.fillStyle === 'function') graphics.fillStyle(color, valid ? 0.28 : 0.45);
    if (typeof graphics.fillRect === 'function') graphics.fillRect(drawX, drawY, drawWidth, drawHeight);
    if (typeof graphics.strokeRect === 'function') graphics.strokeRect(drawX, drawY, drawWidth, drawHeight);
  }

  _destroyGhost() {
    if (this._ghost && typeof this._ghost.destroy === 'function') {
      this._ghost.destroy();
    }
    this._ghost = null;
    if (this._graphics && typeof this._graphics.destroy === 'function') {
      this._graphics.destroy();
    }
    this._graphics = null;
  }

  _hideGhost() {
    this._previewState = {
      ...this._previewState,
      visible: false,
      valid: false,
      reason: null,
    };
    this._destroyGhost();
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onTechnologySelected) {
      this.eventBus.off('technology:selected', this._bound.onTechnologySelected);
    }
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onScenarioLoaded) {
      this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded);
    }

    if (this._scene && this._scene.input && typeof this._scene.input.off === 'function' && this._bound.onPointerMove) {
      this._scene.input.off('pointermove', this._bound.onPointerMove);
    }

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this._bound.onKeydown) {
      window.removeEventListener('keydown', this._bound.onKeydown);
    }

    this.cancelPreview();
    this._scene = null;
    this._input = null;
    this._initialised = false;
    this._bound = {};
    this._lastPointerWorld = { x: 0, y: 0 };
  }
}
