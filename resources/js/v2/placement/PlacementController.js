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
    this._previewState = {
      visible: false,
      valid: false,
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
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      placed: false,
      scenarioObjectCreated: false,
    };
    this._destroyGhost();
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

  _isValidWorldPoint(x, y, width = this._previewState.width || this.cellSize, height = this._previewState.height || this.cellSize) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
    if (width <= 0 || height <= 0) return false;

    // V2 uses an expandable engineering workspace rather than a fixed parcel-size bound.
    // A finite world coordinate is valid; future placement rules may reject specific
    // collisions, reserved zones, or infrastructure constraints later.
    return true;
  }

  _updateGhostPosition(x, y, force = false) {
    if (!this._previewMachine) {
      this._hideGhost();
      return;
    }

    const snapped = this._snapToGrid(x, y);
    const width = Number(this._previewMachine.footprint_x ?? this._previewMachine.footprintX ?? 2) || 2;
    const height = Number(this._previewMachine.footprint_y ?? this._previewMachine.footprintY ?? 2) || 2;
    const previewWidth = Math.max(this.cellSize, width * this.cellSize);
    const previewHeight = Math.max(this.cellSize, height * this.cellSize);
    const valid = this._isValidWorldPoint(snapped.x, snapped.y, previewWidth, previewHeight);

    this._previewState = {
      ...this._previewState,
      visible: true,
      valid,
      x: snapped.x,
      y: snapped.y,
      width: previewWidth,
      height: previewHeight,
      placed: false,
      scenarioObjectCreated: false,
    };

    if (force || valid) {
      this._renderGhost();
    } else {
      this._hideGhost();
    }
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

    this._destroyGhost();

    const scene = this._scene;
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') {
      return;
    }

    if (this._previewMachine.image && scene.add.image) {
      const img = scene.add.image(this._previewState.x + drawWidth / 2, this._previewState.y + drawHeight / 2, this._previewMachine.image);
      if (img) {
        img.setAlpha(0.45);
        img.setDisplaySize(drawWidth, drawHeight);
        img.setVisible(true);
        this._ghost = img;
        this._graphics = null;
        return;
      }
    }

    const graphics = scene.add.graphics();
    if (typeof graphics.clear === 'function') graphics.clear();
    if (typeof graphics.lineStyle === 'function') graphics.lineStyle(2, 0x7dd3fc, 0.9);
    if (typeof graphics.fillStyle === 'function') graphics.fillStyle(0x7dd3fc, 0.28);
    if (typeof graphics.fillRect === 'function') graphics.fillRect(this._previewState.x, this._previewState.y, drawWidth, drawHeight);
    if (typeof graphics.strokeRect === 'function') graphics.strokeRect(this._previewState.x, this._previewState.y, drawWidth, drawHeight);

    this._graphics = graphics;
    this._ghost = graphics;
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
    };
    this._destroyGhost();
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onTechnologySelected) {
      this.eventBus.off('technology:selected', this._bound.onTechnologySelected);
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
