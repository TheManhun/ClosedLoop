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
        if (!this._previewGraphics) {
            this._previewGraphics = this.scene.add.graphics();
        }
        this._previewGraphics.clear();
        this._previewGraphics.setVisible(true);
        this._previewGraphics.disableInteractive && this._previewGraphics.disableInteractive();
        if (this._previewGraphics.input) this._previewGraphics.input.enabled = false;
    }

    cancelConnection() {
        this._connecting = false;
        this._defKey = null;
        this._def = null;
        this._source = null;
        if (this._previewGraphics) {
            try { this._previewGraphics.clear(); } catch(e){}
            try { this._previewGraphics.setVisible(false); } catch(e){}
            this._previewGraphics.disableInteractive && this._previewGraphics.disableInteractive();
            if (this._previewGraphics.input) this._previewGraphics.input.enabled = false;
        }
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
        const validation = this._validateConnection(this._source, target);
        if (!validation.valid) {
            this._flashRecord(target, 0xff0000);
            this._showValidationMessage(validation.message);
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
        if (!rec || !this._def) return false;
        const def = this.scene._buildingDefs[rec.defKey] || this.scene._buildingDefs[rec.type] || {};
        const connectionType = this._def.key;
        return Boolean(def && Array.isArray(def.provides) && def.provides.includes(connectionType));
    }

    _isCompatibleTarget(source, target) {
        if (!source || !target || !this._def) return false;
        if (source === target) return false;
        const connectionType = this._def.key;
        const targetDef = this.scene._buildingDefs[target.defKey] || this.scene._buildingDefs[target.type] || {};
        const accepts = Array.isArray(targetDef.accepts) ? targetDef.accepts : [];
        return accepts.includes(connectionType);
    }

    _validateConnection(source, target) {
        if (!source || !target || !this._def) {
            return { valid: false, message: 'Connection cannot be created.' };
        }
        if (source === target) {
            return { valid: false, message: 'A connection cannot link an object to itself.' };
        }

        const connectionType = this._def.key;
        const sourceDef = this.scene._buildingDefs[source.defKey] || this.scene._buildingDefs[source.type] || {};
        const targetDef = this.scene._buildingDefs[target.defKey] || this.scene._buildingDefs[target.type] || {};

        const sourceProvides = Array.isArray(sourceDef.provides) ? sourceDef.provides : [];
        const targetAccepts = Array.isArray(targetDef.accepts) ? targetDef.accepts : [];

        const isPowerConnection = connectionType === 'power';
        const sourceCanProvide = sourceProvides.includes(connectionType) || (isPowerConnection && (source.defKey === 'distributionBoard' || source.type === 'power_distribution' || source.defKey === 'externalGrid'));
        const targetCanAccept = targetAccepts.includes(connectionType) || (isPowerConnection && (target.defKey === 'distributionBoard' || target.type === 'power_distribution' || target.defKey === 'processUnit' || target.defKey === 'sortingFacility'));

        if (!sourceCanProvide) {
            return { valid: false, message: `${sourceDef.name || 'This object'} does not provide ${connectionType}.` };
        }

        if (!targetCanAccept) {
            const label = targetDef.name || 'This object';
            return { valid: false, message: `${label} does not accept ${connectionType}.` };
        }

        const existing = this.connectionManager.getAll().some((conn) => {
            const sameType = conn.type === connectionType;
            const sameFrom = conn.fromMachineId === source.id && conn.toMachineId === target.id;
            const sameTo = conn.fromMachineId === target.id && conn.toMachineId === source.id;
            return sameType && (sameFrom || sameTo);
        });

        if (existing) {
            return { valid: false, message: 'That connection already exists.' };
        }

        if (connectionType === 'power') {
            const isSourceBoard = source.defKey === 'distributionBoard' || source.type === 'power_distribution';
            const isTargetBoard = target.defKey === 'distributionBoard' || target.type === 'power_distribution';

            if (isSourceBoard) {
                const outputCount = this.connectionManager.getAll().filter((conn) => conn.type === 'power' && conn.fromMachineId === source.id).length;
                if (outputCount >= (source.maxOutputConnections ?? 4)) {
                    return { valid: false, message: 'Distribution Board has reached its maximum of 4 power outputs.' };
                }
            }

            if (isTargetBoard) {
                const inputCount = this.connectionManager.getAll().filter((conn) => conn.type === 'power' && conn.toMachineId === target.id).length;
                if (inputCount >= (target.maxInputConnections ?? 1)) {
                    return { valid: false, message: 'Distribution Board has reached its maximum of 1 power input.' };
                }
            }
        }

        return { valid: true, message: '' };
    }

    _showValidationMessage(message) {
        try {
            const existing = document.getElementById('connection-validation-message');
            if (existing) existing.remove();
            const el = document.createElement('div');
            el.id = 'connection-validation-message';
            el.textContent = message;
            el.style.position = 'fixed';
            el.style.left = '50%';
            el.style.bottom = '24px';
            el.style.transform = 'translateX(-50%)';
            el.style.background = 'rgba(15, 23, 42, 0.95)';
            el.style.color = '#fff';
            el.style.border = '1px solid rgba(255,255,255,0.12)';
            el.style.padding = '10px 14px';
            el.style.borderRadius = '999px';
            el.style.zIndex = '13000';
            el.style.fontSize = '13px';
            el.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
            document.body.appendChild(el);
            setTimeout(() => { try { el.remove(); } catch (e) {} }, 1800);
        } catch (e) {}
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
