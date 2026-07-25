export default class ConnectionManager {
    constructor(scene, buildingManager) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this._connections = new Map(); // id -> record
        this._nextId = 1;
    }

    createConnection(def, fromRecord, toRecord, opts = {}) {
        // def: connection definition (from ConnectionDefinitions)
        if (!def || !fromRecord || !toRecord) return null;
        const id = this._nextId++;
        const rec = {
            id,
            type: def.key,
            resourceId: def.resourceCategories ? def.resourceCategories[0] : null,
            fromMachineId: fromRecord.id,
            toMachineId: toRecord.id,
            fromPort: opts.fromPort || null,
            toPort: opts.toPort || null,
            direction: opts.direction || (def.bidirectional ? 'bidirectional' : 'unidirectional'),
            capacity: opts.capacity || 0,
            unit: opts.unit || null,
            status: 'active',
            _renderer: null
        };

        // Render basic straight connection between building centres for now
        try {
            const start = this.scene._getRecordCenter(fromRecord);
            const end = this.scene._getRecordCenter(toRecord);
            let renderer = null;
            if (def.key === 'power') {
                // Use the scene power cable primitive for visuals
                renderer = this.scene._createPowerCable({ id, start, end });
            } else {
                // simple line for other types
                const g = this.scene.add.graphics();
                g.lineStyle(4, 0x111111, 1);
                g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(end.x, end.y); g.strokePath();
                renderer = { graphics: g, start, end };
            }
            rec._renderer = renderer;
        } catch (e) {
            console.warn('Failed to render connection', e);
        }

        this._connections.set(id, rec);
        return rec;
    }

    removeConnection(id) {
        const rec = this._connections.get(id);
        if (!rec) return false;
        try {
            if (rec._renderer) {
                if (rec._renderer.container) rec._renderer.container.destroy();
                if (rec._renderer.graphics) rec._renderer.graphics.destroy();
            }
        } catch (e) {}
        this._connections.delete(id);
        return true;
    }

    getConnection(id) { return this._connections.get(id); }
    getAll() { return Array.from(this._connections.values()); }

    // Update renderer endpoints for any connections that reference the given record
    updateConnectionsForRecord(record) {
        if (!record) return;
        for (const rec of this._connections.values()) {
            let changed = false;
            if (rec.fromMachineId === record.id || rec.toMachineId === record.id) {
                try {
                    const from = this.buildingManager.getMachine(rec.fromMachineId);
                    const to = this.buildingManager.getMachine(rec.toMachineId);
                    if (!from || !to) continue;
                    const start = this.scene._getRecordCenter(from);
                    const end = this.scene._getRecordCenter(to);
                    // Update renderer depending on type
                    if (rec._renderer) {
                        if (rec.type === 'power' && rec._renderer.graphics && rec._renderer.symbols) {
                            // replace graphics line by redrawing
                            try {
                                rec._renderer.graphics.clear();
                                rec._renderer.graphics.lineStyle(6, 0x0b0b0b, 1);
                                rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                                rec._renderer.graphics.lineStyle(2, 0x2b2b2b, 0.6);
                                rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                                rec._renderer.start = start; rec._renderer.end = end;
                                // reposition symbols
                                const dx = end.x - start.x, dy = end.y - start.y;
                                const len = Math.sqrt(dx*dx + dy*dy);
                                for (let i=0;i<rec._renderer.symbols.length;i++) {
                                    const img = rec._renderer.symbols[i];
                                    img.x = start.x; img.y = start.y; img.rotation = Math.atan2(dy, dx);
                                }
                                changed = true;
                            } catch (e) { /* ignore */ }
                        } else if (rec._renderer.graphics) {
                            try {
                                rec._renderer.graphics.clear();
                                rec._renderer.graphics.lineStyle(4, 0x111111, 1);
                                rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                                rec._renderer.start = start; rec._renderer.end = end;
                                changed = true;
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            }
            if (changed) {
                // future: emit event
            }
        }
    }

    // Remove any connections referencing the given record
    removeConnectionsForRecord(record) {
        if (!record) return;
        const toRemove = [];
        for (const [id, rec] of this._connections.entries()) {
            if (rec.fromMachineId === record.id || rec.toMachineId === record.id) toRemove.push(id);
        }
        for (const id of toRemove) this.removeConnection(id);
    }
}
