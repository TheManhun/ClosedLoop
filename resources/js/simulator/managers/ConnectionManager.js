export default class ConnectionManager {
    constructor(scene, buildingManager) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this._connections = new Map(); // id -> record
        this._nextId = 1;
    }

    _setLayerDepth(renderer, type) {
        if (!renderer) return;
        const layerDepth = {
            power: 100,
            conveyor: 90,
            water: 80,
            gas: 70,
            steam: 60,
            default: 50
        };
        const depth = layerDepth[type] || layerDepth.default;
        if (renderer.container) {
            renderer.container.setDepth(depth);
        }
        if (renderer.graphics) {
            renderer.graphics.setDepth(depth);
        }
        if (Array.isArray(renderer.bolts)) {
            renderer.bolts.forEach((bolt) => {
                try { bolt.setDepth(1100); } catch (e) {}
            });
        }
    }

    _getConnectionDepth(connectionType) {
        const type = String(connectionType || '').toLowerCase();
        if (type === 'power') return 100;
        if (type === 'conveyor') return 90;
        if (type === 'water') return 80;
        if (type === 'gas') return 70;
        if (type === 'steam') return 60;
        return 50;
    }

    _getConnectionEndpoint(record, isStart) {
        if (!record) return null;
        const def = this.scene._buildingDefs[record.defKey] || this.scene._buildingDefs.processUnit;
        const gs = this.scene._gridConfig;
        const fw = def.footprint[0];
        const fh = def.footprint[1];
        const center = this.scene._getRecordCenter(record);
        const halfW = (fw * gs.minor) / 2;
        const halfH = (fh * gs.minor) / 2;
        const inset = Math.max(6, Math.min(10, Math.min(halfW, halfH) * 0.18));
        const x = record.container.x + (isStart ? inset : (fw * gs.minor) - inset);
        const y = record.container.y + (fh * gs.minor) / 2 - 6;
        return { x, y };
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

        const start = this._getConnectionEndpoint(from, true) || this.scene._getRecordCenter(from);
        const end = this._getConnectionEndpoint(to, false) || this.scene._getRecordCenter(to);
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
                        try {
                            const current = this.buildingManager.getMachine(rec.sourceBuildingId);
                            const target = this.buildingManager.getMachine(rec.targetBuildingId);
                            if (current && target) {
                                const liveStart = this.scene._getRecordCenter(current);
                                const liveEnd = this.scene._getRecordCenter(target);
                                const liveRotation = Math.atan2(liveEnd.y - liveStart.y, liveEnd.x - liveStart.x);
                                bolt.setRotation(liveRotation);
                                this._drawBoltShape(bolt);
                            }
                        } catch (e) {}
                    },
                    onRepeat: () => {
                        try {
                            const current = this.buildingManager.getMachine(rec.sourceBuildingId);
                            const target = this.buildingManager.getMachine(rec.targetBuildingId);
                            if (current && target) {
                                const liveStart = this.scene._getRecordCenter(current);
                                const liveEnd = this.scene._getRecordCenter(target);
                                const liveRotation = Math.atan2(liveEnd.y - liveStart.y, liveEnd.x - liveStart.x);
                                bolt.setRotation(liveRotation);
                                this._drawBoltShape(bolt);
                            }
                        } catch (e) {}
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
            sourceRecord: fromRecord,
            targetRecord: toRecord,
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
            const start = this._getConnectionEndpoint(fromRecord, true) || this.scene._getRecordCenter(fromRecord);
            const end = this._getConnectionEndpoint(toRecord, false) || this.scene._getRecordCenter(toRecord);
            const isPowerConnection = String(def.key || def.type || '').toLowerCase() === 'power';
            let renderer = null;
            if (isPowerConnection) {
                // Use the scene power cable primitive for visuals
                renderer = this.scene._createPowerCable({ id, start, end, includeSymbols: false });
                if (renderer && renderer.container) {
                    renderer.container.setDepth(this._getConnectionDepth(def.key));
                    renderer.container.setScrollFactor(1);
                    renderer.container.disableInteractive && renderer.container.disableInteractive();
                    renderer.container.input && (renderer.container.input.enabled = false);
                    const bolt = this.scene.add.graphics();
                    bolt.setPosition(start.x, start.y);
                    bolt.setDepth(1100);
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
                g.setDepth(this._getConnectionDepth(def.key));
                g.lineStyle(4, 0x111111, 1);
                g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(end.x, end.y); g.strokePath();
                renderer = { graphics: g, start, end };
            }
            rec._renderer = renderer;
            this._setLayerDepth(renderer, def.key);
        } catch (e) {
            console.warn('Failed to render connection', e);
        }

        this._connections.set(id, rec);
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
        }
        return rec;
    }

    removeConnection(id) {
        const rec = this._connections.get(id);
        if (!rec) return false;
        try {
            if (rec._renderer) {
                if (Array.isArray(rec._renderer.bolts)) {
                    rec._renderer.bolts.forEach((bolt) => {
                        try {
                            if (bolt._boltTween) {
                                try { bolt._boltTween.stop(); } catch (e) {}
                            }
                            bolt.destroy();
                        } catch (e) {}
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
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
        }
        return true;
    }

    getConnectionAtPoint(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const threshold = 12;
        let closest = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const rec of this._connections.values()) {
            if (!rec._renderer) continue;
            const start = this.scene._getRecordCenter(this.buildingManager.getMachine(rec.sourceBuildingId));
            const end = this.scene._getRecordCenter(this.buildingManager.getMachine(rec.targetBuildingId));
            if (!start || !end) continue;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy) || 1;
            const px = x - start.x;
            const py = y - start.y;
            const dot = (px * dx + py * dy) / length;
            const clamped = Math.max(0, Math.min(length, dot));
            const projX = start.x + (dx / length) * clamped;
            const projY = start.y + (dy / length) * clamped;
            const dist = Math.hypot(x - projX, y - projY);
            if (dist <= threshold && dist < closestDistance) {
                closestDistance = dist;
                closest = rec;
            }
        }
        return closest;
    }

    _syncRecordConnections() {
        const all = this.getAll();
        for (const record of this.buildingManager.getPlacedMachines()) {
            if (!record) continue;
            record.connections = all.filter((conn) => conn && (conn.sourceBuildingId === record.id || conn.targetBuildingId === record.id));
        }
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
                const start = this._getConnectionEndpoint(from, true) || this.scene._getRecordCenter(from);
                const end = this._getConnectionEndpoint(to, false) || this.scene._getRecordCenter(to);
                if (rec._renderer) {
                    if (rec.type === 'power') {
                        try {
                            if (rec._renderer && Array.isArray(rec._renderer.bolts)) {
                                this._startPowerBoltAnimation(rec);
                            }
                        } catch (e) {}
                    }
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
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
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

    removeConnectionsForBuilding(buildingId) {
        if (!buildingId) return 0;
        const toRemove = [];
        for (const [id, rec] of this._connections.entries()) {
            const matches = rec.sourceBuildingId === buildingId || rec.targetBuildingId === buildingId;
            if (matches) toRemove.push(id);
        }
        for (const id of toRemove) {
            this.removeConnection(id);
        }
        return toRemove.length;
    }

    // Remove any connections referencing the given record
    removeConnectionsForRecord(record) {
        if (!record) return 0;
        return this.removeConnectionsForBuilding(record.id);
    }
}
