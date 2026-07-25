export default class PlacementController {
    constructor(scene, buildingManager) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this._placing = false;
        this._defKey = null;
        this._rotation = 0; // 0 or 90
        this._preview = { ix: null, iy: null, valid: false };
    }

    beginPlacement(defKey) {
        this._placing = true;
        this._defKey = defKey;
        this._rotation = 0;
        // Ensure hover preview starts
        try { this.scene._hoverGraphics.clear(); } catch (e) {}
    }

    cancelPlacement() {
        this._placing = false;
        this._defKey = null;
        this._rotation = 0;
        this._preview = { ix: null, iy: null, valid: false };
        try { this.scene._hoverGraphics.clear(); } catch (e) {}
        // clear toolbar active states
        try { document.querySelectorAll('.simulator-toolbar .toolbar-button.active').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); }); } catch (e) {}
    }

    isPlacing() {
        return Boolean(this._placing);
    }

    rotate() {
        this._rotation = this._rotation === 0 ? 90 : 0;
    }

    getGhost() {
        return { defKey: this._defKey, rotation: this._rotation, preview: this._preview };
    }

    _footprintFor(defKey) {
        const def = this.scene._buildingDefs[defKey] || this.scene._buildingDefs.processUnit;
        let [fw, fh] = def.footprint || [1,1];
        if (this._rotation === 90) {
            return [fh, fw];
        }
        return [fw, fh];
    }

    _canPlace(ix, iy) {
        if (!this._defKey) return false;
        const [fw, fh] = this._footprintFor(this._defKey);
        // If rotation applied, BuildingManager.canPlace may not understand rotation; implement footprint check here
        for (let dx = 0; dx < fw; dx++) {
            for (let dy = 0; dy < fh; dy++) {
                const rec = this.buildingManager.getMachineAt(ix + dx, iy + dy);
                if (rec) return false;
            }
        }
        return true;
    }

    handlePointerMove(pointer) {
        if (!this._placing) return;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        // If unchanged, do nothing
        if (this._preview.ix === ix && this._preview.iy === iy) return;
        this._preview.ix = ix; this._preview.iy = iy;

        const [fw, fh] = this._footprintFor(this._defKey);
        const canPlace = this._canPlace(ix, iy);

        const g = this.scene._hoverGraphics;
        if (!g) return;
        g.clear();
        const fillColor = canPlace ? 0x10b981 : 0xff0000;
        const fillAlpha = canPlace ? 0.18 : 0.16;
        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, fw * gs.minor, fh * gs.minor);
        g.lineStyle(2, 0xffffff, 0.12);
        g.strokeRect(ix * gs.minor + 1, iy * gs.minor + 1, fw * gs.minor - 2, fh * gs.minor - 2);

        this._preview.valid = canPlace;
        // keep selected cell highlighting on preview origin
        this.scene._selectedCell = { ix, iy };
        if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
    }

    handlePointerDown(pointer) {
        if (!this._placing) return;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        if (this._canPlace(ix, iy)) {
            this.buildingManager.placeMachine(ix, iy, this._defKey);
        }
        // end single placement
        this.cancelPlacement();
    }
}
