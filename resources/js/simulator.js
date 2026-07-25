import Phaser from 'phaser';
import { EventBus } from './simulator/core/EventBus.js';
import { GridSystem } from './simulator/core/GridSystem.js';
import { CameraController } from './simulator/core/CameraController.js';
import BuildingDefinitions from './simulator/data/BuildingDefinitions.js';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    preload() {
        // Load building and resource images from public/
        this.load.image('processingPlant', '/processingplant.png');
        this.load.image('trash', '/trash.png');
        this.load.image('sorting_facility', '/sorting.png');
        this.load.image('wastewater_headworks', '/waterwasteplant.png');
        // Resource images provided by user
        this.load.image('src_mw', '/trash.png');
        this.load.image('src_tw', '/e-waste.png');
        // Note: filename in public/ is 'scraptyrees.png' (typo variant), load that file
        this.load.image('src_st', '/scraptyrees.png');
        this.load.image('src_fw', '/farmwaste.png');
        this.load.image('src_iw', '/industrial_waste.png');
        this.load.image('src_bw', '/building_waste.png');
        this.load.image('src_sw', '/sewerage_waste.png');
        // External grid / substation
        this.load.image('external_grid', '/electricsubstation.png');
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

        // CameraController encapsulates camera pan/zoom/reset behavior
        this._cameraController = new CameraController(this, { minZoom: 0.5, maxZoom: 2.0, zoomSensitivity: 0.0015 });
        // Keep compatibility reference used throughout the scene
        this._cameraControls = this._cameraController.controls;

        // Grid responsibilities moved to GridSystem (incremental refactor)
        this._eventBus = new EventBus();
        this._gridSystem = new GridSystem(this, this._eventBus);
        // Keep compatibility reference used throughout the scene
        this._gridConfig = this._gridSystem.config;
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
        // Building definitions handled by BuildingDefinitions (keeps defaults and loads API machines)
        this._buildingDefinitions = new BuildingDefinitions();
        // Expose a compatibility object used by the rest of the scene
        this._buildingDefs = this._buildingDefinitions.getAll();

        const fetchScene = this;
        // Fire-and-forget: load remote machines and augment definitions; toolbar DOM rendering remains in simulator.js
        this._buildingDefinitions.init().then((machines) => {
            try {
                if (!Array.isArray(machines) || machines.length === 0) return;

                // Queue image loads for Phaser and extend building definitions to use scene image keys
                machines.forEach((m) => {
                    const id = String(m.id);
                    const imageKey = 'machine_' + id;
                    // Map DB record into internal buildingDef shape; preserve sensible defaults
                    fetchScene._buildingDefs[id] = Object.assign({
                        name: m.name || ('Machine ' + id),
                        image: imageKey,
                        category: 'process',
                        footprint: m.footprint || [2, 2],
                        permanent: !!m.permanent,
                        deletable: m.deletable !== false,
                        movable: m.movable !== false,
                        placeable: m.placeable !== false,
                        suggestedNext: []
                    }, fetchScene._buildingDefs[id] || {});

                    // Load image from public root using provided filename
                    if (m.image) {
                        try {
                            fetchScene.load.image(imageKey, '/' + m.image);
                        } catch (e) {
                            console.warn('Failed to queue image load for', m.image, e);
                        }
                    }
                });

                // Start the loader for any queued assets
                try { fetchScene.load.start(); } catch (e) { /* ignore */ }

                // Build toolbar DOM (simple buttons) if not present
                let toolbarEl = document.getElementById('simulator-toolbar');
                if (!toolbarEl) {
                    toolbarEl = document.createElement('div');
                    toolbarEl.id = 'simulator-toolbar';
                    toolbarEl.className = 'simulator-toolbar';
                    const wrapper = document.querySelector('.simulator-root-wrapper') || document.body;
                    wrapper.appendChild(toolbarEl);
                }

                // Helper to create a button for a machine
                function makeButton(defKey, def) {
                    const btn = document.createElement('button');
                    btn.className = 'toolbar-button';
                    btn.id = 'place-' + defKey + '-btn';
                    btn.textContent = def.name || defKey;
                    btn.setAttribute('aria-pressed', 'false');
                    btn.addEventListener('click', () => {
                        const expanded = !(fetchScene._placementMode && fetchScene._placementDefKey === defKey);
                        fetchScene._placementMode = expanded;
                        fetchScene._placementDefKey = expanded ? defKey : null;
                        // update active state on buttons
                        document.querySelectorAll('.simulator-toolbar .toolbar-button').forEach(b => {
                            b.classList.toggle('active', b === btn && expanded);
                            b.setAttribute('aria-pressed', String(b === btn && expanded));
                        });
                        if (fetchScene._placementMode) {
                            fetchScene._updateHover(fetchScene.input.activePointer);
                        } else {
                            try { fetchScene._hoverGraphics.clear(); } catch (e) {}
                        }
                    });
                    return btn;
                }

                // Populate toolbar buttons (only placeable machines)
                toolbarEl.innerHTML = '';
                machines.forEach((m) => {
                    const id = String(m.id);
                    const def = fetchScene._buildingDefs[id];
                    if (!def) return;
                    if (def.placeable) {
                        const btn = makeButton(id, def);
                        toolbarEl.appendChild(btn);
                    }
                });
            } catch (err) {
                console.error('Failed to load machines from API:', err);
                let msgEl = document.getElementById('simulator-api-error');
                if (!msgEl) {
                    msgEl = document.createElement('div');
                    msgEl.id = 'simulator-api-error';
                    msgEl.style.position = 'absolute';
                    msgEl.style.top = '48px';
                    msgEl.style.left = '8px';
                    msgEl.style.zIndex = 20000;
                    msgEl.style.background = 'rgba(255,75,75,0.9)';
                    msgEl.style.color = '#fff';
                    msgEl.style.padding = '6px 8px';
                    msgEl.style.borderRadius = '6px';
                    msgEl.style.fontSize = '13px';
                    msgEl.textContent = 'Could not load machine definitions from API — using built-in defaults.';
                    const wrapper = document.querySelector('.simulator-root-wrapper') || document.body;
                    wrapper.appendChild(msgEl);
                }
            }
        }).catch((err) => {
            console.error('Failed to load machines from API:', err);
            let msgEl = document.getElementById('simulator-api-error');
            if (!msgEl) {
                msgEl = document.createElement('div');
                msgEl.id = 'simulator-api-error';
                msgEl.style.position = 'absolute';
                msgEl.style.top = '48px';
                msgEl.style.left = '8px';
                msgEl.style.zIndex = 20000;
                msgEl.style.background = 'rgba(255,75,75,0.9)';
                msgEl.style.color = '#fff';
                msgEl.style.padding = '6px 8px';
                msgEl.style.borderRadius = '6px';
                msgEl.style.fontSize = '13px';
                msgEl.textContent = 'Could not load machine definitions from API — using built-in defaults.';
                const wrapper = document.querySelector('.simulator-root-wrapper') || document.body;
                wrapper.appendChild(msgEl);
            }
        });
        // Placeholders removed — images are loaded from public/ instead
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

        // Power system disabled — no cable visuals or hub state
        this._powerCables = null;
        this._hubPowerState = null;

        // Bind drawGrid to the scene update loop — but only redraw when camera changes.
        this.events.on('postupdate', this._drawGrid, this);

        // Track whether we've successfully rendered at least one visible grid.
        this._gridHasRendered = false;

        // Camera wheel/pan/reset handled by CameraController (see resources/js/simulator/core/CameraController.js)

        // Pointer down: camera controller handles middle-button drag; scene should ignore middle-button events
        this.input.on('pointerdown', (pointer) => {
                if (pointer.middleButtonDown()) {
                    // CameraController will handle drag start and context menu hiding.
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
                        // After placing exactly one building, exit placement mode and clear preview
                        this._placementMode = false;
                        this._placementDefKey = null;
                        try { this._hoverGraphics.clear(); } catch (e) {}
                        // Clear any toolbar button active states if present
                        try {
                            document.querySelectorAll('.simulator-toolbar .toolbar-button.active').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
                        } catch (e) {}
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
                        try { showMachineInfoFor(record); } catch (e) {}
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

                // Clicked empty ground: clear any selection
                this._selectedCell = null;
                this._drawSelection();

                // Clicking empty space: normal selection
                this._selectedCell = { ix, iy };
                this._drawSelection();
            }
        });

        this.input.on('pointerup', (pointer) => {

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
                        // show machine info for this building if available
                        try { const rec = this._buildings.get(`${orig.x},${orig.y}`); if (rec) showMachineInfoFor(rec); } catch (e) {}
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
            // Camera panning handled by CameraController; continue with building drag/hover logic

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

        // Camera reset handled by CameraController
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
                // clear selection as well
                try { this._selectedCell = null; this._drawSelection(); } catch (err) {}
                try { document.querySelectorAll('.simulator-toolbar .toolbar-button.active').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); }); } catch (e) {}
                try { this._hoverGraphics.clear(); } catch (e) {}
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

        // Expose for CameraController to call when a camera drag starts
        scene.hideContextMenu = hideContextMenu;

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
                // Also show machine info for this record when context menu opens
                try { showMachineInfoFor(targetRecord); } catch (e) { /* ignore */ }
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
            if (el) {
                if (ev.button === 0 && !el.contains(ev.target)) hideContextMenu();
            }
            // Also close machine info panel when clicking outside it
            const panel = document.getElementById('machine-info-panel');
            if (panel && ev.button === 0) {
                if (!panel.contains(ev.target)) {
                    panel.style.display = 'none';
                }
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
                    { key: 'scrapTyres', ix: startIx + 18, iy: startIy + 0 },
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
                    const gridRec = this._placeBuilding(startIx + 22, startIy + 0, 'externalGrid');
                    if (gridRec) { gridRec.permanent = true; gridRec.deletable = false; gridRec.movable = true; }
                    // Do not place demo process unit on load — only show external substation
                    if (typeof this._recomputeMachineStatuses === 'function') this._recomputeMachineStatuses();
                } catch (e) {
                    console.warn('Error placing initial External Grid demo:', e);
                }
            }
        }
}

