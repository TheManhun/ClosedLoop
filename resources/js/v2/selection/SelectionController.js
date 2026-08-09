export default class SelectionController {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
    this._scene = null;
    this._input = null;
    this._selected = null; // canonical selection
    this._bound = {};
    this._initialised = false;
  }

  initialise(scene, inputController) {
    if (this._initialised) return;
    if (!scene || !scene.input) throw new Error('SelectionController.initialise requires a Phaser Scene with input');
    this._scene = scene;
    this._input = scene.input;

    // handle requests from renderers
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onRequest = (payload) => this._onRequest(payload);
      this.eventBus.on('selection:request', this._bound.onRequest);
    }

    // listen for global pointerdown to clear when clicking empty ground
    try {
      this._bound.onPointerDown = (pointer) => this._onPointerDown(pointer);
      if (this._input && typeof this._input.on === 'function') this._input.on('pointerdown', this._bound.onPointerDown);
    } catch (e) {}

    this._initialised = true;
  }

  _onRequest(payload) {
    try {
      // canonicalise payload minimally
      const sel = {
        kind: payload && payload.kind || 'resource',
        id: payload && (payload.id ?? null),
        instance_key: payload && (payload.instance_key ?? null),
        meta: payload && (payload.meta ?? null),
        world: payload && (payload.world ?? null),
        _pointerId: payload && (payload._pointerId ?? null),
      };

      this._selected = sel;
      // broadcast authoritative change
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        const out = { kind: sel.kind, id: sel.id ?? null, instance_key: sel.instance_key ?? null, meta: sel.meta ?? null, world: sel.world ?? null };
        this.eventBus.emit('selection:changed', out);
      }
      // remember last pointer id for defensive ground-clear
      this._lastPointerId = sel._pointerId || null;
      // clear shortly after to avoid memory leak; no heavy timing expectations
      try { setTimeout(() => { this._lastPointerId = null; }, 0); } catch (e) { this._lastPointerId = null; }
    } catch (e) {}
  }

  _onPointerDown(pointer) {
    try {
      // If pointer indicates it was over a selection target, do not clear.
      const currentlyOver = pointer && (pointer.currentlyOver || pointer._currentlyOver || []);
      const overSelectionTarget = Array.isArray(currentlyOver) && currentlyOver.some((object) => {
        try {
          return object && object._selectionTarget === true;
        } catch (e) {
          return false;
        }
      });
      if (overSelectionTarget) return;

      // If pointer id matches last handled request, ignore clear
      const pid = pointer && (pointer.id ?? pointer.pointerId ?? null);
      if (pid != null && this._lastPointerId != null && pid === this._lastPointerId) return;

      // Instead of clearing directly, emit a canonical ground selection request
      // Reuse previously-derived pid
      let wx = null, wy = null;
      try { wx = typeof pointer.worldX !== 'undefined' ? pointer.worldX : (typeof pointer.x !== 'undefined' ? pointer.x : null); } catch (e) { wx = null; }
      try { wy = typeof pointer.worldY !== 'undefined' ? pointer.worldY : (typeof pointer.y !== 'undefined' ? pointer.y : null); } catch (e) { wy = null; }
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        try {
          this.eventBus.emit('selection:request', { kind: 'ground', id: null, instance_key: null, meta: null, world: { x: wx, y: wy }, _pointerId: pid });
        } catch (e) {}
      }
    } catch (e) {}
  }

  getSelection() {
    return this._selected;
  }

  destroy() {
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onRequest) {
      try { this.eventBus.off('selection:request', this._bound.onRequest); } catch (e) {}
    }
    try { if (this._input && typeof this._input.off === 'function' && this._bound.onPointerDown) this._input.off('pointerdown', this._bound.onPointerDown); } catch (e) {}
    this._scene = null;
    this._input = null;
    this._selected = null;
    this._bound = {};
    this._initialised = false;
  }
}
