import { machineImage } from '../renderer/AssetPaths.js';

export default class PlacementController {
  constructor({ eventBus, cellSize = 64, worldWidth = Number.POSITIVE_INFINITY, worldHeight = Number.POSITIVE_INFINITY, scenarioId = null } = {}) {
    this.eventBus = eventBus;
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this._scenarioId = Number.isFinite(Number(scenarioId)) ? Number(scenarioId) : null;
    this._apiCoordinator = null;
    this._scenarioLoader = null;
    this._runtimeEventConsumerInstalled = false;
    this._isSubmitting = false;
    this._initialised = false;
    this._bound = {};
    this._scene = null;
    this._input = null;
    this._graphics = null;
    this._ghost = null;
    this._artworkSprite = null;
    this._artworkKey = null;
    this._previewMachine = null;
    this._scenarioObjects = [];
    this._previewState = {
      visible: false,
      valid: false,
      reason: null,
      rotation: 0,
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
      this._bound.onPlacementCommitted = () => {
        this._isSubmitting = false;
      };
      this.eventBus.on('placement:committed', this._bound.onPlacementCommitted);
      this._bound.onPlacementFailed = () => {
        this._isSubmitting = false;
      };
      this.eventBus.on('placement:failed', this._bound.onPlacementFailed);
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

      this._bound.onPointerDown = (pointer) => {
        if (!pointer || typeof pointer.leftButtonDown !== 'function' || !pointer.leftButtonDown()) {
          return;
        }
        if (this._isSubmitting) {
          return;
        }
        if (!this._previewMachine || !this._previewState || !this._previewState.valid) {
          return;
        }
        this.confirmPlacement();
      };
      this._scene.input.on('pointerdown', this._bound.onPointerDown);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._bound.onKeydown = (event) => {
        if ((event && event.key === 'Escape') || (event && event.code === 'Escape')) {
          this.cancelPreview();
          return;
        }

        const keyName = event && event.key ? String(event.key).toLowerCase() : '';
        if (this._previewMachine && (keyName === 'r' || event?.code === 'KeyR')) {
          this.rotatePreview();
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

  setApiCoordinator(apiCoordinator) {
    this._apiCoordinator = apiCoordinator || null;
  }

  setScenarioLoader(loader) {
    this._scenarioLoader = loader || null;
  }

  setRuntimeEventConsumerInstalled(enabled = true) {
    this._runtimeEventConsumerInstalled = !!enabled;
  }

  getOccupiedRectangles() {
    return this._getOccupiedRectanglesFromScenarioObjects();
  }

  async confirmPlacement() {
    if (!this._previewMachine) {
      return false;
    }

    if (this._isSubmitting) {
      return false;
    }

    if (!this._previewState || !this._previewState.valid) {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('placement:failed', {
          machine: this._previewMachine,
          reason: this._previewState && this._previewState.reason ? this._previewState.reason : 'invalid-preview',
          preview: this.getPreviewState(),
        });
      }
      return false;
    }

    const scenarioId = this._scenarioId;
    if (!scenarioId) {
      return false;
    }

    const { gridX, gridY } = this._gridCoordsFromWorld(this._previewState.x, this._previewState.y);
    const machine = this._previewMachine;
    const payload = {
      scenario_id: Number(scenarioId),
      object_type: 'machine',
      object_key: `machine_${machine.id}_${gridX}_${gridY}_${Date.now()}`,
      name: machine.name || `Machine ${machine.id ?? 'unknown'}`,
      machine_id: Number(machine.id),
      grid_x: Number(gridX),
      grid_y: Number(gridY),
      position_x: Number(this._previewState.x),
      position_y: Number(this._previewState.y),
      rotation: Number(this._previewState.rotation ?? 0),
      fixed: true,
      selectable: true,
      object_config: {},
      notes: null,
    };

    if (this._runtimeEventConsumerInstalled) {
      this._isSubmitting = true;
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('placement:confirm', { ...payload, machine, preview: this.getPreviewState() });
      }
      return true;
    }

    if (!this._apiCoordinator || typeof this._apiCoordinator.createScenarioObject !== 'function') {
      this._isSubmitting = false;
      return false;
    }

    this._isSubmitting = true;

    try {
      const result = await this._apiCoordinator.createScenarioObject(payload);
      this._previewState = {
        ...this._previewState,
        placed: true,
        scenarioObjectCreated: true,
      };
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('placement:committed', { ...payload, created: result, machine, preview: this.getPreviewState() });
      }
      if (this._scenarioLoader && typeof this._scenarioLoader.load === 'function') {
        await this._scenarioLoader.load(scenarioId);
      }
      return true;
    } catch (error) {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('placement:failed', {
          machine,
          payload,
          preview: this.getPreviewState(),
          error,
        });
      }
      return false;
    } finally {
      this._isSubmitting = false;
    }
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
      rotation: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      placed: false,
      scenarioObjectCreated: false,
    };
    this._destroyGhost();
  }

  _getEffectiveFootprint(machine = this._previewMachine, rotation = Number(this._previewState.rotation ?? 0)) {
    const footprintX = Number(machine && (machine.footprint_x ?? machine.footprintX ?? machine.width ?? 2)) || 2;
    const footprintY = Number(machine && (machine.footprint_y ?? machine.footprintY ?? machine.height ?? 2)) || 2;
    const normalizedRotation = ((Number(rotation) % 360) + 360) % 360;
    const rotated = normalizedRotation === 90 || normalizedRotation === 270;
    return {
      footprintX: rotated ? footprintY : footprintX,
      footprintY: rotated ? footprintX : footprintY,
      rotation: normalizedRotation,
    };
  }

  rotatePreview() {
    if (!this._previewMachine) return;
    const currentRotation = Number(this._previewState.rotation ?? 0);
    const nextRotation = (currentRotation + 90) % 360;
    this._previewState = {
      ...this._previewState,
      rotation: nextRotation,
    };
    this._updateGhostPosition(this._previewState.x, this._previewState.y, true);
  }

  _normaliseMachineImagePath(image) {
    if (!image || typeof image !== 'string') return null;
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) return image;
    return machineImage(image) || image;
  }

  _getArtworkInfo(machine = this._previewMachine) {
    if (!machine || !machine.image || typeof machine.image !== 'string') return null;
    const url = this._normaliseMachineImagePath(machine.image);
    if (!url) return null;
    const file = String(url).split(/[\\/]/).pop() || 'machine';
    const safeName = String(file).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `preview_machine_${machine.id ?? 'unknown'}_${safeName}`;
    return { key, url };
  }

  _destroyArtworkSprite() {
    if (this._artworkSprite && typeof this._artworkSprite.destroy === 'function') {
      this._artworkSprite.destroy();
    }
    this._artworkSprite = null;
    this._artworkKey = null;
  }

  _destroyPreviewGraphics() {
    if (this._graphics && typeof this._graphics.destroy === 'function') {
      this._graphics.destroy();
    }
    this._graphics = null;
  }

  _ensureGraphics() {
    const scene = this._scene;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') return null;
    if (!this._graphics || typeof this._graphics.clear !== 'function') {
      this._graphics = scene.add.graphics();
    }
    return this._graphics;
  }

  _renderArtworkSprite() {
    const scene = this._scene;
    const machine = this._previewMachine;
    if (!scene || !machine) {
      this._destroyArtworkSprite();
      return;
    }

    const info = this._getArtworkInfo(machine);
    if (!info) {
      this._destroyArtworkSprite();
      return;
    }

    const textureExists = scene.textures && typeof scene.textures.exists === 'function'
      ? scene.textures.exists(info.key)
      : false;

    if (!textureExists) {
      this._destroyArtworkSprite();
      if (scene.load && typeof scene.load.image === 'function') {
        try {
          scene.load.image(info.key, info.url);
          if (typeof scene.load.once === 'function') {
            scene.load.once('complete', () => {
              if (this._previewMachine && this._previewMachine.id === machine.id) {
                this._renderGhost();
              }
            });
          }
          if (typeof scene.load.start === 'function') {
            scene.load.start();
          }
        } catch (e) {}
      }
      return;
    }

    if (!this._artworkSprite || this._artworkKey !== info.key) {
      if (this._artworkSprite && typeof this._artworkSprite.destroy === 'function') {
        this._artworkSprite.destroy();
      }
      const sprite = scene.add.image(this._previewState.x + (this._previewState.width / 2), this._previewState.y + (this._previewState.height / 2), info.key);
      if (!sprite) {
        this._artworkSprite = null;
        this._artworkKey = null;
        return;
      }
      this._artworkSprite = sprite;
      this._artworkKey = info.key;
      if (typeof this._artworkSprite.setOrigin === 'function') this._artworkSprite.setOrigin(0.5, 0.5);
    }

    const x = this._previewState.x + (this._previewState.width / 2);
    const y = this._previewState.y + (this._previewState.height / 2);
    if (typeof this._artworkSprite.setPosition === 'function') this._artworkSprite.setPosition(x, y);
    if (typeof this._artworkSprite.setVisible === 'function') this._artworkSprite.setVisible(true);
    if (typeof this._artworkSprite.setAlpha === 'function') this._artworkSprite.setAlpha(this._previewState.valid ? 0.9 : 0.75);
    if (typeof this._artworkSprite.setDisplaySize === 'function') this._artworkSprite.setDisplaySize(this._previewState.width, this._previewState.height);
    if (typeof this._artworkSprite.setAngle === 'function') this._artworkSprite.setAngle(Number(this._previewState.rotation ?? 0));
    else if ('angle' in this._artworkSprite) this._artworkSprite.angle = Number(this._previewState.rotation ?? 0);
  }

  _onScenarioLoaded(scenario) {
    this._scenarioId = Number.isFinite(Number(scenario && scenario.id)) ? Number(scenario.id) : this._scenarioId;
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
      rotation: 0,
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
    const { footprintX, footprintY, rotation } = this._getEffectiveFootprint(this._previewMachine, this._previewState.rotation ?? 0);
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
      rotation,
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

    const scene = this._scene;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') {
      return;
    }

    const { footprintX, footprintY } = this._getEffectiveFootprint(this._previewMachine, this._previewState.rotation ?? 0);
    const drawWidth = Math.max(this.cellSize, footprintX * this.cellSize);
    const drawHeight = Math.max(this.cellSize, footprintY * this.cellSize);
    const drawX = this._previewState.x;
    const drawY = this._previewState.y;
    const valid = !!this._previewState.valid;
    const color = valid ? 0x7dd3fc : 0xff5c5c;

    const graphics = this._ensureGraphics();
    if (graphics) {
      graphics.clear();
      graphics.lineStyle(2, color, 0.9);
      graphics.fillStyle(color, valid ? 0.28 : 0.45);
      graphics.fillRect(drawX, drawY, drawWidth, drawHeight);
      graphics.strokeRect(drawX, drawY, drawWidth, drawHeight);
    }
    this._ghost = graphics;

    const info = this._getArtworkInfo(this._previewMachine);
    if (!info) {
      this._destroyArtworkSprite();
      return;
    }

    const textureExists = scene.textures && typeof scene.textures.exists === 'function'
      ? scene.textures.exists(info.key)
      : false;

    if (!textureExists) {
      this._destroyArtworkSprite();
      if (scene.load && typeof scene.load.image === 'function') {
        try {
          scene.load.image(info.key, info.url);
          if (typeof scene.load.once === 'function') {
            scene.load.once('complete', () => {
              if (this._previewMachine) {
                this._renderGhost();
              }
            });
          }
          if (typeof scene.load.start === 'function') {
            scene.load.start();
          }
        } catch (e) {}
      }
      return;
    }

    this._renderArtworkSprite();
  }

  _destroyGhost() {
    this._destroyArtworkSprite();
    this._destroyPreviewGraphics();
    this._ghost = null;
  }

  _hideGhost() {
    this._previewState = {
      ...this._previewState,
      visible: false,
      valid: false,
      reason: null,
      rotation: 0,
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
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onPlacementCommitted) {
      this.eventBus.off('placement:committed', this._bound.onPlacementCommitted);
    }
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onPlacementFailed) {
      this.eventBus.off('placement:failed', this._bound.onPlacementFailed);
    }

    if (this._scene && this._scene.input && typeof this._scene.input.off === 'function' && this._bound.onPointerMove) {
      this._scene.input.off('pointermove', this._bound.onPointerMove);
    }
    if (this._scene && this._scene.input && typeof this._scene.input.off === 'function' && this._bound.onPointerDown) {
      this._scene.input.off('pointerdown', this._bound.onPointerDown);
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

