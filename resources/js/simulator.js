import Phaser from 'phaser';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    create() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, height / 2, 'Closed Loop Prototype', {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const cam = this.cameras.main;

        // Start camera centered on the scene
        cam.centerOn(width / 2, height / 2);

        // Do NOT reposition world objects on resize — camera will resize the viewport only.
        // Leave titleText at its initial world position.

        // Camera controls
        this._cameraControls = {
            dragging: false,
            dragStart: { x: 0, y: 0, scrollX: 0, scrollY: 0 },
            minZoom: 0.5,
            maxZoom: 2.0,
            zoomSensitivity: 0.0015,
        };

        // Grid configuration (easy to tune later)
        this._gridConfig = {
            minor: 32, // world units between minor grid lines
            majorEvery: 5, // major line every N minor lines
            minorColor: '#ffffff',
            minorAlpha: 0.06,
            majorColor: '#ffffff',
            majorAlpha: 0.14,
            minorThickness: 1,
            majorThickness: 1.5,
        };

        // Graphics object used to draw the grid. We clear and redraw it when camera moves/zooms.
        this._gridGraphics = this.add.graphics({ x: 0, y: 0 });
        // Graphics for hover and selection (reused objects)
        this._hoverGraphics = this.add.graphics({ x: 0, y: 0 });
        this._selectionGraphics = this.add.graphics({ x: 0, y: 0 });
        this._hoverCell = null; // { ix, iy }
        this._selectedCell = null; // { ix, iy }
        // Buildings placed in the scene keyed by "x,y"
        this._buildings = new Map();
        this._nextBuildingId = 1;
        // Simple building definitions (kept small so Laravel can inject JSON later)
        this._buildingDefs = {
            processUnit: { key: 'process-unit', name: 'Process Unit' }
        };
        // Placement mode flag toggled by HTML toolbar button
        this._placementMode = false;
        this._lastCamState = { x: null, y: null, zoom: null };

        // Bind drawGrid to the scene update loop — but only redraw when camera changes.
        this.events.on('postupdate', this._drawGrid, this);

        // Track whether we've successfully rendered at least one visible grid.
        this._gridHasRendered = false;

        // Wheel to zoom (cursor-centred using world coordinates)
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const controls = this._cameraControls;
            const prevZoom = cam.zoom;
            const newZoom = Phaser.Math.Clamp(prevZoom - deltaY * controls.zoomSensitivity * prevZoom, controls.minZoom, controls.maxZoom);

            if (newZoom === prevZoom) {
                return;
            }

            // World point under the pointer before zoom
            const before = cam.getWorldPoint(pointer.x, pointer.y);

            // Apply zoom
            cam.setZoom(newZoom);

            // World point under the pointer after zoom
            const after = cam.getWorldPoint(pointer.x, pointer.y);

            // Adjust camera scroll by the difference so the world point under the cursor remains stationary
            cam.scrollX += before.x - after.x;
            cam.scrollY += before.y - after.y;

            // Update hover after zoom so highlight stays under pointer
            this._updateHover(pointer);
        });

        // Pointer down: middle-button drag to pan, left-click to select a cell
        this.input.on('pointerdown', (pointer) => {
            // Middle-button starts camera drag
            if (pointer.middleButtonDown()) {
                this._cameraControls.dragging = true;
                this._cameraControls.dragStart = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
                return;
            }

            // Left-click: either place a building (when in placement mode) or select a cell
            if (pointer.leftButtonDown()) {
                const world = cam.getWorldPoint(pointer.x, pointer.y);
                const gs = this._gridConfig;
                const ix = Math.floor(world.x / gs.minor);
                const iy = Math.floor(world.y / gs.minor);

                if (this._placementMode) {
                    const key = `${ix},${iy}`;
                    if (!this._buildings.has(key)) {
                        this._placeBuilding(ix, iy, 'processUnit');
                    }
                    // do not perform selection while placing
                    return;
                }

                // Normal selection behavior when not placing
                this._selectedCell = { ix, iy };
                this._drawSelection();
            }
        });

        this.input.on('pointerup', (pointer) => {
            // Stop dragging on pointer up (for middle button release)
            if (!pointer.middleButtonDown()) {
                this._cameraControls.dragging = false;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this._cameraControls.dragging) {
                const start = this._cameraControls.dragStart;
                // Move scroll in inverse of pointer movement, adjusted for zoom
                cam.scrollX = start.scrollX - (pointer.x - start.x) / cam.zoom;
                cam.scrollY = start.scrollY - (pointer.y - start.y) / cam.zoom;
            }

            // Always update hover cell under pointer (keeps alignment while panning/zooming)
            this._updateHover(pointer);
        });

        // Reset camera with R key: zoom 1 and center on the prototype text
        this.input.keyboard.on('keydown-R', () => {
            cam.setZoom(1);
            cam.centerOn(this.titleText.x, this.titleText.y);
        });
        // Hook up placement toolbar button (if present in the DOM)
        const placeBtn = document.getElementById('place-process-unit-btn');
        if (placeBtn) {
            placeBtn.addEventListener('click', () => {
                this._placementMode = !this._placementMode;
                placeBtn.classList.toggle('active', this._placementMode);
                placeBtn.setAttribute('aria-pressed', String(this._placementMode));
                // refresh hover immediately so preview shows under pointer
                if (this._placementMode) {
                    this._updateHover(this.input.activePointer);
                } else {
                    this._hoverGraphics.clear();
                }
            });

            // Exit placement mode on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this._placementMode) {
                    this._placementMode = false;
                    placeBtn.classList.remove('active');
                    placeBtn.setAttribute('aria-pressed', 'false');
                    this._hoverGraphics.clear();
                }
            });
        }
        }

        update() {
            // Force the first grid draw from the update loop until we have a valid rendered grid.
            if (!this._gridHasRendered) {
                const drawn = this._drawGrid(true);
                if (drawn) {
                    this._gridHasRendered = true;
                }
            }
        }
}

