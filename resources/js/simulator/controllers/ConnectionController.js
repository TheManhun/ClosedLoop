export default class ConnectionController {
    constructor(scene, connectionManager) {
        this.scene = scene;
        this.connectionManager = connectionManager;
        this._connecting = false;
        this._defKey = null;
        this._def = null;
        this._source = null; // source record
        this._previewGraphics = null;
    }

    beginConnection(defKey, def) {
        this._connecting = true;
        this._defKey = defKey;
        this._def = def;
        this._source = null;
        if (!this._previewGraphics) this._previewGraphics = this.scene.add.graphics();
    }

    cancelConnection() {
        this._connecting = false;
        this._defKey = null;
        this._def = null;
        this._source = null;
        if (this._previewGraphics) { try { this._previewGraphics.clear(); } catch(e){} }
    }

    isConnecting() { return Boolean(this._connecting); }

    // pointerdown: choose source or target
    handlePointerDown(pointer) {
        if (!this._connecting) return;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);
        const rec = this.connectionManager.buildingManager.getMachineAt(ix, iy);
        if (!rec) return; // click empty

        if (!this._source) {
            // select source if compatible
            if (this._isCompatibleSource(rec)) {
                this._source = rec;
                // highlight source visually
                try { this.scene._selectedCell = { ix: rec.gridX, iy: rec.gridY }; if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection(); } catch(e){}
            } else {
                // invalid source feedback (flash red)
                this._flashRecord(rec, 0xff0000);
            }
            return;
        }

        // we have source, now select target
        const target = rec;
        if (!this._isCompatibleTarget(this._source, target)) {
            this._flashRecord(target, 0xff0000);
            return;
        }

        // create connection
        const conn = this.connectionManager.createConnection(this._def, this._source, target);
        // clear preview and exit mode
        this.cancelConnection();
        return conn;
    }

    handlePointerMove(pointer) {
        if (!this._connecting) return;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        // draw preview from source (if selected) to pointer, or nothing
        if (!this._previewGraphics) this._previewGraphics = this.scene.add.graphics();
        this._previewGraphics.clear();
        if (!this._source) return;
        const start = this.scene._getRecordCenter(this._source);
        const end = { x: world.x, y: world.y };
        const valid = true; // cannot validate until target selected; show neutral green
        const color = valid ? 0x10b981 : 0xff0000;
        this._previewGraphics.lineStyle(4, color, 0.9);
        this._previewGraphics.beginPath(); this._previewGraphics.moveTo(start.x, start.y); this._previewGraphics.lineTo(end.x, end.y); this._previewGraphics.strokePath();
    }

    _isCompatibleSource(rec) {
        if (!rec) return false;
        // connection definitions contain resource categories; choose compatibility by record.resourceId or def
        // For power, allow externalGrid and any machine that can accept electricity (heuristic: category energy or def.resourceId==electricity)
        if (!this._def) return false;
        const categories = this._def.resourceCategories || [];
        // Check building def for resourceId or category hints
        const def = this.scene._buildingDefs[rec.defKey] || this.scene._buildingDefs[rec.type] || {};
        if (def && def.resourceId && categories.includes(def.resourceId)) return true;
        if (def && def.category && (def.category === 'energy' || def.category === 'infrastructure') && categories.includes('electricity')) return true;
        // External grid special case
        if (rec.defKey === 'externalGrid' && categories.includes('electricity')) return true;
        // fallback: allow if rec has outputs/resources that match
        return true;
    }

    _isCompatibleTarget(source, target) {
        if (!source || !target) return false;
        // Prevent self-connection
        if (source === target) return false;
        // For power, allow connecting to externalGrid or machines with energy category
        if (!this._def) return false;
        const categories = this._def.resourceCategories || [];
        const defT = this.scene._buildingDefs[target.defKey] || {};
        if (defT && defT.resourceId && categories.includes(defT.resourceId)) return true;
        if (target.defKey === 'externalGrid' && categories.includes('electricity')) return true;
        if (defT && defT.category && (defT.category === 'energy' || defT.category === 'infrastructure') && categories.includes('electricity')) return true;
        // fallback allow
        return true;
    }

    _flashRecord(rec, color) {
        try {
            const orig = rec.statusBg;
            const g = this.scene.add.graphics();
            const center = this.scene._getRecordCenter(rec);
            g.lineStyle(4, color, 0.9);
            const def = this.scene._buildingDefs[rec.defKey] || this.scene._buildingDefs.processUnit;
            const fw = def.footprint[0]; const fh = def.footprint[1];
            const gs = this.scene._gridConfig;
            g.strokeRect(rec.gridX * gs.minor, rec.gridY * gs.minor, fw * gs.minor, fh * gs.minor);
            setTimeout(()=>{ try{ g.destroy(); }catch(e){} }, 400);
        } catch (e) {}
    }
}
