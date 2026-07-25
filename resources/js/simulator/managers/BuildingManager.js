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
        const def = this.defs.get(defKey) || this.defs.get('processUnit');
        const gs = this.grid.config;
        const id = this._nextId++;

        const x = ix * gs.minor;
        const y = iy * gs.minor;
        const container = this.scene.add.container(x, y);

        const [fw, fh] = def.footprint;
        const textureKey = def.image;
        const centerX = (fw * gs.minor) / 2;
        const centerY = (fh * gs.minor) / 2 - 6;
        const img = this.scene.add.image(centerX, centerY, textureKey);

        const refFootprint = (this.defs.get('municipalWaste') && this.defs.get('municipalWaste').footprint) ? this.defs.get('municipalWaste').footprint : [4,4];
        const refW = refFootprint[0];
        const refH = refFootprint[1];
        let displayW = fw * gs.minor * 0.85;
        let displayH = fh * gs.minor * 0.85;
        if (fw < refW || fh < refH) {
            displayW = refW * gs.minor * 0.85;
            displayH = refH * gs.minor * 0.85;
        }
        img.setDisplaySize(displayW, displayH);
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
        if (typeof this.scene._updateMachineStatusVisual === 'function') this.scene._updateMachineStatusVisual(record);

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

        if (typeof this.scene._updateCablesForRecord === 'function') this.scene._updateCablesForRecord(record);

        return true;
    }

    removeMachine(record) {
        if (!record) return false;
        const def = this.defs.get(record.defKey) || this.defs.get('processUnit');
        const fw = def.footprint[0];
        const fh = def.footprint[1];

        // Remove cables if any
        if (typeof this.scene._removeCablesForRecord === 'function') this.scene._removeCablesForRecord(record);

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
