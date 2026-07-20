import Phaser from 'phaser';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    preload() {
        // Load building sprite into the texture manager. Public path is at /processingplant.png
        this.load.image('processingPlant', '/processingplant.png');
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
        // Graphics for dragging preview
        this._dragGraphics = this.add.graphics({ x: 0, y: 0 });
        // Drag state separate from placement
        this._dragState = {
            active: false,       // pointer is down on a building and drag may start
            isDragging: false,    // true once threshold passed and moving
            startScreen: { x: 0, y: 0 },
            offsetWorld: { x: 0, y: 0 }, // pointer->container offset in world coords
            record: null,
            origGrid: { x: 0, y: 0 },
            threshold: 5 // pixels
        };
        this._hoverCell = null; // { ix, iy }
        this._selectedCell = null; // { ix, iy }
        // Buildings placed in the scene keyed by "x,y"
        this._buildings = new Map();
        this._nextBuildingId = 1;
        // Simple building definitions (kept small so Laravel can inject JSON later)
        // Refactored shape: { name, image, category, footprint }
        this._buildingDefs = {
            processUnit: {
                name: 'Process Unit',
                image: 'processingPlant',
                category: 'processing',
                footprint: [2, 2]
            }
        };
        // Placement mode flag toggled by HTML toolbar button
        this._placementMode = false;
        // Global toggle for showing building names
        this._showNames = false;
        // Currently hovered building record (used for temporary label visibility)
        this._hoveredRecord = null;
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

        // Pointer down: middle-button drag to pan, left-click may start a drag or select
        this.input.on('pointerdown', (pointer) => {
            // Middle-button starts camera drag
            if (pointer.middleButtonDown()) {
                this._cameraControls.dragging = true;
                this._cameraControls.dragStart = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
                return;
            }

            // Left-click: either place a building (when in placement mode) or start possible drag/select
            if (pointer.leftButtonDown()) {
                const world = cam.getWorldPoint(pointer.x, pointer.y);
                const gs = this._gridConfig;
                const ix = Math.floor(world.x / gs.minor);
                const iy = Math.floor(world.y / gs.minor);

                if (this._placementMode) {
                    const def = this._buildingDefs.processUnit;
                    const [fw, fh] = def.footprint;
                    // Check all cells in footprint for occupancy
                    let anyOccupied = false;
                    for (let dx = 0; dx < fw; dx++) {
                        for (let dy = 0; dy < fh; dy++) {
                            const k = `${ix + dx},${iy + dy}`;
                            if (this._buildings.has(k)) {
                                anyOccupied = true;
                                break;
                            }
                        }
                        if (anyOccupied) break;
                    }
                    if (!anyOccupied) {
                        this._placeBuilding(ix, iy, 'processUnit');
                    }
                    // do not perform selection while placing
                    return;
                }

                // Not in placement mode: check if clicked on a building to start a possible drag
                const key = `${ix},${iy}`;
                if (this._buildings.has(key)) {
                    const record = this._buildings.get(key);
                    // Start drag state (not yet dragging until threshold exceeded)
                    this._dragState.active = true;
                    this._dragState.isDragging = false;
                    this._dragState.startScreen = { x: pointer.x, y: pointer.y };
                    this._dragState.record = record;
                    this._dragState.origGrid = { x: record.gridX, y: record.gridY };
                    // compute pointer->container offset in world coordinates so preview keeps relative position
                    const containerWorldX = record.gridX * gs.minor;
                    const containerWorldY = record.gridY * gs.minor;
                    this._dragState.offsetWorld = { x: world.x - containerWorldX, y: world.y - containerWorldY };
                    // ensure selection marks original origin while dragging may not start
                    this._selectedCell = { ix: record.gridX, iy: record.gridY };
                    this._drawSelection();
                    return;
                }

                // Clicking empty space: normal selection
                this._selectedCell = { ix, iy };
                this._drawSelection();
            }
        });

        this.input.on('pointerup', (pointer) => {
            // Stop dragging on pointer up (for middle button release)
            if (!pointer.middleButtonDown()) {
                this._cameraControls.dragging = false;
            }

            // Handle left-button release for drag-to-move finalization/click
            if (pointer.leftButtonReleased()) {
                if (this._dragState.active) {
                    const gs = this._gridConfig;
                    const def = this._buildingDefs.processUnit;
                    const fw = def.footprint[0];
                    const fh = def.footprint[1];
                    const record = this._dragState.record;

                    if (this._dragState.isDragging) {
                        // compute destination grid from container position (snapped during drag)
                        const destIx = Math.floor(record.container.x / gs.minor);
                        const destIy = Math.floor(record.container.y / gs.minor);

                        // validate destination ignoring this record's current occupancy
                        let occupied = false;
                        for (let dx = 0; dx < fw; dx++) {
                            for (let dy = 0; dy < fh; dy++) {
                                const k = `${destIx + dx},${destIy + dy}`;
                                if (this._buildings.has(k)) {
                                    const r = this._buildings.get(k);
                                    if (r !== record) {
                                        occupied = true;
                                        break;
                                    }
                                }
                            }
                            if (occupied) break;
                        }

                        if (!occupied) {
                            // commit: remove old keys and set new ones
                            const origX = this._dragState.origGrid.x;
                            const origY = this._dragState.origGrid.y;
                            for (let dx = 0; dx < fw; dx++) {
                                for (let dy = 0; dy < fh; dy++) {
                                    const k = `${origX + dx},${origY + dy}`;
                                    const existing = this._buildings.get(k);
                                    if (existing === record) {
                                        this._buildings.delete(k);
                                    }
                                }
                            }

                            for (let dx = 0; dx < fw; dx++) {
                                for (let dy = 0; dy < fh; dy++) {
                                    const k = `${destIx + dx},${destIy + dy}`;
                                    this._buildings.set(k, record);
                                }
                            }

                            // update record coords
                            record.gridX = destIx;
                            record.gridY = destIy;

                            // keep selection on new origin
                            this._selectedCell = { ix: destIx, iy: destIy };
                            this._drawSelection();
                        } else {
                            // invalid move: return to original position
                            record.container.x = this._dragState.origGrid.x * gs.minor;
                            record.container.y = this._dragState.origGrid.y * gs.minor;
                            // keep selection at original
                            this._selectedCell = { ix: this._dragState.origGrid.x, iy: this._dragState.origGrid.y };
                            this._drawSelection();
                        }
                    } else {
                        // Pointer released without exceeding threshold -> treat as click: select building origin cell
                        const orig = this._dragState.origGrid;
                        this._selectedCell = { ix: orig.x, iy: orig.y };
                        this._drawSelection();
                    }

                    // Clear drag preview graphics and reset state
                    this._dragGraphics.clear();
                    this._dragState.active = false;
                    this._dragState.isDragging = false;
                    this._dragState.record = null;
                }
            }
        });

        this.input.on('pointermove', (pointer) => {
            // Camera panning with middle-button takes priority
            if (this._cameraControls.dragging) {
                const start = this._cameraControls.dragStart;
                // Move scroll in inverse of pointer movement, adjusted for zoom
                cam.scrollX = start.scrollX - (pointer.x - start.x) / cam.zoom;
                cam.scrollY = start.scrollY - (pointer.y - start.y) / cam.zoom;
                // update hover while panning
                this._updateHover(pointer);
                return;
            }

            // Handle possible building drag
            if (this._dragState.active && this._dragState.record) {
                const gs = this._gridConfig;
                const record = this._dragState.record;
                const start = this._dragState.startScreen;

                // If not yet considered dragging, check threshold (screen pixels)
                if (!this._dragState.isDragging) {
                    const dx = pointer.x - start.x;
                    const dy = pointer.y - start.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist >= this._dragState.threshold) {
                        this._dragState.isDragging = true;
                        // Optional visual hint
                        record.container.setDepth(1000);
                        record.container.setAlpha(0.95);
                    }
                }

                if (this._dragState.isDragging) {
                    // Compute desired world top-left position based on pointer and stored offset
                    const world = cam.getWorldPoint(pointer.x, pointer.y);
                    const desiredX = world.x - this._dragState.offsetWorld.x;
                    const desiredY = world.y - this._dragState.offsetWorld.y;
                    const destIx = Math.floor(desiredX / gs.minor);
                    const destIy = Math.floor(desiredY / gs.minor);

                    // Snap container for preview (do not change occupancy yet)
                    record.container.x = destIx * gs.minor;
                    record.container.y = destIy * gs.minor;

                    // Validate footprint occupancy while ignoring the dragged record's current cells
                    const def = this._buildingDefs.processUnit;
                    const [fw, fh] = def.footprint;
                    let occupied = false;
                    for (let dx = 0; dx < fw; dx++) {
                        for (let dy = 0; dy < fh; dy++) {
                            const k = `${destIx + dx},${destIy + dy}`;
                            if (this._buildings.has(k)) {
                                const r = this._buildings.get(k);
                                if (r !== record) {
                                    occupied = true;
                                    break;
                                }
                            }
                        }
                        if (occupied) break;
                    }

                    // Draw preview footprint using drag graphics
                    const g = this._dragGraphics;
                    g.clear();
                    const fillColor = occupied ? 0xff0000 : 0x10b981;
                    const fillAlpha = occupied ? 0.16 : 0.18;
                    g.fillStyle(fillColor, fillAlpha);
                    g.fillRect(destIx * gs.minor, destIy * gs.minor, fw * gs.minor, fh * gs.minor);
                    g.lineStyle(2, 0xffffff, 0.12);
                    g.strokeRect(destIx * gs.minor + 1, destIy * gs.minor + 1, fw * gs.minor - 2, fh * gs.minor - 2);

                    // Keep selection highlighting on the preview origin
                    this._selectedCell = { ix: destIx, iy: destIy };
                    this._drawSelection();
                    return;
                }
            }

            // Always update hover cell under pointer when not dragging a building
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

        // Hook up Show Names toggle
        const showNamesBtn = document.getElementById('toggle-show-names-btn');
        if (showNamesBtn) {
            showNamesBtn.addEventListener('click', () => {
                this._showNames = !this._showNames;
                showNamesBtn.classList.toggle('active', this._showNames);
                showNamesBtn.setAttribute('aria-pressed', String(this._showNames));
                // Update visibility for all existing buildings
                this._updateLabelsVisibility();
            });
            // ensure Escape handling does not toggle this control; no extra Escape logic needed here
        }

        // Cancel an in-progress drag when Escape is pressed
        this.input.keyboard.on('keydown-ESC', () => {
            if (this._dragState && this._dragState.active && this._dragState.record) {
                const record = this._dragState.record;
                const gs = this._gridConfig;
                // return container to original position
                record.container.x = this._dragState.origGrid.x * gs.minor;
                record.container.y = this._dragState.origGrid.y * gs.minor;
                // clear preview and reset state
                this._dragGraphics.clear();
                this._dragState.active = false;
                this._dragState.isDragging = false;
                this._dragState.record = null;
                // restore selection to original origin
                this._selectedCell = { ix: this._dragState.origGrid.x, iy: this._dragState.origGrid.y };
                this._drawSelection();
            }
        });
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
            const def = this._buildingDefs.processUnit;
            const [fw, fh] = def.footprint;
            // Check if any of the footprint cells are occupied
            let occupied = false;
            for (let dx = 0; dx < fw; dx++) {
                for (let dy = 0; dy < fh; dy++) {
                    const k = `${ix + dx},${iy + dy}`;
                    if (this._buildings.has(k)) {
                        occupied = true;
                        break;
                    }
                }
                if (occupied) break;
            }

            // valid: green translucent; invalid: red translucent
            const fillColor = occupied ? 0xff0000 : 0x10b981;
            const fillAlpha = occupied ? 0.16 : 0.18;
            g.fillStyle(fillColor, fillAlpha);
            g.fillRect(ix * gs.minor, iy * gs.minor, fw * gs.minor, fh * gs.minor);
            // optional stroke for clarity around footprint
            g.lineStyle(2, 0xffffff, 0.12);
            g.strokeRect(ix * gs.minor + 1, iy * gs.minor + 1, fw * gs.minor - 2, fh * gs.minor - 2);
            // When placement mode, hovered building name handling is not needed
            // ensure any previous hover label is cleared
            if (this._hoveredRecord) {
                this._hoveredRecord = null;
                this._updateLabelsVisibility();
            }
            return;
        }

        // Default hover appearance when not placing: subtle fill
        const fillColor = 0xffffff;
        const fillAlpha = 0.08;
        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);

        // If hovering a building, temporarily show its label when global names hidden
        const key = `${ix},${iy}`;
        if (this._buildings.has(key)) {
            const record = this._buildings.get(key);
            if (this._hoveredRecord !== record) {
                this._hoveredRecord = record;
                this._updateLabelsVisibility();
            }
            return;
        }

        // No building hovered: clear hoveredRecord and update labels
        if (this._hoveredRecord) {
            this._hoveredRecord = null;
            this._updateLabelsVisibility();
        }
    };

    // Update label visibility for all unique building records
    PrototypeScene.prototype._updateLabelsVisibility = function () {
        const showGlobal = Boolean(this._showNames);
        const gs = this._gridConfig;

        // Build set of unique records (map has multiple keys per record)
        const seen = new Set();
        for (const rec of this._buildings.values()) {
            if (!rec || seen.has(rec)) continue;
            seen.add(rec);
            const label = rec.label;
            if (!label) continue;

            // Visible if global toggle on, or if this record is hovered, or if selected
            let visible = false;
            if (showGlobal) {
                visible = true;
            } else if (this._hoveredRecord === rec) {
                visible = true;
            } else if (this._selectedCell && this._selectedCell.ix === rec.gridX && this._selectedCell.iy === rec.gridY) {
                visible = true;
            }

            label.setVisible(visible);
        }
    };

    // Draw (or clear) the selection rectangle based on _selectedCell
    PrototypeScene.prototype._drawSelection = function () {
        const gs = this._gridConfig;
        const g = this._selectionGraphics;
        g.clear();
        if (!this._selectedCell) {
            // ensure labels reflect that nothing is selected
            this._updateLabelsVisibility();
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
        // Update label visibility so selected building's label is shown even when global hide is active
        this._updateLabelsVisibility();
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

    // Create a container anchored at the top-left corner of the origin cell
    const x = ix * gs.minor;
    const y = iy * gs.minor;
    const container = this.add.container(x, y);

    const [fw, fh] = def.footprint;

    // Add sprite centered across the full footprint and scaled to ~85% of footprint
    const textureKey = def.image;
    const centerX = (fw * gs.minor) / 2;
    const centerY = (fh * gs.minor) / 2 - 6;
    const img = this.add.image(centerX, centerY, textureKey);

    // Compute scale based on source image to preserve aspect ratio and fill 85% of footprint
    const texture = this.textures.get(textureKey);
    const maxWidth = fw * gs.minor * 0.85;
    const maxHeight = fh * gs.minor * 0.85;
    if (texture && texture.getSourceImage) {
        const src = texture.getSourceImage();
        if (src && src.width && src.height) {
            const scale = Math.min(maxWidth / src.width, maxHeight / src.height, 1);
            img.setScale(scale);
        } else {
            img.setDisplaySize(maxWidth, maxHeight);
        }
    } else {
        img.setDisplaySize(maxWidth, maxHeight);
    }
    img.setOrigin(0.5, 0.5);

    // Label centered above the full footprint (inside container)
    const labelX = centerX;
    const labelY = -6; // slightly above the top of the footprint
    const labelStyle = { fontSize: '10px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 2 };
    const label = this.add.text(labelX, labelY, def.name, labelStyle).setOrigin(0.5, 1);
    // Subtle shadow for readability
    label.setShadow(1, 1, '#000000', 2, false, true);

    container.add([img, label]);

    const record = { id, type: def.name, gridX: ix, gridY: iy, container, label };

    // Reserve all footprint cells in the occupancy map pointing to the same record
    for (let dx = 0; dx < fw; dx++) {
        for (let dy = 0; dy < fh; dy++) {
            const k = `${ix + dx},${iy + dy}`;
            this._buildings.set(k, record);
        }
    }

    // Ensure new building's label visibility follows the global setting
    this._updateLabelsVisibility();

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
