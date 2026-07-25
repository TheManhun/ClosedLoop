// GridSystem: encapsulates grid config, graphics creation, draw logic and conversions.
export class GridSystem {
    constructor(scene, eventBus, config = {}) {
        this.scene = scene;
        this.eventBus = eventBus || null;

        // Default config copied from original simulator.js values
        this.config = Object.assign({
            minor: 32,
            majorEvery: 5,
            minorColor: '#ffffff',
            minorAlpha: 0.06,
            majorColor: '#ffffff',
            majorAlpha: 0.14,
            minorThickness: 1,
            majorThickness: 1.5
        }, config);

        // Phaser Graphics used only for the grid
        this._gridGraphics = this.scene.add.graphics({ x: 0, y: 0 });
        // Track last camera state to avoid unnecessary redraws
        this._lastCamState = { x: null, y: null, zoom: null };
    }

    // Convert world coordinates to grid cell indexes
    worldToGrid(worldX, worldY) {
        const gx = Math.floor(worldX / this.config.minor);
        const gy = Math.floor(worldY / this.config.minor);
        return { ix: gx, iy: gy };
    }

    // Convert grid indexes to world top-left coordinates
    gridToWorld(ix, iy) {
        return { x: ix * this.config.minor, y: iy * this.config.minor };
    }

    // drawGrid(force = false) returns true if a visible grid was drawn
    drawGrid(force = false) {
        const cam = this.scene.cameras.main;
        const gs = this.config;
        const view = cam.worldView;
        if (!view || view.width === 0 || view.height === 0) return false;

        // Only redraw when camera scroll or zoom changed, unless forced.
        if (!force && this._lastCamState.x === cam.scrollX && this._lastCamState.y === cam.scrollY && this._lastCamState.zoom === cam.zoom) {
            return false;
        }

        this._lastCamState.x = cam.scrollX;
        this._lastCamState.y = cam.scrollY;
        this._lastCamState.zoom = cam.zoom;

        const g = this._gridGraphics;
        g.clear();

        const left = Math.floor(view.x / gs.minor) * gs.minor;
        const right = Math.ceil((view.x + view.width) / gs.minor) * gs.minor;
        const top = Math.floor(view.y / gs.minor) * gs.minor;
        const bottom = Math.ceil((view.y + view.height) / gs.minor) * gs.minor;

        const minorColor = parseInt(gs.minorColor.replace('#', ''), 16);
        const majorColor = parseInt(gs.majorColor.replace('#', ''), 16);

        // Draw minor lines
        g.lineStyle(gs.minorThickness, minorColor, gs.minorAlpha);
        g.beginPath();
        for (let x = left; x <= right; x += gs.minor) {
            g.moveTo(x, top);
            g.lineTo(x, bottom);
        }
        for (let y = top; y <= bottom; y += gs.minor) {
            g.moveTo(left, y);
            g.lineTo(right, y);
        }
        g.strokePath();

        // Draw major lines
        g.lineStyle(gs.majorThickness, majorColor, gs.majorAlpha);
        g.beginPath();
        const startXIndex = Math.floor(left / gs.minor);
        const startYIndex = Math.floor(top / gs.minor);
        for (let i = 0; i <= Math.ceil((right - left) / gs.minor); i++) {
            const x = left + i * gs.minor;
            const idx = startXIndex + i;
            if (((idx % gs.majorEvery) + gs.majorEvery) % gs.majorEvery === 0) {
                g.moveTo(x, top);
                g.lineTo(x, bottom);
            }
        }
        for (let j = 0; j <= Math.ceil((bottom - top) / gs.minor); j++) {
            const y = top + j * gs.minor;
            const idy = startYIndex + j;
            if (((idy % gs.majorEvery) + gs.majorEvery) % gs.majorEvery === 0) {
                g.moveTo(left, y);
                g.lineTo(right, y);
            }
        }
        g.strokePath();

        if (this.eventBus) {
            try { this.eventBus.emit('grid:drawn', { view, cam }); } catch (e) {}
        }

        return true;
    }

    // Set visibility of the grid graphics
    setVisible(visible) {
        this._gridGraphics.setVisible(Boolean(visible));
    }
}

export default GridSystem;
