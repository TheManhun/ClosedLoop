import Phaser from 'phaser';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    preload() {
        // Load building sprite into the texture manager. Public path is at /processingplant.png
        this.load.image('processingPlant', '/processingplant.png');
        // Municipal Waste Collection sprite
        this.load.image('trash', '/trash.png');
    }

    create() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, height / 2, 'Closed Loop Prototype', {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
        // Expose scene for debug hooks (used by chart/UI rendering)
        try { window.__simulatorScene = this; } catch (e) {}

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
        // Refactored shape: { name, image, category, footprint, permanent, deletable, movable, suggestedNext, placeable }
        this._buildingDefs = {
            municipalWaste: {
                name: 'Municipal Waste',
                // use the original trash sprite so Municipal Waste appears as before
                image: 'trash',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'MW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            technologyWaste: {
                name: 'Technology Waste',
                image: 'src_tw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'TW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            farmWaste: {
                name: 'Farm Waste',
                image: 'src_fw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'FW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            industrialWaste: {
                name: 'Industrial Waste',
                image: 'src_iw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'IW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            buildingWaste: {
                name: 'Building Waste',
                image: 'src_bw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'BW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            sewerage: {
                name: 'Sewerage',
                image: 'src_sw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'SW',
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            // Existing process unit
            processUnit: {
                name: 'Process Unit',
                image: 'processingPlant',
                category: 'process',
                footprint: [2, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                suggestedNext: []
            },
            sortingFacility: {
                name: 'Sorting Facility',
                image: 'sorting_facility',
                category: 'process',
                footprint: [3, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                suggestedNext: []
            }
            ,
            externalGrid: {
                name: 'External Grid',
                image: 'external_grid',
                category: 'infrastructure',
                footprint: [3, 2],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'GRID',
                suggestedNext: []
            }
        };
        // Generate simple placeholder textures for sources and sorting facility
        (function generatePlaceholders(scene) {
            const map = {
                src_mw: '#10b981',
                src_tw: '#3b82f6',
                src_fw: '#f59e0b',
                src_iw: '#ef4444',
                src_bw: '#8b5cf6',
                src_sw: '#06b6d4',
                sorting_facility: '#0b1220'
                ,
                external_grid: '#111827'
            };
            Object.keys(map).forEach((key) => {
                const color = map[key];
                const g = scene.add.graphics();
                const w = 128, h = 96, r = 8;
                g.fillStyle(parseInt(color.replace('#',''), 16), 1);
                g.fillRoundedRect(0, 0, w, h, r);
                g.lineStyle(2, 0xffffff, 0.06);
                g.strokeRoundedRect(0, 0, w, h, r);
                g.generateTexture(key, w, h);
                g.destroy();
            });
        })(this);
        // Placement mode flag toggled by toolbar selection
        this._placementMode = false;
        // Currently selected placement definition key (e.g. 'municipalWaste' or 'processUnit')
        this._placementDefKey = null;
        // Track whether the initial permanent source buildings have been placed
        this._initialSourcesPlaced = false;
        // Global toggle for showing building names
        this._showNames = false;
        // Currently hovered building record (used for temporary label visibility)
        this._hoveredRecord = null;
        this._lastCamState = { x: null, y: null, zoom: null };

        // Scene-wide settings and visual systems
        this._sceneSettings = {
            showMachineStatusColours: true
        };

        // Status colour palette for machine status backgrounds
        this._statusColours = {
            working: { colour: 0x39a96b, alpha: 0.20 },
            fault: { colour: 0xd64545, alpha: 0.20 },
            neutral: { colour: null, alpha: 0 }
        };

        // Power cable storage
        this._powerCables = new Map();

        // Hub power state (placeholder/debug)
        this._hubPowerState = { mode: 'import', importMW: 12.6, exportMW: 0, netMW: -12.6 };

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
                    // hide context menu if visible when camera drag starts
                    hideContextMenu();
                    return;
                }

            // Left-click: either place a building (when in placement mode) or start possible drag/select
            if (pointer.leftButtonDown()) {
                const world = cam.getWorldPoint(pointer.x, pointer.y);
                const gs = this._gridConfig;
                const ix = Math.floor(world.x / gs.minor);
                const iy = Math.floor(world.y / gs.minor);

                if (this._placementMode) {
                    const defKey = this._placementDefKey || 'processUnit';
                    const def = this._buildingDefs[defKey];
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
                        this._placeBuilding(ix, iy, defKey);
                    }
                    // do not perform selection while placing
                    return;
                }

                // Not in placement mode: check if clicked on a building to start a possible drag
                const key = `${ix},${iy}`;
                if (this._buildings.has(key)) {
                    const record = this._buildings.get(key);
                    // If record is not movable, treat as selection only
                    if (!record.movable) {
                        this._selectedCell = { ix: record.gridX, iy: record.gridY };
                        this._drawSelection();
                        return;
                    }
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
                    const record = this._dragState.record;
                    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
                    const fw = def.footprint[0];
                    const fh = def.footprint[1];

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
                            // Notify cable system that this building moved so cables redraw
                            if (typeof this._updateCablesForRecord === 'function') this._updateCablesForRecord(record);
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
                    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
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
        // Toolbar show/hide helpers
        const toolbarEl = document.getElementById('simulator-toolbar');
        function showToolbar() {
            if (toolbarEl) toolbarEl.style.display = '';
        }
        function hideToolbar() {
            if (toolbarEl) toolbarEl.style.display = 'none';
        }
        function toggleToolbar() {
            if (!toolbarEl) return;
            toolbarEl.style.display = toolbarEl.style.display === 'none' ? '' : 'none';
        }

        // Wire Process Unit placement button
        const placeProcessBtn = document.getElementById('place-process-unit-btn');
        if (placeProcessBtn) {
            placeProcessBtn.addEventListener('click', () => {
                // toggle placement mode specifically for processUnit
                this._placementMode = !this._placementMode;
                this._placementDefKey = this._placementMode ? 'processUnit' : null;
                placeProcessBtn.classList.toggle('active', this._placementMode);
                placeProcessBtn.setAttribute('aria-pressed', String(this._placementMode));
                if (this._placementMode) {
                    this._updateHover(this.input.activePointer);
                } else {
                    this._hoverGraphics.clear();
                }
            });
        }

        // Wire Sorting Facility placement button
        const placeSortingBtn = document.getElementById('place-sorting-facility-btn');
        if (placeSortingBtn) {
            placeSortingBtn.addEventListener('click', () => {
                this._placementMode = !this._placementMode;
                this._placementDefKey = this._placementMode ? 'sortingFacility' : null;
                placeSortingBtn.classList.toggle('active', this._placementMode);
                placeSortingBtn.setAttribute('aria-pressed', String(this._placementMode));
                if (this._placementMode) {
                    this._updateHover(this.input.activePointer);
                } else {
                    this._hoverGraphics.clear();
                }
            });
        }

        // Exit placement mode on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._placementMode) {
                this._placementMode = false;
                this._placementDefKey = null;
                if (placeProcessBtn) { placeProcessBtn.classList.remove('active'); placeProcessBtn.setAttribute('aria-pressed', 'false'); }
                this._hoverGraphics.clear();
            }
        });

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

        // Context menu implementation
        const scene = this;
        // Create context menu element
        function createContextMenu() {
            const el = document.createElement('div');
            el.id = 'simulator-context-menu';
            el.style.position = 'absolute';
            el.style.background = '#0b1220';
            el.style.color = '#fff';
            el.style.border = '1px solid rgba(255,255,255,0.08)';
            el.style.padding = '8px';
            el.style.zIndex = 10000;
            el.style.minWidth = '160px';
            el.style.display = 'none';
            el.style.fontSize = '13px';
            el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.7)';
            document.body.appendChild(el);
            return el;
        }

        if (!document.getElementById('simulator-context-menu')) {
            this._contextMenuEl = createContextMenu();
        } else {
            this._contextMenuEl = document.getElementById('simulator-context-menu');
        }

        function hideContextMenu() {
            if (scene._contextMenuEl) scene._contextMenuEl.style.display = 'none';
        }

        function clampMenuPosition(x, y, menuEl) {
            const root = document.getElementById('simulator-root');
            if (!root) return { x, y };
            const rect = root.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            let left = x;
            let top = y;
            if (left + menuRect.width > rect.right) {
                left = Math.max(rect.left, rect.right - menuRect.width - 8);
            }
            if (top + menuRect.height > rect.bottom) {
                top = Math.max(rect.top, rect.bottom - menuRect.height - 8);
            }
            // ensure within viewport too
            left = Math.max(8, left);
            top = Math.max(8, top);
            return { x: left, y: top };
        }

        function handleSuggestedMachine(defKey) {
            console.log('Suggested machine clicked:', defKey);
            // placeholder: future hook
        }

        function showContextMenuFor(targetType, targetRecord, clientX, clientY) {
            const el = scene._contextMenuEl;
            el.innerHTML = '';
            // Header / title
            const title = document.createElement('div');
            title.style.fontWeight = '600';
            title.style.marginBottom = '6px';
            if (targetRecord) {
                title.textContent = targetRecord.type || targetRecord.defKey || 'Building';
            } else {
                title.textContent = '';
            }
            if (title.textContent) el.appendChild(title);

            // Suggested next machines (driven by definition metadata)
            if (targetRecord && Array.isArray(targetRecord.suggestedNext) && targetRecord.suggestedNext.length > 0) {
                const sugLabel = document.createElement('div');
                sugLabel.style.marginBottom = '6px';
                sugLabel.textContent = 'Suggested Next Machine';
                el.appendChild(sugLabel);
                for (const s of targetRecord.suggestedNext) {
                    const btn = document.createElement('button');
                    btn.textContent = s.name || s.defKey || 'Suggested';
                    btn.style.display = 'block';
                    btn.style.width = '100%';
                    btn.style.marginBottom = '6px';
                    btn.onclick = () => handleSuggestedMachine(s.defKey);
                    el.appendChild(btn);
                }
            } else if (targetType === 'building') {
                const sugLabel = document.createElement('div');
                sugLabel.style.marginBottom = '6px';
                sugLabel.textContent = 'Suggested Next Machine';
                el.appendChild(sugLabel);
                const coming = document.createElement('div');
                coming.textContent = 'Coming Soon';
                coming.style.marginBottom = '6px';
                el.appendChild(coming);
            }

            // Delete option for deletable buildings (not for municipalWaste)
            if (targetRecord && targetRecord.deletable) {
                const delBtn = document.createElement('button');
                delBtn.textContent = 'Delete Building';
                delBtn.style.display = 'block';
                delBtn.style.width = '100%';
                delBtn.style.margin = '6px 0';
                delBtn.onclick = () => {
                    deleteBuilding(targetRecord);
                    hideContextMenu();
                };
                el.appendChild(delBtn);
            }

            // Toolbar toggle
            const toolbarBtn = document.createElement('button');
            const toolbarVisible = toolbarEl && toolbarEl.style.display !== 'none';
            toolbarBtn.textContent = toolbarVisible ? 'Hide Toolbar' : 'Show Toolbar';
            toolbarBtn.onclick = () => {
                if (toolbarVisible) hideToolbar(); else showToolbar();
                hideContextMenu();
            };
            el.appendChild(toolbarBtn);

            // Machine Status Colours toggle (global)
            const statusBtn = document.createElement('button');
            statusBtn.textContent = scene._sceneSettings.showMachineStatusColours ? 'Machine Status Colours: On' : 'Machine Status Colours: Off';
            statusBtn.style.display = 'block';
            statusBtn.style.width = '100%';
            statusBtn.style.margin = '6px 0';
            statusBtn.onclick = () => {
                scene._sceneSettings.showMachineStatusColours = !scene._sceneSettings.showMachineStatusColours;
                statusBtn.textContent = scene._sceneSettings.showMachineStatusColours ? 'Machine Status Colours: On' : 'Machine Status Colours: Off';
                // Update visuals for all machines without changing their status
                if (typeof scene._recomputeMachineStatuses === 'function') scene._recomputeMachineStatuses();
                hideContextMenu();
            };
            el.appendChild(statusBtn);

            // Ensure labels/selection update when menu is shown for a record
            if (targetRecord) {
                scene._selectedCell = { ix: targetRecord.gridX, iy: targetRecord.gridY };
                scene._drawSelection();
            }

            // Position and show
            el.style.display = 'block';
            // allow DOM to measure
            requestAnimationFrame(() => {
                const pos = clampMenuPosition(clientX, clientY, el);
                el.style.left = pos.x + 'px';
                el.style.top = pos.y + 'px';
            });
        }

        // Disable native context menu inside simulator area and show custom menu
        const rootEl = document.getElementById('simulator-root');
        if (rootEl) {
            rootEl.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                const rect = rootEl.getBoundingClientRect();
                const x = ev.clientX;
                const y = ev.clientY;
                // map to world to determine target
                const world = cam.getWorldPoint((x - rect.left) , (y - rect.top));
                const gs = this._gridConfig;
                const ix = Math.floor(world.x / gs.minor);
                const iy = Math.floor(world.y / gs.minor);
                const key = `${ix},${iy}`;
                if (this._buildings.has(key)) {
                    const rec = this._buildings.get(key);
                    showContextMenuFor('building', rec, x, y);
                    return;
                }
                showContextMenuFor('ground', null, x, y);
            });
        }

        // Shared delete function
        function deleteBuilding(record) {
            if (!record || !record.deletable) return;
            // Remove any attached power cables before destroying
            if (typeof scene._removeCablesForRecord === 'function') scene._removeCablesForRecord(record);
            const def = scene._buildingDefs[record.defKey] || scene._buildingDefs.processUnit;
            const fw = def.footprint[0];
            const fh = def.footprint[1];
            // remove occupancy keys that point to this record
            for (let dx = 0; dx < fw; dx++) {
                for (let dy = 0; dy < fh; dy++) {
                    const k = `${record.gridX + dx},${record.gridY + dy}`;
                    const existing = scene._buildings.get(k);
                    if (existing === record) {
                        scene._buildings.delete(k);
                    }
                }
            }
            // destroy container (label is child)
            if (record.container && record.container.destroy) record.container.destroy();
            // clear selection and visuals
            scene._selectedCell = null;
            scene._hoveredRecord = null;
            scene._drawSelection();
        }

        // Close context menu on left-click elsewhere or Escape
        document.addEventListener('pointerdown', (ev) => {
            const el = scene._contextMenuEl;
            if (!el) return;
            if (ev.button === 0) {
                if (!el.contains(ev.target)) hideContextMenu();
            }
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') hideContextMenu();
        });

        // Keyboard delete/backspace handling for deletable selected buildings
        document.addEventListener('keydown', (ev) => {
            // ignore if focused on input or editable element
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

            if ((ev.key === 'Delete' || ev.key === 'Backspace') && this._selectedCell) {
                const key = `${this._selectedCell.ix},${this._selectedCell.iy}`;
                const rec = this._buildings.get(key);
                if (rec && rec.deletable) {
                    ev.preventDefault();
                    deleteBuilding(rec);
                    hideContextMenu();
                }
            }
        });

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
            // Place the initial permanent source buildings once after the first visible grid render
            if (this._gridHasRendered && !this._initialSourcesPlaced) {
                const cam = this.cameras.main;
                const gs = this._gridConfig;
                const view = cam.worldView;

                // compute a readable 3x2 grid layout relative to viewport centre
                const centerX = view.x + view.width / 2;
                const centerIx = Math.floor(centerX / gs.minor);
                const startIx = centerIx - 14; // left-most column
                const startIy = Math.floor((view.y + gs.minor * 1.5) / gs.minor);

                const placements = [
                    { key: 'municipalWaste', ix: startIx + 0, iy: startIy + 0 },
                    { key: 'technologyWaste', ix: startIx + 6, iy: startIy + 0 },
                    { key: 'farmWaste', ix: startIx + 12, iy: startIy + 0 },
                    { key: 'industrialWaste', ix: startIx + 0, iy: startIy + 6 },
                    { key: 'buildingWaste', ix: startIx + 6, iy: startIy + 6 },
                    { key: 'sewerage', ix: startIx + 12, iy: startIy + 6 }
                ];

                for (const p of placements) {
                    // skip if a building of this defKey already exists
                    let exists = false;
                    for (const rec of this._buildings.values()) {
                        if (rec && rec.defKey === p.key) { exists = true; break; }
                    }
                    if (exists) continue;

                    const def = this._buildingDefs[p.key];
                    if (!def) continue;
                    const rec = this._placeBuilding(p.ix, p.iy, p.key);
                    if (rec) {
                        rec.permanent = def.permanent === true;
                        rec.deletable = def.deletable !== false;
                        rec.movable = def.movable !== false;
                    }
                }

                this._initialSourcesPlaced = true;
                // Place External Grid and a demo Process Unit and connect them with a power cable for the initial demo
                try {
                    const gridRec = this._placeBuilding(startIx + 18, startIy + 0, 'externalGrid');
                    if (gridRec) { gridRec.permanent = true; gridRec.deletable = false; gridRec.movable = true; }
                    // place a demo process unit nearby
                    const demoRec = this._placeBuilding(startIx + 18, startIy + 4, 'processUnit');
                    if (demoRec) { demoRec.permanent = false; demoRec.deletable = true; demoRec.movable = true; }
                    if (gridRec && demoRec && typeof this._createPowerCable === 'function') {
                        this._createPowerCable({ id: 'power-1', fromRecord: gridRec, toRecord: demoRec, energized: true, flowState: 'import', powerMW: 2.4 });
                    }
                    // Recompute statuses after initial wiring
                    if (typeof this._recomputeMachineStatuses === 'function') this._recomputeMachineStatuses();
                    if (typeof this._renderPowerIndicator === 'function') this._renderPowerIndicator();
                } catch (e) {
                    console.warn('Error placing initial External Grid demo:', e);
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
            const def = this._buildingDefs[this._placementDefKey || 'processUnit'];
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

    // Force all building sprites to display at the same footprint-relative size
    // so different source image dimensions appear consistently (matches `trash`).
    const maxWidth = fw * gs.minor * 0.85;
    const maxHeight = fh * gs.minor * 0.85;
    img.setDisplaySize(maxWidth, maxHeight);
    img.setOrigin(0.5, 0.5);

    // Label centered above the full footprint (inside container)
    const labelX = centerX;
    const labelY = -6; // slightly above the top of the footprint
    const labelStyle = { fontSize: '10px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 2 };
    const label = this.add.text(labelX, labelY, def.name, labelStyle).setOrigin(0.5, 1);
    // Subtle shadow for readability
    label.setShadow(1, 1, '#000000', 2, false, true);

    container.add([img, label]);

    // If definition provides a shortCode (for source/placeholders), render it centered over the image
    if (def.shortCode) {
        const codeText = this.add.text(centerX, centerY, def.shortCode, { fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
        container.add(codeText);
    }

    const record = {
        id,
        type: def.name,
        defKey,
        gridX: ix,
        gridY: iy,
        container,
        label,
        permanent: def.permanent === true,
        deletable: def.deletable !== false,
        movable: def.movable !== false,
        suggestedNext: def.suggestedNext || []
    };

// ---------------------------
// Machine status visuals and power cable system
// ---------------------------

PrototypeScene.prototype._ensureStatusBg = function (record) {
    if (!record) return;
    if (record.statusBg && record.statusBg.destroyed) record.statusBg = null;
    if (record.statusBg) return;
    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const pad = 6;
    const w = fw * gs.minor + pad;
    const h = fh * gs.minor + pad;
    const bg = this.add.graphics();
    // Draw rounded rect anchored so it sits behind the building
    const r = Math.min(12, Math.min(w, h) * 0.12);
    bg.fillStyle(0x000000, 0); // initial transparent
    bg.fillRoundedRect(-pad/2, -pad/2, w, h, r);
    bg.lineStyle(0, 0x000000, 0);
    // Ensure it doesn't capture pointer events
    try { bg.disableInteractive && bg.disableInteractive(); } catch (e) {}
    // Insert as first child so it appears behind image and label
    record.container.addAt(bg, 0);
    record.statusBg = bg;
};

PrototypeScene.prototype._updateMachineStatusVisual = function (record) {
    if (!record) return;
    this._ensureStatusBg(record);
    const bg = record.statusBg;
    if (!bg) return;
    const status = record.status || 'neutral';
    const cfg = this._statusColours[status] || this._statusColours.neutral;
    bg.clear();
    if (!this._sceneSettings.showMachineStatusColours || !cfg || !cfg.colour || cfg.alpha <= 0) {
        bg.setVisible(false);
        return;
    }
    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const pad = 6;
    const w = fw * gs.minor + pad;
    const h = fh * gs.minor + pad;
    const r = Math.min(12, Math.min(w, h) * 0.12);
    bg.fillStyle(cfg.colour, cfg.alpha);
    bg.fillRoundedRect(-pad/2, -pad/2, w, h, r);
    bg.setVisible(true);
};

PrototypeScene.prototype._updateAllStatusVisibility = function () {
    // Toggle visibility of all status backgrounds according to scene setting
    const seen = new Set();
    for (const rec of this._buildings.values()) {
        if (!rec || !rec.id) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        if (rec.statusBg) {
            rec.statusBg.setVisible(Boolean(this._sceneSettings.showMachineStatusColours));
        }
    }
};

PrototypeScene.prototype._isRecordConnectedToPower = function (record) {
    if (!record) return false;
    for (const cable of this._powerCables.values()) {
        if (!cable) continue;
        if (cable.fromRecord === record || cable.toRecord === record) return true;
    }
    return false;
};

PrototypeScene.prototype._recomputeMachineStatuses = function () {
    // Determine status for each unique building record
    const seen = new Set();
    for (const rec of this._buildings.values()) {
        if (!rec || !rec.id) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        // Permanent sources remain neutral
        if (rec.permanent) {
            rec.status = 'neutral';
        } else {
            rec.status = this._isRecordConnectedToPower(rec) ? 'working' : 'fault';
        }
        this._updateMachineStatusVisual(rec);
    }
};

PrototypeScene.prototype._getRecordCenter = function (rec) {
    const def = this._buildingDefs[rec.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const cx = rec.container.x + (fw * gs.minor) / 2;
    const cy = rec.container.y + (fh * gs.minor) / 2 - 6;
    return { x: cx, y: cy };
};

PrototypeScene.prototype._createPowerCable = function (model) {
    // model may include fromRecord/toRecord or building ids
    const id = model.id || `power-${Date.now()}`;
    const fromRec = model.fromRecord || Array.from(this._buildings.values()).find(r => r && r.id === model.fromBuildingId) || null;
    const toRec = model.toRecord || Array.from(this._buildings.values()).find(r => r && r.id === model.toBuildingId) || null;
    if (!fromRec || !toRec) return null;
    const cable = {
        id,
        type: 'power',
        fromRecord: fromRec,
        toRecord: toRec,
        energized: Boolean(model.energized),
        flowState: model.flowState || 'import',
        powerMW: Number(model.powerMW) || 0,
        _line: null,
        _hit: null,
        _bolt: null,
        _pulseTween: null,
        _pulseObj: null
    };

    // Graphics for the visible black cable
    const g = this.add.graphics();
    cable._line = g;
    // Invisible thicker hit area for interactions
    const h = this.add.graphics();
    cable._hit = h;

    // Bolt marker
    const boltStyle = { fontSize: '18px', color: '#ffffff' };
    const bolt = this.add.text(0,0,'⚡', boltStyle).setOrigin(0.5);
    bolt.setVisible(false);
    cable._bolt = bolt;

    // Draw/update function
    const scene = this;
    cable._redraw = function () {
        const a = scene._getRecordCenter(cable.fromRecord);
        const b = scene._getRecordCenter(cable.toRecord);
        g.clear();
        g.lineStyle(2, 0x000000, 1);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokePath();

        // hit area
        h.clear();
        h.lineStyle(8, 0x000000, 0);
        h.beginPath();
        h.moveTo(a.x, a.y);
        h.lineTo(b.x, b.y);
        h.strokePath();
        try { h.setInteractive(new Phaser.Geom.Line(a.x, a.y, b.x, b.y), Phaser.Geom.Line.Contains); } catch (e) {}

        // Position bolt initially
        if (cable.energized && cable._bolt) {
            cable._bolt.setVisible(true);
        } else if (cable._bolt) {
            cable._bolt.setVisible(false);
        }
    };

    // Hover tooltip handling
    const showTooltip = (pointer) => {
        if (!scene._powerTooltipEl) {
            const t = document.createElement('div');
            t.id = 'power-tooltip';
            t.style.position = 'absolute';
            t.style.background = '#0b1220';
            t.style.color = '#fff';
            t.style.padding = '8px';
            t.style.border = '1px solid rgba(255,255,255,0.06)';
            t.style.fontSize = '12px';
            t.style.zIndex = 10001;
            document.body.appendChild(t);
            scene._powerTooltipEl = t;
        }
        const t = scene._powerTooltipEl;
        const mode = cable.energized ? 'Energized' : 'No power';
        if (!cable.energized) {
            t.innerHTML = `<strong>Electrical Cable</strong><br>Status: No power`;
        } else {
            const flow = cable.flowState === 'import' ? `${cable.fromRecord.type} → ${cable.toRecord.type}` : `${cable.fromRecord.type} → ${cable.toRecord.type}`;
            const modeTxt = cable.flowState === 'export' ? 'Exporting' : (cable.flowState === 'import' ? 'Importing' : 'Balanced');
            t.innerHTML = `<strong>Electrical Cable</strong><br>Status: Energized<br>Flow: ${flow}<br>Power: ${cable.powerMW} MW<br>Mode: ${modeTxt}`;
        }
        t.style.left = (pointer.clientX + 12) + 'px';
        t.style.top = (pointer.clientY + 12) + 'px';
        t.style.display = 'block';
    };
    const hideTooltip = () => {
        if (scene._powerTooltipEl) scene._powerTooltipEl.style.display = 'none';
    };

    // Pointer events
    h.on('pointerover', function (pointer) { showTooltip(pointer); });
    h.on('pointerout', function () { hideTooltip(); });

    // Start/stop pulse animation helpers
    cable._startPulse = function () {
        // avoid duplicate tweens
        if (cable._pulseTween) return;
        if (!cable.energized) return;
        const a = scene._getRecordCenter(cable.fromRecord);
        const b = scene._getRecordCenter(cable.toRecord);
        const dir = cable.flowState === 'export' ? -1 : 1;
        const obj = { t: dir === 1 ? 0 : 1 };
        cable._pulseObj = obj;
        const dur = scene._getPulseInterval(cable.powerMW);
        cable._pulseTween = scene.tweens.add({
            targets: obj,
            t: dir === 1 ? 1 : 0,
            duration: dur,
            ease: 'Linear',
            repeat: -1,
            onUpdate: function () {
                const t = obj.t;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
                if (cable._bolt) cable._bolt.setPosition(x, y);
            }
        });
        // set bolt colour by flow state / hub mode
        if (cable.flowState === 'export') {
            cable._bolt.setStyle({ color: '#2f7df6' });
            cable._bolt.setStroke('#8fc5ff', 1.5);
        } else {
            cable._bolt.setStyle({ color: '#e34848' });
            try { cable._bolt.setStroke(null); } catch (e) {}
        }
    };

    cable._stopPulse = function () {
        if (cable._pulseTween) {
            try { scene.tweens.killTweensOf(cable._pulseObj); } catch (e) {}
            cable._pulseTween = null;
            cable._pulseObj = null;
        }
        if (cable._bolt) cable._bolt.setVisible(false);
    };

    // Attach cable to scene storage
    this._powerCables.set(id, cable);
    cable._redraw();

    // Start pulse if energized
    if (cable.energized) cable._startPulse();

    return cable;
};

PrototypeScene.prototype._removePowerCable = function (id) {
    const cable = this._powerCables.get(id);
    if (!cable) return;
    try { if (cable._pulseTween) this.tweens.killTweensOf(cable._pulseObj); } catch (e) {}
    if (cable._line && cable._line.destroy) cable._line.destroy();
    if (cable._hit && cable._hit.destroy) cable._hit.destroy();
    if (cable._bolt && cable._bolt.destroy) cable._bolt.destroy();
    this._powerCables.delete(id);
};

PrototypeScene.prototype._removeCablesForRecord = function (record) {
    const toRemove = [];
    for (const [id, cable] of this._powerCables.entries()) {
        if (cable.fromRecord === record || cable.toRecord === record) toRemove.push(id);
    }
    for (const id of toRemove) this._removePowerCable(id);
    // recompute machine statuses after removal
    this._recomputeMachineStatuses();
};

PrototypeScene.prototype._updateCablesForRecord = function (record) {
    for (const cable of this._powerCables.values()) {
        if (cable.fromRecord === record || cable.toRecord === record) {
            if (typeof cable._redraw === 'function') cable._redraw();
        }
    }
    // ensure bolts reposition if pulses active
    // also recompute statuses
    this._recomputeMachineStatuses();
    // update power indicator UI
    if (typeof this._renderPowerIndicator === 'function') this._renderPowerIndicator();
};

PrototypeScene.prototype._getPulseInterval = function (powerMW) {
    // Placeholder mapping; future scaling can use powerMW
    return 1100;
};

PrototypeScene.prototype.setDebugHubPowerMode = function (mode) {
    this._hubPowerState.mode = mode;
    // Simple behavior for demo: set all cables energized and flowState based on mode
    for (const cable of this._powerCables.values()) {
        if (mode === 'offline') {
            cable.energized = false;
            cable._stopPulse && cable._stopPulse();
        } else if (mode === 'import') {
            cable.energized = true;
            cable.flowState = 'import';
            cable._startPulse && cable._startPulse();
        } else if (mode === 'export') {
            cable.energized = true;
            cable.flowState = 'export';
            cable._startPulse && cable._startPulse();
        } else {
            cable.energized = true;
            cable.flowState = 'balanced';
            cable._startPulse && cable._startPulse();
        }
    }
    this._recomputeMachineStatuses();
    if (typeof this._renderPowerIndicator === 'function') this._renderPowerIndicator();
};

PrototypeScene.prototype._renderPowerIndicator = function () {
    const wrap = document.getElementById('power-indicator');
    if (!wrap) return;
    const state = this._hubPowerState || { mode: 'offline', importMW: 0, exportMW: 0, netMW: 0 };
    wrap.innerHTML = '';
    const icon = document.createElement('div');
    icon.style.fontSize = '18px';
    icon.style.marginBottom = '2px';
    const label = document.createElement('div');
    label.style.fontSize = '12px';
    label.style.lineHeight = '1.1';
    if (state.mode === 'import') {
        icon.textContent = '⚡';
        icon.style.color = '#e34848';
        label.innerHTML = '<strong>Power</strong><br>Importing<br>' + (state.importMW || 0) + ' MW';
    } else if (state.mode === 'export') {
        icon.textContent = '⚡';
        icon.style.color = '#2f7df6';
        icon.style.webkitTextStroke = '1px #8fc5ff';
        label.innerHTML = '<strong>Power</strong><br>Exporting<br>' + (state.exportMW || 0) + ' MW';
    } else if (state.mode === 'balanced') {
        icon.textContent = '⚡';
        icon.style.color = '#9ca3af';
        label.innerHTML = '<strong>Power</strong><br>Balanced<br>' + (state.netMW || 0) + ' MW';
    } else {
        icon.textContent = '⚡';
        icon.style.color = '#6b7280';
        label.innerHTML = '<strong>Power</strong><br>Offline';
    }
    wrap.appendChild(icon);
    wrap.appendChild(label);
};

    // Reserve all footprint cells in the occupancy map pointing to the same record
    for (let dx = 0; dx < fw; dx++) {
        for (let dy = 0; dy < fh; dy++) {
            const k = `${ix + dx},${iy + dy}`;
            this._buildings.set(k, record);
        }
    }

    // Ensure new building's label visibility follows the global setting
    this._updateLabelsVisibility();

    // Initialize status and visuals
    record.status = 'neutral';
    if (typeof this._updateMachineStatusVisual === 'function') this._updateMachineStatusVisual(record);

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

// Unresolved outputs donut chart renderer (independent from Phaser)
(function () {
    // Temporary chart weighting.
    // Future resource accounting will determine how solids, liquids and gases
    // are compared within the unresolved-output indicator.

    // Temporary equal weighting for source placeholders.
    // Future material accounting will calculate authoritative quantities
    // and determine how solids, liquids and gases contribute to the chart.
    let unresolvedOutputs = [
        { key: 'municipal-waste', name: 'Municipal Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'technology-waste', name: 'Technology Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'farm-waste', name: 'Farm Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'industrial-waste', name: 'Industrial Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'building-waste', name: 'Building Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'sewerage', name: 'Sewerage', phase: 'liquid', amount: 100, unit: 'ML', chartValue: 100 }
    ];

    function getColorForKey(key, index) {
        // Stable colour mapping for known sources
        const map = {
            'municipal-waste': '#10b981',
            'technology-waste': '#3b82f6',
            'farm-waste': '#f59e0b',
            'industrial-waste': '#ef4444',
            'building-waste': '#8b5cf6',
            'sewerage': '#06b6d4'
        };
        if (map[key]) return map[key];
        const fallback = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        return fallback[index % fallback.length];
    }

    function calculateUnresolvedTotal(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce((sum, it) => {
            const v = Number(it && it.chartValue);
            if (!isFinite(v) || v <= 0) return sum;
            return sum + v;
        }, 0);
    }

    function setUnresolvedOutputs(items) {
        if (!Array.isArray(items)) items = [];
        unresolvedOutputs = items.slice();
        renderUnresolvedOutputsChart();
    }

    function renderUnresolvedOutputsChart() {
        const svgWrap = document.querySelector('#unresolved-output-chart svg');
        const totalEl = document.getElementById('unresolved-output-total');
        const legendEl = document.getElementById('unresolved-output-legend');

        if (!svgWrap || !totalEl || !legendEl) return;

        // Clear existing
        while (svgWrap.firstChild) svgWrap.removeChild(svgWrap.firstChild);
        legendEl.textContent = '';

        const valid = Array.isArray(unresolvedOutputs) ? unresolvedOutputs.filter(it => {
            if (!it) return false;
            const v = Number(it.chartValue);
            return isFinite(v) && v > 0;
        }) : [];

        const total = calculateUnresolvedTotal(unresolvedOutputs);

        const size = 160;
        const cx = size / 2;
        const cy = size / 2;
        const radius = 60;
        const stroke = 20;
        const circumference = 2 * Math.PI * radius;

        // Background ring
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', String(cx));
        bg.setAttribute('cy', String(cy));
        bg.setAttribute('r', String(radius));
        bg.setAttribute('fill', 'none');
        bg.setAttribute('stroke', 'rgba(255,255,255,0.06)');
        bg.setAttribute('stroke-width', String(stroke));
        svgWrap.appendChild(bg);

        let ariaParts = [];

        if (valid.length === 0 || total === 0) {
            // Empty state: show only background and centre text
            totalEl.querySelector('strong').textContent = '0';
            // ensure unit/text matches spec
            const span = totalEl.querySelector('span'); if (span) span.textContent = 'unresolved';
            const note = document.createElement('div');
            note.className = 'unresolved-empty';
            note.textContent = 'No unresolved outputs currently tracked';
            legendEl.appendChild(note);
            svgWrap.setAttribute('aria-label', 'Unresolved outputs chart: none');
            return;
        }

        // Create segments
        let offset = 0; // in length units along circumference
        valid.forEach((it, idx) => {
            const v = Number(it.chartValue);
            const frac = v / total;
            const segLen = circumference * frac;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', String(cx));
            circle.setAttribute('cy', String(cy));
            circle.setAttribute('r', String(radius));
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', getColorForKey(it.key || '', idx));
            circle.setAttribute('stroke-width', String(stroke));
            circle.setAttribute('stroke-linecap', 'butt');
            // stroke-dasharray: segment length followed by remainder (so segment shows as slice)
            circle.setAttribute('stroke-dasharray', `${segLen} ${circumference}`);
            // offset measured from start of circle; rotate so start at top
            circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
            // apply dashoffset as negative offset so subsequent segments are shifted
            circle.setAttribute('stroke-dashoffset', String(-offset));

            svgWrap.appendChild(circle);

            offset += segLen;

            // Build legend row
            const row = document.createElement('div');
            row.className = 'unresolved-legend-row';

            const color = document.createElement('div');
            color.className = 'unresolved-legend-color';
            color.style.background = getColorForKey(it.key || '', idx);
            row.appendChild(color);

            // Name + phase badge (top) and details (amount + percent) under the name
            const nameWrap = document.createElement('div');
            nameWrap.className = 'unresolved-legend-main';

            const nameRow = document.createElement('div');
            nameRow.style.display = 'flex';
            nameRow.style.alignItems = 'center';

            const name = document.createElement('div');
            name.className = 'unresolved-legend-name';
            name.textContent = it.name || it.key || 'Unknown';
            nameRow.appendChild(name);

            // phase badges removed per design — volume is shown in details

            nameWrap.appendChild(nameRow);

            const details = document.createElement('div');
            details.className = 'unresolved-legend-details';
            const amountText = (isFinite(Number(it.amount)) ? `${it.amount}${it.unit ? ' ' + it.unit : ''}` : '-');
            const pct = Math.round(frac * 100);
            details.textContent = amountText + ' ' + pct + '%';
            nameWrap.appendChild(details);

            row.appendChild(nameWrap);

            legendEl.appendChild(row);

            ariaParts.push(`${it.name || it.key || 'Unknown'}, ${amountText}, ${pct} percent`);
        });

        // Centre display: placeholder percentage until authoritative accounting exists
        const centreStrong = totalEl.querySelector('strong');
        const centreSpan = totalEl.querySelector('span');
        if (centreStrong) centreStrong.textContent = '100%';
        if (centreSpan) centreSpan.textContent = 'unresolved';

        // Accessibility label summarising resources
        svgWrap.setAttribute('aria-label', `Unresolved outputs chart: ${ariaParts.join('; ')}`);
        // Update power indicator UI if the simulator scene is available
        try { if (window.__simulatorScene && typeof window.__simulatorScene._renderPowerIndicator === 'function') window.__simulatorScene._renderPowerIndicator(); } catch (e) {}
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderUnresolvedOutputsChart);
    } else {
        renderUnresolvedOutputsChart();
    }

    // Expose setter globally so future code can update the chart
    window.setUnresolvedOutputs = setUnresolvedOutputs;
    window.calculateUnresolvedTotal = calculateUnresolvedTotal;
    window.renderUnresolvedOutputsChart = renderUnresolvedOutputsChart;
})();
