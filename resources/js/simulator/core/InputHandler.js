export default class InputHandler {
    constructor(scene, buildingManager, cameraController) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this.cameraController = cameraController;

        // Input-local state
        this._dragState = {
            active: false,
            isDragging: false,
            startScreen: { x: 0, y: 0 },
            offsetWorld: { x: 0, y: 0 },
            record: null,
            origGrid: { x: 0, y: 0 },
            threshold: 5
        };

        this._hoverCell = null;

        // Bind handlers
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onEsc = this._onEsc.bind(this);
        this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);

        // Register Phaser pointer handlers
        try {
            this.scene.input.on('pointerdown', this._onPointerDown);
            this.scene.input.on('pointermove', this._onPointerMove);
            this.scene.input.on('pointerup', this._onPointerUp);
        } catch (e) {
            console.warn('InputHandler: failed to register pointer handlers', e);
        }

        // Keyboard: document-level handlers for Delete/Backspace and placement Escape
        document.addEventListener('keydown', this._onKeyDown);
        // Document pointerdown for closing context/menu and machine info panel
        document.addEventListener('pointerdown', this._onDocumentPointerDown);

        // DOM contextmenu inside simulator root
        try {
            const rootEl = document.getElementById('simulator-root');
            if (rootEl) rootEl.addEventListener('contextmenu', this._onContextMenu);
        } catch (e) {}

        // Phaser keyboard ESC (scene scoped) to cancel drags
        try { this.scene.input.keyboard.on('keydown-ESC', this._onEsc); } catch (e) {}
    }

    destroy() {
        try {
            this.scene.input.off('pointerdown', this._onPointerDown);
            this.scene.input.off('pointermove', this._onPointerMove);
            this.scene.input.off('pointerup', this._onPointerUp);
        } catch (e) {}
        try { this.scene.input.keyboard.off('keydown-ESC', this._onEsc); } catch (e) {}
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('pointerdown', this._onDocumentPointerDown);
        try {
            const rootEl = document.getElementById('simulator-root');
            if (rootEl) rootEl.removeEventListener('contextmenu', this._onContextMenu);
        } catch (e) {}
    }

    _onPointerDown(pointer) {
        // Let CameraController handle middle-button panning
        if (pointer.middleButtonDown && pointer.middleButtonDown()) return;

        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        // Placement mode delegated to PlacementController when present
        if (this.scene._placementController && this.scene._placementController.isPlacing()) {
            try { this.scene._placementController.handlePointerDown(pointer); } catch (e) { /* ignore */ }
            return;
        }

        // Not placing: check for building click to start drag/select
        const record = this.buildingManager.getMachineAt(ix, iy);
        if (record) {
            if (!record.movable) {
                this.scene._selectedCell = { ix: record.gridX, iy: record.gridY };
                if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
                try { if (typeof this.scene.showMachineInfoFor === 'function') this.scene.showMachineInfoFor(record); } catch (e) {}
                return;
            }

            // Start drag
            this._dragState.active = true;
            this._dragState.isDragging = false;
            this._dragState.startScreen = { x: pointer.x, y: pointer.y };
            this._dragState.record = record;
            this._dragState.origGrid = { x: record.gridX, y: record.gridY };
            const containerWorldX = record.gridX * gs.minor;
            const containerWorldY = record.gridY * gs.minor;
            this._dragState.offsetWorld = { x: world.x - containerWorldX, y: world.y - containerWorldY };
            this.scene._selectedCell = { ix: record.gridX, iy: record.gridY };
            if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
            return;
        }

        // Clicked empty ground: clear selection
        this.scene._selectedCell = null;
        if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
        this.scene._selectedCell = { ix, iy };
        if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
    }

    _onPointerMove(pointer) {
        const cam = this.scene.cameras.main;
        const gs = this.scene._gridConfig;

        // If dragging, handle preview
        if (this._dragState.active) {
            // Check threshold
            if (!this._dragState.isDragging) {
                const dx = pointer.x - this._dragState.startScreen.x;
                const dy = pointer.y - this._dragState.startScreen.y;
                const dist = Math.hypot(dx, dy);
                if (dist >= this._dragState.threshold) {
                    this._dragState.isDragging = true;
                    if (this._dragState.record && this._dragState.record.container) {
                        this._dragState.record.container.setDepth && this._dragState.record.container.setDepth(1000);
                        this._dragState.record.container.setAlpha && this._dragState.record.container.setAlpha(0.95);
                    }
                }
            }

            if (this._dragState.isDragging) {
                const world = cam.getWorldPoint(pointer.x, pointer.y);
                const desiredX = world.x - this._dragState.offsetWorld.x;
                const desiredY = world.y - this._dragState.offsetWorld.y;
                const destIx = Math.floor(desiredX / gs.minor);
                const destIy = Math.floor(desiredY / gs.minor);

                // Snap preview
                const record = this._dragState.record;
                record.container.x = destIx * gs.minor;
                record.container.y = destIy * gs.minor;

                // Validate ignoring dragged record
                const occupied = !this.buildingManager.canPlace(destIx, destIy, record.defKey, record);

                // Draw preview graphics via scene
                const g = this.scene._dragGraphics;
                if (g) {
                    g.clear();
                    const def = this.scene._buildingDefs[record.defKey] || this.scene._buildingDefs.processUnit;
                    const [fw, fh] = def.footprint;
                    const fillColor = occupied ? 0xff0000 : 0x10b981;
                    const fillAlpha = occupied ? 0.16 : 0.18;
                    g.fillStyle(fillColor, fillAlpha);
                    g.fillRect(destIx * gs.minor, destIy * gs.minor, fw * gs.minor, fh * gs.minor);
                    g.lineStyle(2, 0xffffff, 0.12);
                    g.strokeRect(destIx * gs.minor + 1, destIy * gs.minor + 1, fw * gs.minor - 2, fh * gs.minor - 2);
                }

                this.scene._selectedCell = { ix: destIx, iy: destIy };
                if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
                return;
            }
        }

        // Not dragging: if placement controller active, let it handle hover, otherwise call scene helper
        try {
            if (this.scene._placementController && this.scene._placementController.isPlacing()) {
                this.scene._placementController.handlePointerMove(pointer);
            } else if (typeof this.scene._updateHover === 'function') {
                this.scene._updateHover(pointer);
            }
        } catch (e) {}
    }

    _onPointerUp(pointer) {
        if (pointer.leftButtonReleased && !pointer.leftButtonReleased()) return;

        if (this._dragState.active) {
            const gs = this.scene._gridConfig;
            const record = this._dragState.record;
            const def = this.scene._buildingDefs[record.defKey] || this.scene._buildingDefs.processUnit;
            const fw = def.footprint[0];
            const fh = def.footprint[1];

            if (this._dragState.isDragging) {
                const destIx = Math.floor(record.container.x / gs.minor);
                const destIy = Math.floor(record.container.y / gs.minor);
                const canMove = this.buildingManager.canPlace(destIx, destIy, record.defKey, record);
                if (canMove) {
                    this.buildingManager.moveMachine(record, destIx, destIy);
                    this.scene._selectedCell = { ix: destIx, iy: destIy };
                    if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
                } else {
                    // revert
                    record.container.x = this._dragState.origGrid.x * gs.minor;
                    record.container.y = this._dragState.origGrid.y * gs.minor;
                    this.scene._selectedCell = { ix: this._dragState.origGrid.x, iy: this._dragState.origGrid.y };
                    if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
                }
            } else {
                // click: show machine info for origin
                const orig = this._dragState.origGrid;
                this.scene._selectedCell = { ix: orig.x, iy: orig.y };
                if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
                try { if (typeof this.scene.showMachineInfoFor === 'function') this.scene.showMachineInfoFor(this.buildingManager.getMachineAt(orig.x, orig.y)); } catch (e) {}
            }

            // clear drag state and preview
            try { this.scene._dragGraphics.clear(); } catch (e) {}
            this._dragState.active = false;
            this._dragState.isDragging = false;
            this._dragState.record = null;
        }
    }

    _onKeyDown(ev) {
        // ignore editable element input
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

        // Exit placement mode on Escape
        if (ev.key === 'Escape') {
            // Always hide context menu on Escape
            try { if (typeof this.scene.hideContextMenu === 'function') this.scene.hideContextMenu(); } catch (e) {}
            // Delegate placement cancel to controller if active
            try {
                if (this.scene._placementController && this.scene._placementController.isPlacing()) {
                    this.scene._placementController.cancelPlacement();
                    return;
                }
            } catch (e) {}
        }

        // Delete / Backspace for selected building
        if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.scene._selectedCell) {
            const rec = this.buildingManager.getMachineAt(this.scene._selectedCell.ix, this.scene._selectedCell.iy);
            if (rec && rec.deletable) {
                ev.preventDefault();
                if (typeof this.scene.deleteBuilding === 'function') this.scene.deleteBuilding(rec);
                if (typeof this.scene.hideContextMenu === 'function') this.scene.hideContextMenu();
            }
        }
    }

    _onDocumentPointerDown(ev) {
        const el = (this.scene._contextMenu && this.scene._contextMenu.el) || null;
        if (el) {
            if (ev.button === 0 && !el.contains(ev.target)) {
                try { if (typeof this.scene.hideContextMenu === 'function') this.scene.hideContextMenu(); } catch (e) {}
            }
        }
        // Also close machine info panel when clicking outside it
        const panel = document.getElementById('machine-info-panel');
        if (panel && ev.button === 0) {
            if (!panel.contains(ev.target)) {
                panel.style.display = 'none';
            }
        }
    }

    _onContextMenu(ev) {
        ev.preventDefault();
        const root = document.getElementById('simulator-root');
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const x = ev.clientX;
        const y = ev.clientY;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint((x - rect.left), (y - rect.top));
        const gs = this.scene._gridConfig;
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);
        const rec = this.buildingManager.getMachineAt(ix, iy);
        if (rec) {
            try { if (typeof this.scene.showContextMenuFor === 'function') this.scene.showContextMenuFor('building', rec, x, y); } catch (e) {}
            return;
        }
        try { if (typeof this.scene.showContextMenuFor === 'function') this.scene.showContextMenuFor('ground', null, x, y); } catch (e) {}
    }

    _onEsc() {
        // Cancel an in-progress drag when ESC pressed
        if (this._dragState && this._dragState.active && this._dragState.record) {
            const record = this._dragState.record;
            const gs = this.scene._gridConfig;
            record.container.x = this._dragState.origGrid.x * gs.minor;
            record.container.y = this._dragState.origGrid.y * gs.minor;
            try { this.scene._dragGraphics.clear(); } catch (e) {}
            this._dragState.active = false;
            this._dragState.isDragging = false;
            this._dragState.record = null;
            this.scene._selectedCell = { ix: this._dragState.origGrid.x, iy: this._dragState.origGrid.y };
            if (typeof this.scene._drawSelection === 'function') this.scene._drawSelection();
        }
    }
}
