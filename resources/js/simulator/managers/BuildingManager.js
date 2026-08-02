export default class BuildingManager {
    constructor(scene, gridSystem, buildingDefinitions, eventBus) {
        this.scene = scene;
        this.grid = gridSystem;
        this.defs = buildingDefinitions;
        this.eventBus = eventBus || null;

        // occupancy map: key "x,y" -> record (points to the record occupying that cell)
        this._occupancy = new Map();
        // records by id
        this._byId = new Map();
        this._nextId = 1;

        this._selectedId = null;
    }

    _key(ix, iy) { return `${ix},${iy}`; }

    isOccupied(ix, iy) {
        return this._occupancy.has(this._key(ix, iy));
    }

    canPlace(ix, iy, defKey, ignoreRecord = null) {
        const def = this.defs.get(defKey) || this.defs.get('processUnit');
        const fw = def.footprint[0];
        const fh = def.footprint[1];
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const k = this._key(ix + dx, iy + dy);
                if (this._occupancy.has(k)) {
                    const r = this._occupancy.get(k);
                    if (!ignoreRecord || r !== ignoreRecord) return false;
                }
            }
        }
        return true;
    }

    getMachineAt(ix, iy) {
        return this._occupancy.get(this._key(ix, iy));
    }

    getMachine(id) {
        return this._byId.get(id);
    }

    getPlacedMachines() {
        return Array.from(this._byId.values());
    }

    placeMachine(ix, iy, defKey) {
        if (!this.canPlace(ix, iy, defKey)) return null;
        let def = this.defs.get(defKey) || this.defs.get('processUnit');
        // If the resolved definition lacks engineering fields (e.g. annual_capacity),
        // allow the BuildingDefinitions aliasing to resolve to API-backed objects.
        // Do not special-case numeric ids here.
        const gs = this.grid.config;
        const id = this._nextId++;

        const x = ix * gs.minor;
        const y = iy * gs.minor;
        const container = this.scene.add.container(x, y);
        container.setDepth(500);

        const [fw, fh] = def.footprint;
        const textureKey = def.textureKey || def.image || 'processingPlant';
        const centerX = (fw * gs.minor) / 2;
        const centerY = (fh * gs.minor) / 2 - 6;
        // If texture missing, scene.textures.exists will let us fallback later
        const img = this.scene.add.image(centerX, centerY, textureKey);

        // Compute desired display size based on footprint while preserving aspect ratio
        const refFootprint = (this.defs.get('municipalWaste') && this.defs.get('municipalWaste').footprint) ? this.defs.get('municipalWaste').footprint : [4,4];
        const refW = refFootprint[0];
        const refH = refFootprint[1];
        let maxDisplayW = fw * gs.minor * 0.85;
        let maxDisplayH = fh * gs.minor * 0.85;
        if (fw < refW || fh < refH) {
            maxDisplayW = refW * gs.minor * 0.85;
            maxDisplayH = refH * gs.minor * 0.85;
        }

        // Preserve aspect ratio using natural texture size when available
        try {
            const tex = img.texture;
            const src = tex && tex.getSourceImage && tex.getSourceImage();
            const imgW = (src && src.width) || img.width || maxDisplayW;
            const imgH = (src && src.height) || img.height || maxDisplayH;
            const scale = Math.min(maxDisplayW / imgW, maxDisplayH / imgH);
            let finalScale = scale;
            if (defKey === 'distributionBoard' || def.type === 'power_distribution') {
                finalScale = (finalScale || 1) * 0.5;
            }
            if (isFinite(finalScale) && finalScale > 0) {
                img.setScale(finalScale);
            } else {
                img.setDisplaySize(maxDisplayW, maxDisplayH);
            }
        } catch (e) {
            img.setDisplaySize(maxDisplayW, maxDisplayH);
        }
        img.setOrigin(0.5, 0.5);
        container.add(img);

        const record = {
            id,
            type: def.name,
            defKey,
            gridX: ix,
            gridY: iy,
            container,
            label: null,
            permanent: def.permanent === true,
            deletable: def.deletable !== false,
            movable: def.movable !== false,
            suggestedNext: def.suggestedNext || []
        };

        // reserve occupancy
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const k = this._key(ix + dx, iy + dy);
                this._occupancy.set(k, record);
            }
        }

        this._byId.set(id, record);

        // initialize status
        record.status = 'neutral';
        record.connections = [];
        // External grid special metadata and temporary runtime values
        if (defKey === 'externalGrid') {
            record.isExternalGrid = true;
            // Use def-specified capacities/rates if present
            record.resourceId = def.resourceId || 'electricity';
            record.importCapacity = def.importCapacity || 0;
            record.exportCapacity = def.exportCapacity || 0;
            record.importCost = def.importCost || 0;
            record.exportRate = def.exportRate || 0;
            // current signed flow (negative = import into facility)
            record.flow = 0; // temporary default — 0 idle
        }
        if (defKey === 'distributionBoard' || def.type === 'power_distribution') {
            record.isDistributionBoard = true;
            record.maxInputConnections = Number(def.maxInputConnections ?? 1);
            record.maxOutputConnections = Number(def.maxOutputConnections ?? 4);
            record.ratedCapacity = Number(def.ratedCapacity ?? 20);
            record.incomingAvailablePower = 0;
            record.connectedDemand = 0;
            record.currentLoad = 0;
            record.remainingCapacity = Number(def.ratedCapacity ?? 20);
            record.overloaded = false;
            record.powerStatus = 'Offline';
        }
        if (typeof this.scene._updateMachineStatusVisual === 'function') this.scene._updateMachineStatusVisual(record);

        // If external grid, request cable update/creation
        if (record.isExternalGrid && this.scene._connectionManager && typeof this.scene._connectionManager.updateConnectionsForRecord === 'function') {
            try { this.scene._connectionManager.updateConnectionsForRecord(record); } catch (e) { console.warn('Update connections failed', e); }
        }

        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) { console.warn('Refresh power balance failed', e); }
        }
        if (typeof this.scene._refreshAnnualFlows === 'function') {
            try { this.scene._refreshAnnualFlows(); } catch (e) { console.warn('Refresh annual flows failed', e); }
        }

        return record;
    }

    moveMachine(record, destIx, destIy) {
        if (!record) return false;
        const def = this.defs.get(record.defKey) || this.defs.get('processUnit');
        const fw = def.footprint[0];
        const fh = def.footprint[1];

        if (!this.canPlace(destIx, destIy, record.defKey, record)) return false;

        // remove old keys
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const k = this._key(record.gridX + dx, record.gridY + dy);
                const existing = this._occupancy.get(k);
                if (existing === record) this._occupancy.delete(k);
            }
        }

        // set new keys
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const k = this._key(destIx + dx, destIy + dy);
                this._occupancy.set(k, record);
            }
        }

        record.gridX = destIx;
        record.gridY = destIy;
        record.container.x = destIx * this.grid.config.minor;
        record.container.y = destIy * this.grid.config.minor;

        if (this.scene._connectionManager && typeof this.scene._connectionManager.updateConnectionsForRecord === 'function') this.scene._connectionManager.updateConnectionsForRecord(record);

        return true;
    }

    removeMachine(record) {
        if (!record) return false;
        const def = this.defs.get(record.defKey) || this.defs.get('processUnit');
        const fw = def.footprint[0];
        const fh = def.footprint[1];

        // Remove connections if any
        if (this.scene._connectionManager && typeof this.scene._connectionManager.removeConnectionsForRecord === 'function') this.scene._connectionManager.removeConnectionsForRecord(record);

        // clear occupancy
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const k = this._key(record.gridX + dx, record.gridY + dy);
                const existing = this._occupancy.get(k);
                if (existing === record) this._occupancy.delete(k);
            }
        }

        // destroy container
        try { if (record.container && record.container.destroy) record.container.destroy(); } catch (e) { /* ignore */ }

        // remove from byId
        this._byId.delete(record.id);

        // clear selection if it was selected
        if (this._selectedId === record.id) {
            this.clearSelection();
        }

        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) { console.warn('Refresh power balance failed', e); }
        }
        if (typeof this.scene._refreshAnnualFlows === 'function') {
            try { this.scene._refreshAnnualFlows(); } catch (e) { console.warn('Refresh annual flows failed', e); }
        }

        return true;
    }

    selectMachine(record) {
        if (!record) return this.clearSelection();
        this._selectedId = record.id;
        // keep simulator visible selection compatible
        try { this.scene._selectedCell = { ix: record.gridX, iy: record.gridY }; } catch (e) {}
        if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
    }

    clearSelection() {
        this._selectedId = null;
        try { this.scene._selectedCell = null; } catch (e) {}
        if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
    }

    getSelectedMachine() {
        return this._byId.get(this._selectedId);
    }
}

// module default exported above
