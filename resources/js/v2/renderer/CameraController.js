export default class CameraController {
  constructor(options = {}) {
    const defaults = { minZoom: 0.5, maxZoom: 2.0, zoomSensitivity: 0.0015 };
    this._opts = Object.assign({}, defaults, options);
    this._scene = null;
    this._bound = {};
    this._controls = {
      dragging: false,
      dragStart: { x: 0, y: 0, scrollX: 0, scrollY: 0 },
      minZoom: this._opts.minZoom,
      maxZoom: this._opts.maxZoom,
      zoomSensitivity: this._opts.zoomSensitivity
    };
  }

  initialise(scene) {
    if (!scene) return;
    this._scene = scene;
    const controls = this._controls;

    // Bound handlers so we can remove them in destroy()
    this._bound.pointerdown = (pointer) => {
      try {
        if (pointer && typeof pointer.middleButtonDown === 'function' && pointer.middleButtonDown()) {
          const cam = scene.cameras.main;
          controls.dragging = true;
          controls.dragStart = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
          if (typeof scene.hideContextMenu === 'function') {
            try { scene.hideContextMenu(); } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { /* ignore */ }
    };

    this._bound.pointerup = (pointer) => {
      try {
        if (pointer && !(pointer.middleButtonDown && pointer.middleButtonDown())) {
          controls.dragging = false;
        }
      } catch (e) { controls.dragging = false; }
    };

    this._bound.pointermove = (pointer) => {
      try {
        if (!controls.dragging) return;
        const cam = scene.cameras.main;
        const start = controls.dragStart;
        cam.scrollX = start.scrollX - (pointer.x - start.x) / cam.zoom;
        cam.scrollY = start.scrollY - (pointer.y - start.y) / cam.zoom;
        if (typeof scene._updateHover === 'function') {
          try { scene._updateHover(pointer); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    };

    this._bound.wheel = (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      try {
        const cam = scene.cameras.main;
        const prevZoom = cam.zoom;
        const newZoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, prevZoom - deltaY * controls.zoomSensitivity * prevZoom));
        if (newZoom === prevZoom) return;
        const before = typeof cam.getWorldPoint === 'function' ? cam.getWorldPoint(pointer.x, pointer.y) : { x: 0, y: 0 };
        if (typeof cam.setZoom === 'function') {
          cam.setZoom(newZoom);
        } else {
          cam.zoom = newZoom;
        }
        const after = typeof cam.getWorldPoint === 'function' ? cam.getWorldPoint(pointer.x, pointer.y) : { x: 0, y: 0 };
        cam.scrollX += before.x - after.x;
        cam.scrollY += before.y - after.y;
        if (typeof scene._updateHover === 'function') {
          try { scene._updateHover(pointer); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    };

    // Register handlers on the Phaser input system
    try {
      scene.input.on('pointerdown', this._bound.pointerdown);
      scene.input.on('pointerup', this._bound.pointerup);
      scene.input.on('pointermove', this._bound.pointermove);
      scene.input.on('wheel', this._bound.wheel);
    } catch (e) {
      // ignore registration errors
    }
  }

  destroy() {
    if (!this._scene) return;
    try {
      const input = this._scene.input;
      if (input && this._bound.pointerdown) input.off('pointerdown', this._bound.pointerdown);
      if (input && this._bound.pointerup) input.off('pointerup', this._bound.pointerup);
      if (input && this._bound.pointermove) input.off('pointermove', this._bound.pointermove);
      if (input && this._bound.wheel) input.off('wheel', this._bound.wheel);
    } catch (e) { /* ignore */ }
    this._scene = null;
    this._bound = {};
  }
}
