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
}
