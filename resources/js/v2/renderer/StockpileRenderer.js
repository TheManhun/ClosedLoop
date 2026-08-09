import { resourceImage } from './AssetPaths.js';

export default class StockpileRenderer {
  constructor({ eventBus, cellSize = 64 } = {}) {
    this.eventBus = eventBus;
    this.cellSize = cellSize;
    this._scene = null;
    this._initialised = false;
    this._bound = {};
    this._stockpiles = []; // { obj, hoverHandlers, createdAsImage }
    this._hoverCard = null;
    this._centredOnce = false;
    this._centredFinal = false; // finalised after initial resize
    this._lastCentre = null; // record camera state after a centre
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add || !scene.events) throw new Error('StockpileRenderer.initialise requires a Phaser Scene');
    this._scene = scene;

    // subscribe to scenario:loaded
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onScenarioLoaded = (scenario) => this._onScenarioLoaded(scenario);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);
      // listen for selection changes so we can highlight selected stockpile
      this._bound.onSelectionChanged = (payload) => this._onSelectionChanged(payload);
      this.eventBus.on('selection:changed', this._bound.onSelectionChanged);
    }

    this._initialised = true;
  }

  _onScenarioLoaded(scenario) {
    try {
      // Clear existing visuals
      this._clearStockpiles();

      if (!scenario || !Array.isArray(scenario.scenario_resources)) return;

      const items = scenario.scenario_resources.slice();

      const n = items.length;
      const spacing = this.cellSize * 2; // world units between stockpile centres

      // Fallback algorithm: compute cols/rows from n
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.max(1, Math.ceil(n / cols));

      // collect loads to register with Phaser loader
      const loads = [];

      for (let i = 0; i < n; i++) {
        const sr = items[i];

        // compute position
        const hasPos = sr && (sr.position_x != null || sr.position_y != null);
        let x = 0, y = 0;
        if (hasPos) {
          x = Number(sr.position_x) || 0;
          y = Number(sr.position_y) || 0;
        } else {
          const col = i % cols;
          const row = Math.floor(i / cols);
          // centre grid around origin
          const offsetX = (col - (cols - 1) / 2) * spacing;
          const offsetY = (row - (rows - 1) / 2) * spacing;
          x = offsetX;
          y = offsetY;
        }

        const res = sr && sr.resource ? sr.resource : null;
        const imgPath = res && res.image ? res.image : null;
        const texKey = `stockpile_img_${sr && (sr.id || sr.instance_key) || i}`;

        const normalizePath = (p) => {
          if (!p) return p;
          // prefer resolver for v2 paths; allow absolute urls unchanged
          if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) return p;
          return resourceImage(p) || p;
        };

        const textureExists = (this._scene.textures && typeof this._scene.textures.exists === 'function') ? this._scene.textures.exists(texKey) : false;
        if (imgPath && !textureExists && this._scene.load && typeof this._scene.load.image === 'function') {
          try {
            this._scene.load.image(texKey, normalizePath(imgPath));
            loads.push({ texKey, sr, x, y });
          } catch (e) {
            // if load registration fails, fallback to immediate creation
            this._createStockpile(sr, x, y, texKey, false);
          }
        } else {
          this._createStockpile(sr, x, y, texKey, !!imgPath);
        }
      }

      if (loads.length > 0 && this._scene.load && typeof this._scene.load.start === 'function') {
        try {
          this._scene.load.once('complete', () => {
            for (const L of loads) {
              this._createStockpile(L.sr, L.x, L.y, L.texKey, true);
            }
            // perform initial centre and also arrange to re-centre once after the first resize
            this._centreCameraOnStockpiles();
            // listen for a single Phaser scale resize to re-apply centring if the user hasn't moved the camera
            try {
              if (this._scene.scale && typeof this._scene.scale.once === 'function') {
                this._scene.scale.once('resize', () => {
                  try {
                    // only re-centre if camera appears untouched since our last centre
                    const cam = this._scene.cameras && this._scene.cameras.main;
                    if (!cam) return;
                    if (!this._lastCentre) {
                      this._centreCameraOnStockpiles(true);
                    } else {
                      const dx = Math.abs(cam.scrollX - this._lastCentre.scrollX);
                      const dy = Math.abs(cam.scrollY - this._lastCentre.scrollY);
                      const dz = Math.abs((cam.zoom || 1) - (this._lastCentre.zoom || 1));
                      if (dx < 1 && dy < 1 && dz < 0.01) {
                        this._centreCameraOnStockpiles(true);
                      }
                    }
                  } catch (e) {}
                });
              }
            } catch (e) {}
          });
          this._scene.load.start();
        } catch (e) {
          for (const L of loads) this._createStockpile(L.sr, L.x, L.y, L.texKey, false);
          this._centreCameraOnStockpiles();
        }
      } else {
        this._centreCameraOnStockpiles();
        // Also attach a one-time resize listener for cases where no assets were loaded
        try {
          if (this._scene.scale && typeof this._scene.scale.once === 'function') {
            this._scene.scale.once('resize', () => {
              try {
                const cam = this._scene.cameras && this._scene.cameras.main;
                if (!cam) return;
                if (!this._lastCentre) {
                  this._centreCameraOnStockpiles(true);
                } else {
                  const dx = Math.abs(cam.scrollX - this._lastCentre.scrollX);
                  const dy = Math.abs(cam.scrollY - this._lastCentre.scrollY);
                  const dz = Math.abs((cam.zoom || 1) - (this._lastCentre.zoom || 1));
                  if (dx < 1 && dy < 1 && dz < 0.01) {
                    this._centreCameraOnStockpiles(true);
                  }
                }
              } catch (e) {}
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      // swallow rendering errors
    }
  }

  _createStockpile(sr, x, y) {
    if (!this._scene || !this._scene.add) return;

    const size = Math.max(24, Math.floor(this.cellSize * 0.9));

    // texKey may be provided via closure as fourth arg; if provided and exists, use image
    const texKey = arguments.length >= 4 ? arguments[3] : null;
    const preferImage = arguments.length >= 5 ? !!arguments[4] : false;

    let go = null;
    let createdAsImage = false;
    try {
      // use family visual based on resource visual_type; pass imgKey through for optional image
      const visualType = (sr && sr.resource && sr.resource.visual_type) || 'generic';
      const imgKeyLocal = texKey || (sr && sr.resource && sr.resource.image) || null;
      try {
        switch (visualType) {
          case 'bulk_solid':
            go = this._createBulkSolidVisual(sr, x, y, size, imgKeyLocal);
            break;
          case 'liquid':
            go = this._createLiquidVisual(sr, x, y, size, imgKeyLocal);
            break;
          case 'gas':
            go = this._createGasVisual(sr, x, y, size, imgKeyLocal);
            break;
          case 'mixed_waste':
            go = this._createMixedWasteVisual(sr, x, y, size, imgKeyLocal);
            break;
          default:
            go = this._createGenericVisual(sr, x, y, size, imgKeyLocal);
        }
      } catch (e) {
        // fallback to simple graphics
        try {
          const g = this._scene.add.graphics();
          if (typeof g.fillStyle === 'function') g.fillStyle(0x888888, 1);
          if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
          if (typeof g.setDepth === 'function') g.setDepth(10);
          go = g;
        } catch (e) { go = null; }
      }
    } catch (e) {
      go = null;
    }

    // No permanent labels per requirement.

    // Hover handlers: attach interactive listeners if available, otherwise expose handlers for tests
    const hoverHandlers = { over: null, out: null };

    const selectable = (sr && (typeof sr.selectable !== 'undefined')) ? !!sr.selectable : true;

    const createHoverCard = (srLocal, px, py) => {
      const name = (srLocal && (srLocal.display_name || (srLocal.resource && srLocal.resource.name))) || 'Resource';
      const category = (srLocal && srLocal.resource && srLocal.resource.category) || '';
      const qtyRaw = (srLocal && (srLocal.current_quantity != null ? srLocal.current_quantity : srLocal.initial_quantity != null ? srLocal.initial_quantity : '')) || '';
      const qty = (typeof qtyRaw === 'number' || (!isNaN(Number(qtyRaw)) && qtyRaw !== '')) ? Number(qtyRaw).toLocaleString('en-US') : String(qtyRaw);
      const unit = (srLocal && srLocal.unit) || (srLocal && srLocal.resource && srLocal.resource.unit) || '';

      // Build lines with clear hierarchy and left alignment
      const lines = [];
      lines.push(name);
      if (category) lines.push(category);
      lines.push('Available');
      lines.push(`${qty}${unit ? ' ' + unit : ''}`);

      let txt = null;
      let bg = null;
      try {
        // Temporary placement: bottom-center relative to stockpile; will compute exact left/top after measuring
        const style = { fontFamily: 'monospace', fontSize: '13px', color: '#eee', align: 'left', wordWrap: { width: Math.floor(this.cellSize * 2) } };
        // create text with newline-separated content
        txt = this._scene.add.text(Math.round(px), Math.round(py - size / 2 - 8), lines.join('\n'), style);
        if (typeof txt.setOrigin === 'function') txt.setOrigin(0.5, 1);
        if (typeof txt.setDepth === 'function') txt.setDepth(60);

        // determine metrics with fallbacks
        let metrics = null;
        try { metrics = txt && typeof txt.getTextBounds === 'function' ? txt.getTextBounds() : null; } catch (e) { metrics = null; }
        const textW = metrics ? Math.ceil(metrics.global.width) : Math.floor(this.cellSize * 1.4);
        const textH = metrics ? Math.ceil(metrics.global.height) : 48;

        const padding = 8;
        const minW = Math.floor(this.cellSize * 1.2);
        const w = Math.max(minW, textW + padding * 2);
        const h = textH + padding * 2;

        // compute left/top so that card is above the stockpile and does not cover it more than necessary
        let left = Math.round(px - w / 2);
        let top = Math.round(py - size / 2 - 8 - h);

        // clamp to camera viewport if available
        try {
          const cam = this._scene && this._scene.cameras && this._scene.cameras.main;
          if (cam && cam.worldView) {
            const vw = cam.worldView.x || 0;
            const vh = cam.worldView.y || 0;
            const vwW = cam.worldView.width || (cam.width || 800);
            const vwH = cam.worldView.height || (cam.height || 600);
            if (left < vw) left = vw + 4;
            if (left + w > vw + vwW) left = Math.max(vw + 4, vw + vwW - w - 4);
            if (top < vh) {
              // try placing to the side if not enough space above
              const altLeft = Math.round(px + size / 2 + 8);
              const altTop = Math.round(py - Math.round(h / 2));
              if (altLeft + w <= vw + vwW) { left = altLeft; top = altTop; }
              else top = vh + 4;
            }
          }
        } catch (e) {}

        // place background graphics
        if (this._scene.add && typeof this._scene.add.graphics === 'function') {
          bg = this._scene.add.graphics();
          try {
            if (typeof bg.fillStyle === 'function') bg.fillStyle(0x111111, 0.85);
            if (typeof bg.fillRect === 'function') bg.fillRect(left, top, w, h);
            if (typeof bg.lineStyle === 'function') bg.lineStyle(1, 0xffffff, 0.06);
            if (typeof bg.strokeRect === 'function') bg.strokeRect(left, top, w, h);
            if (typeof bg.setDepth === 'function') bg.setDepth(59);
          } catch (e) {}
        }

        // re-position text inside bg with padding and left-align
        try {
          const textX = left + padding;
          const textY = top + h - padding; // bottom-left
          if (typeof txt.setOrigin === 'function') txt.setOrigin(0, 1);
          try { if (typeof txt.setPosition === 'function') txt.setPosition(textX, textY); else { txt.x = textX; txt.y = textY; } } catch (e) { txt.x = textX; txt.y = textY; }
        } catch (e) {}

      } catch (e) {
        txt = null; bg = null;
      }

      return { text: txt, bg };
    };

    const destroyHoverCard = (card) => {
      if (!card) return;
      try { if (card.text && typeof card.text.destroy === 'function') card.text.destroy(); } catch (e) {}
      try { if (card.bg && typeof card.bg.destroy === 'function') card.bg.destroy(); } catch (e) {}
    };

    const makeOver = (srLocal, cx, cy) => {
      return () => {
        if (this._hoverCard) destroyHoverCard(this._hoverCard);
        this._hoverCard = createHoverCard(srLocal, cx, cy);
      };
    };
    const makeOut = () => {
      return () => {
        if (this._hoverCard) { destroyHoverCard(this._hoverCard); this._hoverCard = null; }
      };
    };

    // Create a dedicated interactive Zone for reliable pointer hit-testing when available.
    let hitZone = null;
    try {
      if (this._scene && this._scene.add && typeof this._scene.add.zone === 'function') {
        try {
          hitZone = this._scene.add.zone(Math.round(x), Math.round(y), size, size);
            if (hitZone && typeof hitZone.setInteractive === 'function') {
            hitZone.setInteractive();
            try { if (selectable) hitZone._selectionTarget = true; } catch (e) {}
            const overFn = makeOver(sr, x, y);
            const outFn = makeOut();
            try { hitZone.on('pointerover', overFn); } catch (e) {}
            try { hitZone.on('pointerout', outFn); } catch (e) {}
            // pointerdown should emit a selection request only if selectable
            try { if (selectable) hitZone.on('pointerdown', (pointer) => {
              try {
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                  const payload = { kind: 'resource', id: sr && (sr.id ?? null), instance_key: sr && (sr.instance_key ?? null), meta: sr, world: { x, y }, _pointerId: pointer && (pointer.id ?? pointer.pointerId ?? null) };
                  this.eventBus.emit('selection:request', payload);
                }
              } catch (e) {}
            }); } catch (e) {}
            hoverHandlers.over = overFn;
            hoverHandlers.out = outFn;
          } else {
            // fallback: attach handlers to visual if zone isn't interactive
            if (go && typeof go.setInteractive === 'function') {
              const overFn = makeOver(sr, x, y);
              const outFn = makeOut();
              try { go.setInteractive(); go.on('pointerover', overFn); go.on('pointerout', outFn); try { if (selectable) go.on('pointerdown', (pointer) => {
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                  const payload = { kind: 'resource', id: sr && (sr.id ?? null), instance_key: sr && (sr.instance_key ?? null), meta: sr, world: { x, y }, _pointerId: pointer && (pointer.id ?? pointer.pointerId ?? null) };
                  this.eventBus.emit('selection:request', payload);
                }
              }); } catch (e) {} hoverHandlers.over = overFn; hoverHandlers.out = outFn; } catch (e) { hoverHandlers.over = overFn; hoverHandlers.out = outFn; }
            } else { hoverHandlers.over = makeOver(sr, x, y); hoverHandlers.out = makeOut(); }
          }
        } catch (e) {
          hitZone = null;
            if (go && typeof go.setInteractive === 'function') {
              const overFn = makeOver(sr, x, y);
              const outFn = makeOut();
              try { go.setInteractive(); go.on('pointerover', overFn); go.on('pointerout', outFn); hoverHandlers.over = overFn; hoverHandlers.out = outFn; } catch (e) { hoverHandlers.over = overFn; hoverHandlers.out = outFn; }
          } else { hoverHandlers.over = makeOver(sr, x, y); hoverHandlers.out = makeOut(); }
        }
      } else {
        // No zone API (tests or very old runtimes): attach to visual or expose handlers
        if (go && typeof go.setInteractive === 'function') {
          const overFn = makeOver(sr, x, y);
          const outFn = makeOut();
          try { go.setInteractive(); go.on('pointerover', overFn); go.on('pointerout', outFn); hoverHandlers.over = overFn; hoverHandlers.out = outFn; } catch (e) { hoverHandlers.over = overFn; hoverHandlers.out = outFn; }
        } else { hoverHandlers.over = makeOver(sr, x, y); hoverHandlers.out = makeOut(); }
      }
    } catch (e) {
      hoverHandlers.over = makeOver(sr, x, y);
      hoverHandlers.out = makeOut();
    }

    // attach stable id for selection matching
    try {
      const srId = sr && (sr.id ?? null);
      if (srId != null) {
        try { if (go) go._resourceId = srId; } catch (e) {}
        try { if (hitZone) hitZone._resourceId = srId; } catch (e) {}
      }
    } catch (e) {}
    const entry = { obj: go, hitZone, hoverHandlers, createdAsImage, x, y };
    try { entry._srKey = `${String(x)}:${String(y)}`; } catch (e) { entry._srKey = null; }
    this._stockpiles.push(entry);
  }

  _onSelectionChanged(payload) {
    try {
      for (const it of this._stockpiles) {
        const sr = it && it.obj ? it.obj : null;
        // resource id may be present in hoverHandlers' closure; compare using stored meta when available
        const matches = (it && it.hitZone && payload && payload.kind === 'resource' && it && it.x != null && it.y != null && (payload.id != null && ((it && it.obj && it.obj._resourceId && it.obj._resourceId === payload.id) || (it && it.obj && it.obj._resourceId == null && false)) )) || false;
      }
      // Simpler approach: match by meta object reference if available
      for (const it of this._stockpiles) {
        const meta = it && it.hoverHandlers && it.hoverHandlers.over && it.hoverHandlers.out ? null : null; // no-op to keep linters happy
      }
      // Use id matching by reading stored sr.id if we attached it. We'll attach _resourceId on first pass for robustness.
      for (const it of this._stockpiles) {
        try {
          if (!it._srId && it.hitZone && it.hitZone._handlers && it.hitZone._handlers.pointerover && it.hitZone._handlers.pointerout) {
            // we don't have direct access to sr here; previous closures captured sr but not stored. rely on x/y uniqueness fallback
            // store a combined key from position as fallback
            it._srKey = `${String(it.x)}:${String(it.y)}`;
          }
        } catch (e) {}
      }

      // Decide which entry to highlight: prefer id match if payload has id, else match by world coords
      let selectedKey = null;
      if (payload && payload.kind === 'resource' && payload.id != null) {
        // find exact match by comparing payload.meta if present
        for (const it of this._stockpiles) {
          try {
            if (it && it.obj && it.obj._resourceId && it.obj._resourceId === payload.id) { selectedKey = it._srKey || `${it.x}:${it.y}`; break; }
          } catch (e) {}
        }
      }
      if (!selectedKey && payload && payload.world) {
        const wx = Number(payload.world.x || 0); const wy = Number(payload.world.y || 0);
        // match by coordinate proximity
        for (const it of this._stockpiles) {
          try { if (Math.abs(Number(it.x || 0) - wx) < 1 && Math.abs(Number(it.y || 0) - wy) < 1) { selectedKey = it._srKey || `${it.x}:${it.y}`; break; } } catch (e) {}
        }
      }

      // apply highlight state
      for (const it of this._stockpiles) {
        const key = it._srKey || `${it.x}:${it.y}`;
        const should = (payload && payload.kind === 'resource' && selectedKey && key === selectedKey);
        this._setSelectedHighlight(it, should);
      }
      // if clear or ground, remove all
      if (payload && (payload.kind === 'clear' || payload.kind === 'ground')) {
        for (const it of this._stockpiles) this._setSelectedHighlight(it, false);
      }
    } catch (e) {}
  }

  _setSelectedHighlight(entry, enabled) {
    try {
      if (!entry) return;
      if (!this._scene || !this._scene.add) return;
      if (enabled) {
        if (entry._selGraphic) return; // already highlighted
        try {
          const g = this._scene.add.graphics();
          try { if (typeof g.lineStyle === 'function') g.lineStyle(3, 0xffff00, 0.95); } catch (e) {}
          try {
            const pad = Math.round(this.cellSize * 0.08);
            const sx = Math.round((entry.x || (entry.obj && entry.obj.x) || 0) - (this.cellSize * 0.5) - pad);
            const sy = Math.round((entry.y || (entry.obj && entry.obj.y) || 0) - (this.cellSize * 0.5) - pad);
            const s = Math.round(this.cellSize + pad * 2);
            if (typeof g.strokeRect === 'function') g.strokeRect(sx, sy, s, s);
          } catch (e) {}
          try { if (typeof g.setDepth === 'function') g.setDepth(70); } catch (e) {}
          entry._selGraphic = g;
        } catch (e) {}
      } else {
        if (entry._selGraphic) {
          try { if (typeof entry._selGraphic.destroy === 'function') entry._selGraphic.destroy(); } catch (e) {}
          entry._selGraphic = null;
        }
      }
    } catch (e) {}
  }

  // Helper: create bulk solid visual (hopper / pile)
  _createBulkSolidVisual(sr, x, y, size, imgKey) {
    const scene = this._scene;
    const g = scene.add.graphics();
    try { if (typeof g.fillStyle === 'function') g.fillStyle(0x6b6b6b, 1); } catch (e) {}
    try { if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size); } catch (e) {}
    try { if (typeof g.setDepth === 'function') g.setDepth(10); } catch (e) {}
    g._family = 'bulk_solid';
    // attach optional material image if available
    let img = null;
    try {
      if (imgKey && scene.add && typeof scene.add.image === 'function') {
        img = scene.add.image(Math.round(x), Math.round(y), imgKey);
        try { if (typeof img.setOrigin === 'function') img.setOrigin(0.5, 0.5); } catch (e) {}
        try { if (typeof img.setDepth === 'function') img.setDepth(11); } catch (e) {}
        // Fit image into the bulk solid interior while preserving aspect ratio.
        try {
          const fillRatio = 0.88; // target 85-90% interior fill
          const maxW = Math.round(size * fillRatio);
          const maxH = Math.round(size * fillRatio);
          const iw = img.width || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].width) || null;
          const ih = img.height || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].height) || null;
          if (iw && ih) {
            const scale = Math.min(maxW / iw, maxH / ih);
            if (typeof img.setScale === 'function') img.setScale(scale);
            else if (typeof img.setDisplaySize === 'function') img.setDisplaySize(Math.round(iw * scale), Math.round(ih * scale));
          } else if (typeof img.setDisplaySize === 'function') {
            img.setDisplaySize(maxW, maxH);
          }
        } catch (e) {}
      }
    } catch (e) { img = null; }
    if (img) g._attachedImage = img;
    // decorative conveyor stub
    try { const c = scene.add.graphics(); if (typeof c.fillStyle === 'function') c.fillStyle(0x444444, 1); if (typeof c.fillRect === 'function') c.fillRect(Math.round(x + size / 2 - 6), Math.round(y + size / 4), 6, Math.round(size / 4)); if (typeof c.setDepth === 'function') c.setDepth(9); g._decor = c; } catch (e) {}
    // override destroy to clean children
    const origDestroy = g.destroy ? g.destroy.bind(g) : null;
    g.destroy = function() {
      try { if (this._attachedImage && typeof this._attachedImage.destroy === 'function') this._attachedImage.destroy(); } catch (e) {}
      try { if (this._decor && typeof this._decor.destroy === 'function') this._decor.destroy(); } catch (e) {}
      try { if (origDestroy) origDestroy(); }
      catch (e) {}
    };
    return g;
  }

  _createMixedWasteVisual(sr, x, y, size, imgKey) {
    const scene = this._scene;
    const g = scene.add.graphics();
    try { if (typeof g.fillStyle === 'function') g.fillStyle(0x5a4f4f, 1); } catch (e) {}
    try { if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, Math.round(size * 0.7)); } catch (e) {}
    try { if (typeof g.setDepth === 'function') g.setDepth(10); } catch (e) {}
    g._family = 'mixed_waste';
    let img = null;
    try {
      if (imgKey && scene.add && typeof scene.add.image === 'function') {
        img = scene.add.image(Math.round(x), Math.round(y - Math.round(size * 0.1)), imgKey);
        try { if (typeof img.setOrigin === 'function') img.setOrigin(0.5, 0.5); } catch (e) {}
        try { if (typeof img.setDepth === 'function') img.setDepth(11); } catch (e) {}
        // Fit image into mixed waste interior while preserving aspect ratio
        try {
          const fillRatio = 0.88;
          const interiorW = size; // full width
          const interiorH = Math.round(size * 0.7); // mixed waste height
          const maxW = Math.round(interiorW * fillRatio);
          const maxH = Math.round(interiorH * fillRatio);
          const iw = img.width || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].width) || null;
          const ih = img.height || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].height) || null;
          if (iw && ih) {
            const scale = Math.min(maxW / iw, maxH / ih);
            if (typeof img.setScale === 'function') img.setScale(scale);
            else if (typeof img.setDisplaySize === 'function') img.setDisplaySize(Math.round(iw * scale), Math.round(ih * scale));
          } else if (typeof img.setDisplaySize === 'function') {
            img.setDisplaySize(maxW, maxH);
          }
        } catch (e) {}
      }
    } catch (e) { img = null; }
    if (img) g._attachedImage = img;
    // decorative conveyor stub
    try { const c = scene.add.graphics(); if (typeof c.fillStyle === 'function') c.fillStyle(0x333333, 1); if (typeof c.fillRect === 'function') c.fillRect(Math.round(x + size / 2 - 8), Math.round(y), 8, Math.round(size * 0.18)); if (typeof c.setDepth === 'function') c.setDepth(9); g._decor = c; } catch (e) {}
    const origDestroy = g.destroy ? g.destroy.bind(g) : null;
    g.destroy = function() { try { if (this._attachedImage && typeof this._attachedImage.destroy === 'function') this._attachedImage.destroy(); } catch (e) {} try { if (this._decor && typeof this._decor.destroy === 'function') this._decor.destroy(); } catch (e) {} try { if (origDestroy) origDestroy(); } catch (e) {} };
    return g;
  }

  _createLiquidVisual(sr, x, y, size, imgKey) {
    const scene = this._scene;
    const g = scene.add.graphics();
    try { if (typeof g.fillStyle === 'function') g.fillStyle(0x2b6b8a, 1); } catch (e) {}
    try { if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 3), size, Math.round(size * 0.5)); } catch (e) {}
    try { if (typeof g.setDepth === 'function') g.setDepth(10); } catch (e) {}
    g._family = 'liquid';
    let img = null;
    try {
      if (imgKey && scene.add && typeof scene.add.image === 'function') {
        img = scene.add.image(Math.round(x), Math.round(y - Math.round(size * 0.05)), imgKey);
        try { if (typeof img.setOrigin === 'function') img.setOrigin(0.5, 0.5); } catch (e) {}
        try { if (typeof img.setDepth === 'function') img.setDepth(11); } catch (e) {}
        // Fit image into liquid interior while preserving aspect ratio
        try {
          const fillRatio = 0.88;
          const interiorW = size;
          const interiorH = Math.round(size * 0.5); // liquid rect height
          const maxW = Math.round(interiorW * fillRatio);
          const maxH = Math.round(interiorH * fillRatio);
          const iw = img.width || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].width) || null;
          const ih = img.height || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].height) || null;
          if (iw && ih) {
            const scale = Math.min(maxW / iw, maxH / ih);
            if (typeof img.setScale === 'function') img.setScale(scale);
            else if (typeof img.setDisplaySize === 'function') img.setDisplaySize(Math.round(iw * scale), Math.round(ih * scale));
          } else if (typeof img.setDisplaySize === 'function') {
            img.setDisplaySize(maxW, maxH);
          }
        } catch (e) {}
      }
    } catch (e) { img = null; }
    if (img) g._attachedImage = img;
    // decorative pipe outlet
    try { const p = scene.add.graphics(); if (typeof p.fillStyle === 'function') p.fillStyle(0x666666, 1); if (typeof p.fillRect === 'function') p.fillRect(Math.round(x + size / 2 - 6), Math.round(y - 2), 6, 6); if (typeof p.setDepth === 'function') p.setDepth(9); g._decor = p; } catch (e) {}
    const origDestroy = g.destroy ? g.destroy.bind(g) : null;
    g.destroy = function() { try { if (this._attachedImage && typeof this._attachedImage.destroy === 'function') this._attachedImage.destroy(); } catch (e) {} try { if (this._decor && typeof this._decor.destroy === 'function') this._decor.destroy(); } catch (e) {} try { if (origDestroy) origDestroy(); } catch (e) {} };
    return g;
  }

  _createGasVisual(sr, x, y, size, imgKey) {
    const scene = this._scene;
    const g = scene.add.graphics();
    try { if (typeof g.fillStyle === 'function') g.fillStyle(0x7a7a7a, 1); } catch (e) {}
    try { if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 4), Math.round(y - size / 2), Math.round(size / 2), size); } catch (e) {}
    try { if (typeof g.setDepth === 'function') g.setDepth(10); } catch (e) {}
    g._family = 'gas';
    const origDestroy = g.destroy ? g.destroy.bind(g) : null;
    g.destroy = function() { try { if (origDestroy) origDestroy(); } catch (e) {} };
    return g;
  }

  _createGenericVisual(sr, x, y, size, imgKey) {
    const scene = this._scene;
    const g = scene.add.graphics();
    try { if (typeof g.fillStyle === 'function') g.fillStyle(0x999999, 1); } catch (e) {}
    try { if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size); } catch (e) {}
    try { if (typeof g.setDepth === 'function') g.setDepth(10); } catch (e) {}
    g._family = 'generic';
    const origDestroy = g.destroy ? g.destroy.bind(g) : null;
    g.destroy = function() { try { if (origDestroy) origDestroy(); } catch (e) {} };
    return g;
  }

  _clearStockpiles() {
    // destroy hover card if present
    try { if (this._hoverCard) { if (this._hoverCard.text && typeof this._hoverCard.text.destroy === 'function') this._hoverCard.text.destroy(); if (this._hoverCard.bg && typeof this._hoverCard.bg.destroy === 'function') this._hoverCard.bg.destroy(); } } catch (e) {}
    this._hoverCard = null;

    for (const it of this._stockpiles) {
      try {
        // remove handlers and destroy hit zone if present
        if (it.hitZone) {
          try { if (typeof it.hitZone.off === 'function') { it.hitZone.off('pointerover'); it.hitZone.off('pointerout'); } } catch (e) {}
          try { if (typeof it.hitZone.destroy === 'function') it.hitZone.destroy(); } catch (e) {}
        }
      } catch (e) {}
      try { if (it.obj && typeof it.obj.off === 'function') { it.obj.off('pointerover'); it.obj.off('pointerout'); } } catch (e) {}
      try { if (it.obj && typeof it.obj.destroy === 'function') it.obj.destroy(); } catch (e) {}
    }
    this._stockpiles = [];
    this._centredOnce = false;
  }

  _centreCameraOnStockpiles() {
    if (this._centredOnce) return;
    if (!this._scene || !this._scene.cameras || !this._scene.cameras.main) return;
    if (!this._stockpiles || this._stockpiles.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of this._stockpiles) {
      const px = (it.x != null) ? Number(it.x) : (it.obj && it.obj.x != null ? Number(it.obj.x) : NaN);
      const py = (it.y != null) ? Number(it.y) : (it.obj && it.obj.y != null ? Number(it.obj.y) : NaN);
      if (!isFinite(px) || !isFinite(py)) continue;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    try { this._scene.cameras.main.centerOn(cx, cy); } catch (e) {}
    this._centredOnce = true;
  }

  destroy() {
    // Unsubscribe
    if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onScenarioLoaded) {
      try { this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded); } catch (e) {}
    }
    // Clear visuals
    this._clearStockpiles();
    this._scene = null;
    this._initialised = false;
    this._bound = {};
  }
}
