import { machineImage } from './AssetPaths.js';

export default class ScenarioObjectRenderer {
  constructor({ eventBus, cellSize = 64 } = {}) {
    this.eventBus = eventBus;
    this.cellSize = cellSize;
    this._scene = null;
    this._initialised = false;
    this._bound = {};
    this._objects = []; // { obj, texKey, meta }
  }

  initialise(scene) {
    if (this._initialised) return;
    if (!scene || !scene.add || !scene.events) throw new Error('ScenarioObjectRenderer.initialise requires a Phaser Scene');
    this._scene = scene;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onScenarioLoaded = (scenario) => this._onScenarioLoaded(scenario);
      this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);
      // listen for selection changes so we can highlight selected scenario objects
      this._bound.onSelectionChanged = (payload) => this._onSelectionChanged(payload);
      this.eventBus.on('selection:changed', this._bound.onSelectionChanged);
    }

    this._initialised = true;
  }

  _onScenarioLoaded(scenario) {
    try {
      this._clearObjects();
      if (!scenario || !Array.isArray(scenario.scenario_objects)) return;
      const items = scenario.scenario_objects.slice();
      const loads = [];

      for (let i = 0; i < items.length; i++) {
        const so = items[i];
        const hasPos = so && (so.position_x != null || so.position_y != null);
        const x = hasPos ? Number(so.position_x) || 0 : 0;
        const y = hasPos ? Number(so.position_y) || 0 : 0;

        const imgPath = so && so.machine && so.machine.image ? so.machine.image : null;
        const texKey = `scenario_obj_img_${so && so.id || i}`;

        const normalizePath = (p) => {
          if (!p) return p;
          if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) return p;
          return machineImage(p) || p;
        };

        const textureExists = (this._scene.textures && typeof this._scene.textures.exists === 'function') ? this._scene.textures.exists(texKey) : false;
        if (imgPath && !textureExists && this._scene.load && typeof this._scene.load.image === 'function') {
          try {
            this._scene.load.image(texKey, normalizePath(imgPath));
            loads.push({ texKey, so, x, y });
          } catch (e) {
            this._createScenarioObject(so, x, y, null, false);
          }
        } else {
          this._createScenarioObject(so, x, y, texKey, !!imgPath);
        }
      }

      if (loads.length > 0 && this._scene.load && typeof this._scene.load.start === 'function') {
        try {
          this._scene.load.once('complete', () => {
            for (const L of loads) {
              this._createScenarioObject(L.so, L.x, L.y, L.texKey, true);
            }
          });
          this._scene.load.start();
        } catch (e) {
          for (const L of loads) this._createScenarioObject(L.so, L.x, L.y, L.texKey, false);
        }
      }
    } catch (e) {
      // swallow
    }
  }

  _createScenarioObject(so, x, y, texKey, preferImage) {
    if (!this._scene || !this._scene.add) return;
    const size = Math.max(32, Math.floor(this.cellSize * 1.2));
    let go = null;
    let createdAsImage = false;
    try {
      if (preferImage && texKey) {
        try {
          const img = this._scene.add.image(Math.round(x), Math.round(y), texKey);
          if (typeof img.setOrigin === 'function') img.setOrigin(0.5, 0.5);
          if (typeof img.setDepth === 'function') img.setDepth(20);
          // fit to sensible size preserving aspect
          try {
            const iw = img.width || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].width) || null;
            const ih = img.height || (img.texture && img.texture.source && img.texture.source[0] && img.texture.source[0].height) || null;
            if (iw && ih) {
              const scale = Math.min(size / iw, size / ih);
              if (typeof img.setScale === 'function') img.setScale(scale);
              else if (typeof img.setDisplaySize === 'function') img.setDisplaySize(Math.round(iw * scale), Math.round(ih * scale));
            } else if (typeof img.setDisplaySize === 'function') {
              img.setDisplaySize(size, size);
            }
          } catch (e) {}
          go = img; createdAsImage = true;
        } catch (e) { go = null; }
      }
    } catch (e) { go = null; }

    if (!go) {
      // fallback neutral placeholder
      try {
        const g = this._scene.add.graphics();
        if (typeof g.fillStyle === 'function') g.fillStyle(0x666666, 1);
        if (typeof g.fillRect === 'function') g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        if (typeof g.setDepth === 'function') g.setDepth(20);
        go = g;
      } catch (e) { go = null; }
    }

    // apply rotation if provided
    try { if (go && typeof go.setAngle === 'function' && so && so.rotation != null) go.setAngle(Number(so.rotation) || 0); else if (go && typeof go.angle !== 'undefined' && so && so.rotation != null) go.angle = Number(so.rotation) || 0; } catch (e) {}

    // store metadata
    const meta = {
      id: so.id ?? null,
      object_key: so.object_key ?? null,
      object_type: so.object_type ?? null,
      fixed: !!so.fixed,
      selectable: !!so.selectable,
      x: x,
      y: y,
    };

    // create interactive hit zone so pointer events reliably target this object
    let hitZone = null;
    try {
      if (this._scene && this._scene.add && typeof this._scene.add.zone === 'function') {
        try {
          hitZone = this._scene.add.zone(Math.round(x), Math.round(y), size, size);
          if (hitZone && typeof hitZone.setInteractive === 'function') {
            hitZone.setInteractive();
            try { hitZone._selectionTarget = true; } catch (e) {}
            try { hitZone.on('pointerdown', (pointer) => {
              try {
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                  const payload = { kind: 'object', id: meta.id ?? null, instance_key: meta.object_key ?? null, meta: meta, world: { x: meta.x, y: meta.y }, _pointerId: pointer && (pointer.id ?? pointer.pointerId ?? null) };
                  this.eventBus.emit('selection:request', payload);
                }
              } catch (e) {}
            }); } catch (e) {}
          } else {
            // fallback: attach to visual if interactive
            if (go && typeof go.setInteractive === 'function') {
              try { go.setInteractive(); go.on('pointerdown', (pointer) => {
                try { if (this.eventBus && typeof this.eventBus.emit === 'function') this.eventBus.emit('selection:request', { kind: 'object', id: meta.id ?? null, instance_key: meta.object_key ?? null, meta: meta, world: { x: meta.x, y: meta.y }, _pointerId: pointer && (pointer.id ?? pointer.pointerId ?? null) }); } catch (e) {}
              }); } catch (e) {}
            }
          }
        } catch (e) { hitZone = null; }
      } else {
        if (go && typeof go.setInteractive === 'function') {
          try { go.setInteractive(); go.on('pointerdown', (pointer) => { if (this.eventBus && typeof this.eventBus.emit === 'function') this.eventBus.emit('selection:request', { kind: 'object', id: meta.id ?? null, instance_key: meta.object_key ?? null, meta: meta, world: { x: meta.x, y: meta.y }, _pointerId: pointer && (pointer.id ?? pointer.pointerId ?? null) }); }); } catch (e) {}
        }
      }
    } catch (e) {}

    this._objects.push({ obj: go, texKey, meta, createdAsImage, hitZone });
  }

  _clearObjects() {
    if (!this._objects || this._objects.length === 0) return;
    for (const e of this._objects) {
      try {
        if (e.hitZone) {
          try { if (typeof e.hitZone.off === 'function') { e.hitZone.off('pointerdown'); e.hitZone.off('pointerover'); e.hitZone.off('pointerout'); } } catch (er) {}
          try { if (typeof e.hitZone.destroy === 'function') e.hitZone.destroy(); } catch (er) {}
        }
      } catch (err) {}
      try { if (e.obj && typeof e.obj.off === 'function') { e.obj.off && e.obj.off('pointerdown'); e.obj.off && e.obj.off('pointerover'); e.obj.off && e.obj.off('pointerout'); } } catch (err) {}
      try { if (e._selGraphic && typeof e._selGraphic.destroy === 'function') e._selGraphic.destroy(); } catch (err) {}
      try { if (e.obj && typeof e.obj.destroy === 'function') e.obj.destroy(); } catch (err) {}
      // do not remove textures — Phaser may share textures; leave to global cache
    }
    this._objects = [];
  }

  _onSelectionChanged(payload) {
    try {
      // Decide which entry to highlight: prefer id/instance_key match if payload has id or instance_key, else match by world coords
      let selectedKey = null;
      if (payload && payload.kind === 'object' && (payload.id != null || payload.instance_key != null)) {
        for (const it of this._objects) {
          try {
            const mid = it && it.meta && (it.meta.id ?? null);
            const mk = it && it.meta && (it.meta.object_key ?? null);
            if ((payload.id != null && mid != null && payload.id === mid) || (payload.instance_key != null && mk != null && payload.instance_key === mk)) {
              selectedKey = (mid != null) ? `id:${mid}` : (`key:${mk}`);
              break;
            }
          } catch (e) {}
        }
      }
      if (!selectedKey && payload && payload.world) {
        const wx = Number(payload.world.x || 0); const wy = Number(payload.world.y || 0);
        for (const it of this._objects) {
          try { if (Math.abs(Number(it.meta.x || 0) - wx) < 1 && Math.abs(Number(it.meta.y || 0) - wy) < 1) { selectedKey = `pos:${it.meta.x}:${it.meta.y}`; break; } } catch (e) {}
        }
      }

      for (const it of this._objects) {
        try {
          const key = (it && it.meta && it.meta.id != null) ? `id:${it.meta.id}` : (it && it.meta && it.meta.object_key != null) ? `key:${it.meta.object_key}` : `pos:${it && it.meta && it.meta.x}:${it && it.meta && it.meta.y}`;
          const should = (payload && payload.kind === 'object' && selectedKey && key === selectedKey);
          this._setSelectedHighlight(it, should);
        } catch (e) {}
      }
      if (payload && payload.kind === 'clear') {
        for (const it of this._objects) this._setSelectedHighlight(it, false);
      }
    } catch (e) {}
  }

  _setSelectedHighlight(entry, enabled) {
    try {
      if (!entry) return;
      if (!this._scene || !this._scene.add) return;
      if (enabled) {
        if (entry._selGraphic) return;
        try {
          const g = this._scene.add.graphics();
          try { if (typeof g.lineStyle === 'function') g.lineStyle(2, 0x00ff00, 0.95); } catch (e) {}
          try { if (typeof g.strokeRect === 'function') g.strokeRect(Math.round((entry.meta.x || (entry.obj && entry.obj.x) || 0) - (this.cellSize * 0.5)), Math.round((entry.meta.y || (entry.obj && entry.obj.y) || 0) - (this.cellSize * 0.5)), Math.round(this.cellSize), Math.round(this.cellSize)); } catch (e) {}
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

  destroy() {
    try { if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onScenarioLoaded) this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded); } catch (e) {}
    this._clearObjects();
    this._scene = null;
    this._initialised = false;
  }
}
