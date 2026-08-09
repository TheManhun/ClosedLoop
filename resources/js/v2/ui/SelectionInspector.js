export default class SelectionInspector {
  constructor({ eventBus, mountId = 'closed-loop-v2-ui' } = {}) {
    this.eventBus = eventBus;
    this.mountId = mountId;
    this._bound = {};
    this._el = null;
    this._mounted = false;
  }

  initialise() {
    if (this._mounted) return;
    if (typeof document === 'undefined') return;
    const root = document.getElementById(this.mountId);
    if (!root) return;

    const el = document.createElement('div');
    el.className = 'v2-selection-inspector';
    // modest inline styles so consumers don't need CSS edits
    el.style.position = 'relative';
    el.style.marginTop = '8px';
    el.style.padding = '10px';
    el.style.width = '280px';
    el.style.background = 'rgba(6,8,12,0.76)';
    el.style.color = '#e6eef8';
    el.style.borderRadius = '8px';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.3';
    el.style.boxSizing = 'border-box';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
    el.style.display = 'none';
    el.setAttribute('aria-live', 'polite');

    root.appendChild(el);
    this._el = el;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onSelection = (p) => this._onSelectionChanged(p);
      this.eventBus.on('selection:changed', this._bound.onSelection);
    }

    this._mounted = true;
  }

  _onSelectionChanged(payload) {
    try {
      if (!this._el) return;
      if (!payload || payload.kind == null) {
        this._el.style.display = 'none';
        this._el.innerText = '';
        return;
      }
      if (payload.kind === 'clear') {
        this._el.style.display = 'none';
        this._el.innerText = '';
        return;
      }

      // Build content depending on kind
      const lines = [];
      if (payload.kind === 'resource') {
        const meta = payload.meta || {};
        const res = meta.resource || {};
        const name = meta.display_name || res.name || `Resource ${payload.id ?? ''}`;
        const qty = meta.current_quantity ?? meta.initial_quantity ?? '';
        const unit = meta.unit || res.unit || '';
        const type = res.visual_type || res.category || '';
        lines.push(name);
        if (qty !== '') lines.push(`Quantity: ${qty}${unit ? ' ' + unit : ''}`);
        if (type) lines.push(`Type: ${type}`);
      } else if (payload.kind === 'object') {
        const meta = payload.meta || {};
        const name = meta.name || meta.object_key || `Object ${payload.id ?? ''}`;
        const otype = meta.object_type || meta.object_category || '';
        lines.push(name);
        if (otype) lines.push(`Type: ${otype}`);
        lines.push(`fixed: ${meta.fixed ? 'true' : 'false'}`);
        lines.push(`selectable: ${meta.selectable ? 'true' : 'false'}`);
      } else if (payload.kind === 'ground') {
        const wx = payload.world && typeof payload.world.x !== 'undefined' ? Number(payload.world.x) : '';
        const wy = payload.world && typeof payload.world.y !== 'undefined' ? Number(payload.world.y) : '';
        lines.push('Ground');
        lines.push(`X: ${wx}`);
        lines.push(`Y: ${wy}`);
      } else {
        // fallback
        lines.push(String(payload.kind || 'Unknown'));
      }

      // Render
      const content = lines.join('\n');
      try { this._el.innerText = content; } catch (e) {}
      try { this._el.textContent = content; } catch (e) {}
      this._el.style.whiteSpace = 'pre-line';
      this._el.style.display = 'block';
    } catch (e) {
      // noop
    }
  }

  destroy() {
    try {
      if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onSelection) {
        this.eventBus.off('selection:changed', this._bound.onSelection);
      }
    } catch (e) {}
    try { if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el); } catch (e) {}
    this._el = null;
    this._mounted = false;
  }
}