// Draw grid function added to PrototypeScene prototype
// Returns true when a visible grid was drawn, false otherwise.
PrototypeScene.prototype._drawGrid = function (force) {
    if (!this._gridSystem) return false;
    return this._gridSystem.drawGrid(Boolean(force));
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
                        return;
                    }
                }
                if (occupied) break;
            }

            // Machine info panel: create or reuse
            function getOrCreateMachineInfoPanel() {
                let el = document.getElementById('machine-info-panel');
                if (el) return el;
                el = document.createElement('div');
                el.id = 'machine-info-panel';
                el.style.position = 'absolute';
                el.style.right = '12px';
                el.style.top = '12px';
                el.style.zIndex = 20000;
                el.style.minWidth = '280px';
                el.style.maxWidth = '420px';
                el.style.background = 'rgba(8,12,18,0.95)';
                el.style.color = '#fff';
                el.style.padding = '12px';
                el.style.borderRadius = '8px';
                el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
                el.style.fontSize = '13px';
                el.style.display = 'none';
                // Add a visible Close button in the top-right of the panel
                const closeBtn = document.createElement('button');
                closeBtn.textContent = 'Close';
                closeBtn.style.position = 'absolute';
                closeBtn.style.top = '8px';
                closeBtn.style.right = '8px';
                closeBtn.style.padding = '4px 8px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.addEventListener('click', () => { el.style.display = 'none'; });
                el.appendChild(closeBtn);
                document.body.appendChild(el);
                return el;
            }

            // Show machine details for a placed building record
            async function showMachineInfoFor(record) {
                if (!record || !record.defKey) return;
                const panel = getOrCreateMachineInfoPanel();
                panel.innerHTML = '<div>Loading machine data...</div>';
                panel.style.display = 'block';

                // Attempt to fetch by defKey (which is typically the machine id from DB)
                const id = encodeURIComponent(String(record.defKey));
                try {
                    const res = await fetch('/api/machines/' + id, { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('Fetch failed: ' + res.status + ' ' + res.statusText);
                    const m = await res.json();
                    if (!m) throw new Error('No machine data');
                    renderMachineInfo(panel, m, record);
                } catch (err) {
                    console.error('Failed to load machine info', err);
                    panel.innerHTML = '<div>Unable to load machine information.</div>';
                    // keep panel visible but don't crash
                }
            }

            function renderMachineInfo(panel, m, record) {
                panel.innerHTML = '';
                const title = document.createElement('div');
                title.style.fontSize = '16px';
                title.style.fontWeight = '700';
                title.style.marginBottom = '8px';
                title.textContent = m.name || 'Machine';
                panel.appendChild(title);

                if (m.description) {
                    const desc = document.createElement('div');
                    desc.style.marginBottom = '8px';
                    desc.textContent = m.description;
                    panel.appendChild(desc);
                }

                const meta = document.createElement('div');
                meta.style.marginBottom = '8px';
                meta.innerHTML = '<strong>Category:</strong> ' + (m.category || '—');
                panel.appendChild(meta);

                const pw = document.createElement('div');
                pw.style.marginBottom = '8px';
                pw.innerHTML = '<strong>Power required:</strong> ' + (m.power_required ?? '—') + '<br/><strong>Water required:</strong> ' + (m.water_required ?? '—');
                panel.appendChild(pw);

                // Inputs / Outputs (resources are expected to be flattened objects)
                const resources = Array.isArray(m.resources) ? m.resources : [];
                const inputs = resources.filter(r => (r.direction || '').toString().toLowerCase() === 'input');
                const outputs = resources.filter(r => (r.direction || '').toString().toLowerCase() === 'output');

                const listSection = document.createElement('div');
                listSection.style.marginBottom = '8px';

                // Inputs block
                const inHeader = document.createElement('div'); inHeader.style.fontWeight = '600'; inHeader.textContent = 'Inputs';
                listSection.appendChild(inHeader);
                if (!inputs.length) {
                    const none = document.createElement('div'); none.style.marginTop = '6px'; none.textContent = 'No inputs recorded.'; listSection.appendChild(none);
                } else {
                    const ul = document.createElement('ul'); ul.style.marginTop = '6px'; ul.style.marginBottom = '8px';
                    for (const it of inputs) {
                        const li = document.createElement('li');
                        const name = it.name || 'Resource';
                        const amountUnit = (it.amount !== undefined && it.amount !== null) ? (String(it.amount) + (it.unit ? (' ' + it.unit) : '')) : '';
                        li.textContent = name + (amountUnit ? (' — ' + amountUnit) : '');
                        if (it.category) { const cat = document.createElement('div'); cat.style.fontSize='12px'; cat.style.opacity=0.9; cat.textContent = it.category; li.appendChild(cat); }
                        if (it.description) { const d = document.createElement('div'); d.style.fontSize='13px'; d.style.marginTop='4px'; d.textContent = it.description; li.appendChild(d); }
                        ul.appendChild(li);
                    }
                    listSection.appendChild(ul);
                }

                // Outputs block
                const outHeader = document.createElement('div'); outHeader.style.fontWeight = '600'; outHeader.textContent = 'Outputs';
                listSection.appendChild(outHeader);
                if (!outputs.length) {
                    const none = document.createElement('div'); none.style.marginTop = '6px'; none.textContent = 'No outputs recorded.'; listSection.appendChild(none);
                } else {
                    const ul2 = document.createElement('ul'); ul2.style.marginTop = '6px'; ul2.style.marginBottom = '8px';
                    for (const it of outputs) {
                        const li = document.createElement('li');
                        const name = it.name || 'Resource';
                        const amountUnit = (it.amount !== undefined && it.amount !== null) ? (String(it.amount) + (it.unit ? (' ' + it.unit) : '')) : '';
                        li.textContent = name + (amountUnit ? (' — ' + amountUnit) : '');
                        if (it.category) { const cat = document.createElement('div'); cat.style.fontSize='12px'; cat.style.opacity=0.9; cat.textContent = it.category; li.appendChild(cat); }
                        if (it.description) { const d = document.createElement('div'); d.style.fontSize='13px'; d.style.marginTop='4px'; d.textContent = it.description; li.appendChild(d); }
                        ul2.appendChild(li);
                    }
                    listSection.appendChild(ul2);
                }

                panel.appendChild(listSection);

                // Links
                if (m.links && m.links.length) {
                    const h = document.createElement('div'); h.style.fontWeight='600'; h.textContent='Research/Links'; panel.appendChild(h);
                    for (const ln of m.links) {
                        const row = document.createElement('div');
                        row.style.marginTop = '8px';
                        const t = document.createElement('div'); t.style.fontWeight='600'; t.textContent = ln.title || 'Link'; row.appendChild(t);
                        const org = document.createElement('div'); org.style.fontSize='12px'; org.style.opacity=0.9; org.textContent = ln.organisation || ''; row.appendChild(org);
                        const verified = document.createElement('div'); verified.style.fontSize='12px'; verified.style.marginTop='4px'; verified.innerHTML = (ln.verified ? '<span style="color:#38b000">✓ Verified</span>' : '<span style="color:#9aa0a6">Unverified</span>'); row.appendChild(verified);
                        if (ln.description) { const d = document.createElement('div'); d.style.marginTop='6px'; d.style.fontSize='13px'; d.textContent = ln.description; row.appendChild(d); }
                        const btn = document.createElement('button'); btn.textContent = 'Open Link'; btn.style.marginTop='6px'; btn.onclick = () => { if (ln.url) window.open(ln.url, '_blank'); }; row.appendChild(btn);
                        panel.appendChild(row);
                    }
                }

                // Technologies
                const techs = (m.technologies || []);
                const techSection = document.createElement('div');
                techSection.style.marginTop = '8px';
                const techHeader = document.createElement('div');
                techHeader.style.fontWeight = '600';
                techHeader.textContent = 'Technologies';
                techSection.appendChild(techHeader);
                if (!techs.length) {
                    const none = document.createElement('div');
                    none.style.marginTop = '6px';
                    none.textContent = 'No technologies recorded.';
                    techSection.appendChild(none);
                } else {
                    for (const t of techs) {
                        const row = document.createElement('div');
                        row.style.marginTop = '8px';
                        const name = document.createElement('div'); name.style.fontWeight='700'; name.textContent = t.name || 'Technology'; row.appendChild(name);
                        const meta = document.createElement('div'); meta.style.fontSize='13px'; meta.style.opacity=0.95; meta.innerHTML = '<strong>Role:</strong> ' + (t.role || '—') + ' &nbsp; <strong>Category:</strong> ' + (t.category || '—') + ' &nbsp; <strong>Maturity:</strong> ' + (t.maturity_level || '—'); row.appendChild(meta);
                        if (t.description) { const d = document.createElement('div'); d.style.marginTop='6px'; d.textContent = t.description; row.appendChild(d); }
                        techSection.appendChild(row);
                    }
                }
                panel.appendChild(techSection);

                // Configure button if configurable
                if (m.configurable) {
                    const cfg = document.createElement('div'); cfg.style.marginTop = '10px';
                    const cfgBtn = document.createElement('button'); cfgBtn.textContent = 'Configure'; cfgBtn.style.fontWeight='600';
                    cfgBtn.onclick = () => {
                        try {
                            // If the factory editor exists, open it but do NOT auto-create components.
                            // Associating a persistent per-building component/config is not implemented yet.
                            const fe = window.__factoryEditor;
                            if (fe) {
                                const root = document.getElementById('factory-editor-root');
                                if (root) root.style.display = '';
                                // If a component already exists that appears associated with this record, select it.
                                // (No association system implemented — we avoid creating duplicates.)
                                // Provide a clear message in the machine info panel about missing persistence.
                                const panel = document.getElementById('machine-info-panel');
                                if (panel) {
                                    const note = document.createElement('div');
                                    note.style.marginTop = '8px';
                                    note.style.fontSize = '13px';
                                    note.style.opacity = '0.9';
                                    note.textContent = 'Factory editor opened. Per-building saved configuration is not implemented yet.';
                                    panel.appendChild(note);
                                }
                                return;
                            }

                            // Fallback: dispatch event so other code can handle configuration
                            const ev = new CustomEvent('machine:configure', { detail: { machine: m, record } });
                            window.dispatchEvent(ev);
                        } catch (e) {
                            console.warn('machine configure handler failed', e);
                        }
                    };
                    cfg.appendChild(cfgBtn);
                    panel.appendChild(cfg);
                }
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

    // Force building sprites to display at a consistent footprint-relative size.
    // If a building uses a smaller footprint than the municipal waste source,
    // upscale it so resource images appear the same size as the trash squares.
    const refFootprint = (this._buildingDefs && this._buildingDefs.municipalWaste && this._buildingDefs.municipalWaste.footprint) ? this._buildingDefs.municipalWaste.footprint : [4, 4];
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

    // Add sprite only (no persistent name label or shortCode)
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

// Power connections removed — machine statuses default to working (non-permanent) or neutral (permanent)
PrototypeScene.prototype._recomputeMachineStatuses = function () {
    const seen = new Set();
    for (const rec of this._buildings.values()) {
        if (!rec || !rec.id) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        if (rec.permanent) {
            rec.status = 'neutral';
        } else {
            rec.status = 'working';
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

// Power cable creation disabled — stub
PrototypeScene.prototype._createPowerCable = function (model) { return null; };

// Power cable operations are no-ops in this simplified UI
PrototypeScene.prototype._removePowerCable = function (id) { return; };
PrototypeScene.prototype._removeCablesForRecord = function (record) { this._recomputeMachineStatuses(); };
PrototypeScene.prototype._updateCablesForRecord = function (record) { this._recomputeMachineStatuses(); };

PrototypeScene.prototype._getPulseInterval = function (powerMW) {
    // Placeholder mapping; future scaling can use powerMW
    return 1100;
};

PrototypeScene.prototype.setDebugHubPowerMode = function (mode) {
    // Disabled — power UI removed
    this._recomputeMachineStatuses();
};

// Power indicator removed — no-op
PrototypeScene.prototype._renderPowerIndicator = function () { return; };

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
        // Power indicator removed — no-op
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
