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
          if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) return p;
          return '/' + p;
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
      const texExists = (texKey && this._scene.textures && typeof this._scene.textures.exists === 'function') ? this._scene.textures.exists(texKey) : false;
      if (texKey && texExists && this._scene.add && typeof this._scene.add.image === 'function') {
        go = this._scene.add.image(Math.round(x), Math.round(y), texKey);
        if (go && typeof go.setOrigin === 'function') go.setOrigin(0.5, 0.5);
        if (go && typeof go.setDepth === 'function') go.setDepth(10);
        if (go && typeof go.setDisplaySize === 'function') {
          try { go.setDisplaySize(size, size); } catch (e) {}
        }
        createdAsImage = true;
      } else {
        const g = this._scene.add.graphics();
        if (typeof g.fillStyle === 'function') g.fillStyle(0x888888, 1);
        if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        if (typeof g.setDepth === 'function') g.setDepth(10);
        go = g;
      }
    } catch (e) {
      go = null;
    }

    // No permanent labels per requirement.

    // Hover handlers: attach interactive listeners if available, otherwise expose handlers for tests
    const hoverHandlers = { over: null, out: null };

    const createHoverCard = (srLocal, px, py) => {
      const name = (srLocal && (srLocal.display_name || (srLocal.resource && srLocal.resource.name))) || 'Resource';
      const category = (srLocal && srLocal.resource && srLocal.resource.category) || '';
      const qtyRaw = (srLocal && (srLocal.current_quantity != null ? srLocal.current_quantity : srLocal.initial_quantity != null ? srLocal.initial_quantity : '')) || '';
      const qty = (typeof qtyRaw === 'number' || (!isNaN(Number(qtyRaw)) && qtyRaw !== '')) ? Number(qtyRaw).toLocaleString('en-US') : String(qtyRaw);
      const unit = (srLocal && srLocal.unit) || (srLocal && srLocal.resource && srLocal.resource.unit) || '';
      const lines = [];
      lines.push(name);
      if (category) lines.push(category);
      lines.push('Available');
      lines.push(`${qty}${unit ? ' ' + unit : ''}`);

      let txt = null;
      let bg = null;
      try {
        txt = this._scene.add.text(Math.round(px), Math.round(py - size / 2 - 8), lines.join('\n'), { fontFamily: 'monospace', fontSize: '13px', color: '#111', align: 'center', wordWrap: { width: Math.floor(this.cellSize * 1.5) } });
        if (typeof txt.setOrigin === 'function') txt.setOrigin(0.5, 1);
        if (typeof txt.setDepth === 'function') txt.setDepth(60);
        if (this._scene.add && typeof this._scene.add.graphics === 'function') {
          bg = this._scene.add.graphics();
          try {
            const metrics = txt && txt.getTextBounds ? txt.getTextBounds() : null;
            const w = metrics ? Math.ceil(metrics.global.width) + 8 : Math.floor(this.cellSize * 1.2);
            const h = metrics ? Math.ceil(metrics.global.height) + 8 : 48;
            if (typeof bg.fillStyle === 'function') bg.fillStyle(0xFFFFFF, 0.95);
            if (typeof bg.fillRect === 'function') bg.fillRect(Math.round(px - w / 2), Math.round(py - size / 2 - 8 - h), w, h);
            if (typeof bg.setDepth === 'function') bg.setDepth(59);
          } catch (e) {}
        }
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

    if (go && typeof go.setInteractive === 'function' && this._scene.input) {
      try {
        go.setInteractive();
        go.on('pointerover', makeOver(sr, x, y));
        go.on('pointerout', makeOut());
      } catch (e) {
        hoverHandlers.over = makeOver(sr, x, y);
        hoverHandlers.out = makeOut();
      }
    } else {
      hoverHandlers.over = makeOver(sr, x, y);
      hoverHandlers.out = makeOut();
    }

    this._stockpiles.push({ obj: go, hoverHandlers, createdAsImage, x, y });
  }

  _clearStockpiles() {
    // destroy hover card if present
    try { if (this._hoverCard) { if (this._hoverCard.text && typeof this._hoverCard.text.destroy === 'function') this._hoverCard.text.destroy(); if (this._hoverCard.bg && typeof this._hoverCard.bg.destroy === 'function') this._hoverCard.bg.destroy(); } } catch (e) {}
    this._hoverCard = null;

    for (const it of this._stockpiles) {
      try { if (it.obj && typeof it.obj.destroy === 'function') it.obj.destroy(); } catch (e) {}
      // try to remove interactive handlers if present
      try { if (it.obj && typeof it.obj.off === 'function') { it.obj.off('pointerover'); it.obj.off('pointerout'); } } catch (e) {}
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