// Draw grid function added to PrototypeScene prototype
// Returns true when a visible grid was drawn, false otherwise.
PrototypeScene.prototype._drawGrid = function (force) {
    const cam = this.cameras.main;
    const gs = this._gridConfig;

    const view = cam.worldView;
    // If worldView not ready, do not mark as rendered.
    if (!view || view.width === 0 || view.height === 0) {
        return false;
    }

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

    // Draw minor lines in one pass
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

    // Draw major lines on top
    g.lineStyle(gs.majorThickness, majorColor, gs.majorAlpha);
    g.beginPath();
    // compute index offset for negative coordinates
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

    return true;
};

    // Update hover graphics for the cell under the given pointer
    PrototypeScene.prototype._updateHover = function (pointer) {
        const cam = this.cameras.main;
        const gs = this._gridConfig;
        // Convert screen pointer to world coordinates
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        // If hover cell unchanged, nothing to do
        if (this._hoverCell && this._hoverCell.ix === ix && this._hoverCell.iy === iy) {
            return;
        }

        this._hoverCell = { ix, iy };

        const g = this._hoverGraphics;
        g.clear();

        // If placement mode active, show placement preview (valid vs invalid)
        if (this._placementMode) {
            const key = `${ix},${iy}`;
            const occupied = this._buildings.has(key);
            // valid: green translucent; invalid: red translucent
            const fillColor = occupied ? 0xff0000 : 0x10b981;
            const fillAlpha = occupied ? 0.16 : 0.18;
            g.fillStyle(fillColor, fillAlpha);
            g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);
            // optional stroke for clarity
            g.lineStyle(2, 0xffffff, 0.12);
            g.strokeRect(ix * gs.minor + 1, iy * gs.minor + 1, gs.minor - 2, gs.minor - 2);
            return;
        }

        // Default hover appearance when not placing: subtle fill
        const fillColor = 0xffffff;
        const fillAlpha = 0.08;
        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);
    };

    // Draw (or clear) the selection rectangle based on _selectedCell
    PrototypeScene.prototype._drawSelection = function () {
        const gs = this._gridConfig;
        const g = this._selectionGraphics;
        g.clear();
        if (!this._selectedCell) {
            return;
        }
        const { ix, iy } = this._selectedCell;

        // selection: semi-opaque fill + thin stroke
        const fillColor = 0xffffff;
        const fillAlpha = 0.16;
        const strokeColor = 0xffffff;
        const strokeAlpha = 0.28;
        const strokeThickness = Math.max(1, gs.minorThickness);

        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);
        g.lineStyle(strokeThickness, strokeColor, strokeAlpha);
        g.strokeRect(ix * gs.minor + 0.5, iy * gs.minor + 0.5, gs.minor - 1, gs.minor - 1);
    };

// Place a building at grid coordinates ix,iy if unoccupied
PrototypeScene.prototype._placeBuilding = function (ix, iy, defKey) {
    const key = `${ix},${iy}`;
    if (this._buildings.has(key)) {
        return null;
    }

    const def = this._buildingDefs[defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const id = this._nextBuildingId++;

    // Create a container anchored at the top-left corner of the cell
    const x = ix * gs.minor;
    const y = iy * gs.minor;
    const container = this.add.container(x, y);

    // Rectangle centered inside the cell
    const rect = this.add.rectangle(gs.minor / 2, gs.minor / 2, gs.minor - 6, gs.minor - 6, 0x1f2937);
    rect.setStrokeStyle(2, 0xffffff, 0.12);
    const label = this.add.text(gs.minor / 2, gs.minor / 2, def.name, { fontSize: '10px', color: '#ffffff', align: 'center' }).setOrigin(0.5);

    container.add([rect, label]);

    const record = { id, type: def.name, gridX: ix, gridY: iy, container };
    this._buildings.set(key, record);

    return record;
};


const config = {
    type: Phaser.AUTO,
    parent: 'simulator-root',
    backgroundColor: '#0f172a',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PrototypeScene]
};

new Phaser.Game(config);
