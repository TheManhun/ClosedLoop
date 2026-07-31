export default class ConnectionManager {
    constructor(scene, buildingManager) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this._connections = new Map(); // id -> record
        this._nextId = 1;
    }

    _drawBoltShape(bolt) {
        if (!bolt) return;
        bolt.clear();
        bolt.lineStyle(2.5, 0xfef3c7, 1);
        bolt.beginPath();
        bolt.moveTo(-8, -6);
        bolt.lineTo(0, -6);
        bolt.lineTo(-3, -16);
        bolt.lineTo(10, -2);
        bolt.lineTo(2, -2);
        bolt.lineTo(6, 10);
        bolt.closePath();
        bolt.strokePath();
        bolt.fillStyle(0xfbbf24, 1);
        bolt.fillPath();
    }

    _startPowerBoltAnimation(rec) {
        const renderer = rec && rec._renderer;
        if (!renderer || !Array.isArray(renderer.bolts) || renderer.bolts.length === 0) return;

        const from = this.buildingManager.getMachine(rec.sourceBuildingId);
        const to = this.buildingManager.getMachine(rec.targetBuildingId);
        if (!from || !to) return;

        const start = this.scene._getRecordCenter(from);
        const end = this.scene._getRecordCenter(to);
        renderer.start = start;
        renderer.end = end;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const rotation = Math.atan2(dy, dx);
        const distance = Math.hypot(dx, dy);
        const duration = Math.max(800, distance * 1.8);

        renderer.bolts.forEach((bolt) => {
            try {
                if (bolt._boltTween) {
                    try { bolt._boltTween.stop(); } catch (e) {}
                }
                bolt.setVisible(true);
                bolt.setAlpha(1);
                bolt.setRotation(rotation);
                bolt.setPosition(start.x, start.y);
                this._drawBoltShape(bolt);
                bolt._boltTween = this.scene.tweens.add({
                    targets: bolt,
                    x: { from: start.x, to: end.x },
                    y: { from: start.y, to: end.y },
                    duration,
                    ease: 'Linear',
                    repeat: -1,
                    onUpdate: () => {
                        try { bolt.setRotation(rotation); this._drawBoltShape(bolt); } catch (e) {}
                    },
                    onRepeat: () => {
                        try { bolt.setRotation(rotation); this._drawBoltShape(bolt); } catch (e) {}
                    }
                });
            } catch (e) {}
        });
    }

    createConnection(def, fromRecord, toRecord, opts = {}) {
        // def: connection definition (from ConnectionDefinitions)
        if (!def || !fromRecord || !toRecord) return null;
        const id = this._nextId++;
        const rec = {
            id,
            type: def.key,
            resourceId: def.resourceCategories ? def.resourceCategories[0] : null,
            sourceBuildingId: fromRecord.id,
            targetBuildingId: toRecord.id,
            fromMachineId: fromRecord.id,
            toMachineId: toRecord.id,
            fromPort: opts.fromPort || null,
            toPort: opts.toPort || null,
            direction: opts.direction || (def.bidirectional ? 'bidirectional' : 'unidirectional'),
            capacity: opts.capacity || 0,
            unit: opts.unit || null,
            status: 'active',
            active: true,
            flowProgress: 0,
            _renderer: null
        };

        // Render basic straight connection between building centres for now
        try {
            const start = this.scene._getRecordCenter(fromRecord);
            const end = this.scene._getRecordCenter(toRecord);
            const isPowerConnection = String(def.key || def.type || '').toLowerCase() === 'power';
            let renderer = null;
            if (isPowerConnection) {
                // Use the scene power cable primitive for visuals
                renderer = this.scene._createPowerCable({ id, start, end, includeSymbols: false });
                if (renderer && renderer.container) {
                    renderer.container.setDepth(9500);
                    renderer.container.setScrollFactor(1);
                    renderer.container.disableInteractive && renderer.container.disableInteractive();
                    renderer.container.input && (renderer.container.input.enabled = false);
                    const bolt = this.scene.add.graphics();
                    bolt.setPosition(start.x, start.y);
                    bolt.setDepth(10000);
                    bolt.setVisible(false);
                    bolt.setScrollFactor(1);
                    bolt.setAlpha(1);
                    bolt.disableInteractive && bolt.disableInteractive();
                    bolt.input && (bolt.input.enabled = false);
                    renderer.bolts = [bolt];
                    this._startPowerBoltAnimation(rec);
                }
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
                if (Array.isArray(rec._renderer.bolts)) {
                    rec._renderer.bolts.forEach((bolt) => {
                        try { bolt.destroy(); } catch (e) {}
                    });
                }
                if (rec._renderer.container) {
                    rec._renderer.container.destroy();
                } else if (rec._renderer.graphics) {
                    rec._renderer.graphics.destroy();
                }
            }
        } catch (e) {}
        this._connections.delete(id);
        return true;
    }

    getConnection(id) { return this._connections.get(id); }
    getAll() { return Array.from(this._connections.values()); }

    updateConnectionsForBuilding(buildingId) {
        if (!buildingId) return;
        for (const rec of this._connections.values()) {
            if (rec.sourceBuildingId !== buildingId && rec.targetBuildingId !== buildingId) continue;
            try {
                const from = this.buildingManager.getMachine(rec.sourceBuildingId);
                const to = this.buildingManager.getMachine(rec.targetBuildingId);
                if (!from || !to) continue;
                const start = this.scene._getRecordCenter(from);
                const end = this.scene._getRecordCenter(to);
                if (rec._renderer) {
                    if (rec.type === 'power' && rec._renderer.graphics && rec._renderer.symbols) {
                        try {
                            rec._renderer.graphics.clear();
                            rec._renderer.graphics.lineStyle(6, 0x0b0b0b, 1);
                            rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            rec._renderer.graphics.lineStyle(2, 0x2b2b2b, 0.6);
                            rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            rec._renderer.start = start; rec._renderer.end = end;
                            const dx = end.x - start.x;
                            const dy = end.y - start.y;
                            for (let i = 0; i < rec._renderer.symbols.length; i++) {
                                const img = rec._renderer.symbols[i];
                                img.x = start.x;
                                img.y = start.y;
                                img.rotation = Math.atan2(dy, dx);
                            }
                        } catch (e) { /* ignore */ }
                    } else if (rec._renderer.graphics) {
                        try {
                            rec._renderer.graphics.clear();
                            rec._renderer.graphics.lineStyle(4, 0x111111, 1);
                            rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            rec._renderer.start = start; rec._renderer.end = end;
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
    }

    updateAnimations(time, delta) {
        if (!this._connections) return;
        const deltaSeconds = Math.max(0, (delta || 0) / 1000);
        for (const rec of this._connections.values()) {
            if (rec.type !== 'power') continue;
            const renderer = rec._renderer;
            if (!renderer) continue;
            const isActive = rec.active !== false && rec.status !== 'inactive';
            if (!isActive) {
                if (Array.isArray(renderer.bolts)) {
                    renderer.bolts.forEach((bolt) => {
                        try {
                            if (bolt._boltTween) {
                                bolt._boltTween.stop();
                            }
                        } catch (e) {}
                        bolt.clear();
                        bolt.setVisible(false);
                    });
                }
                continue;
            }

            if (!Array.isArray(renderer.bolts) || renderer.bolts.length === 0) continue;
            if (!renderer.bolts[0]._boltTween || !renderer.bolts[0]._boltTween.isPlaying()) {
                this._startPowerBoltAnimation(rec);
            }
        }
    }

    // Update renderer endpoints for any connections that reference the given record
    updateConnectionsForRecord(record) {
        if (!record) return;
        this.updateConnectionsForBuilding(record.id);
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
