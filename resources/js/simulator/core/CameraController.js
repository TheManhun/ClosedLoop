import Phaser from 'phaser';

export class CameraController {
    constructor(scene, options = {}) {
        this.scene = scene;
        const defaults = { minZoom: 0.5, maxZoom: 2.0, zoomSensitivity: 0.0015 };
        this.options = Object.assign({}, defaults, options);

        // Exposed controls object for compatibility with existing scene usage
        this.controls = {
            dragging: false,
            dragStart: { x: 0, y: 0, scrollX: 0, scrollY: 0 },
            minZoom: this.options.minZoom,
            maxZoom: this.options.maxZoom,
            zoomSensitivity: this.options.zoomSensitivity
        };

        this._installHandlers();
    }

    _installHandlers() {
        const scene = this.scene;
        const controls = this.controls;

        // Pointer down: start camera drag on middle-button
        scene.input.on('pointerdown', (pointer) => {
            if (pointer.middleButtonDown()) {
                const cam = scene.cameras.main;
                controls.dragging = true;
                controls.dragStart = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
                // Ask scene to hide context menu if helper exists
                if (typeof scene.hideContextMenu === 'function') {
                    try { scene.hideContextMenu(); } catch (e) { /* ignore */ }
                }
            }
        });

        // Pointer up: stop camera drag when middle button released
        scene.input.on('pointerup', (pointer) => {
            if (!pointer.middleButtonDown()) {
                controls.dragging = false;
            }
        });

        // Pointer move: while dragging, pan camera
        scene.input.on('pointermove', (pointer) => {
            if (!controls.dragging) return;
            const cam = scene.cameras.main;
            const start = controls.dragStart;
            cam.scrollX = start.scrollX - (pointer.x - start.x) / cam.zoom;
            cam.scrollY = start.scrollY - (pointer.y - start.y) / cam.zoom;
            if (typeof scene._updateHover === 'function') {
                try { scene._updateHover(pointer); } catch (e) { /* ignore */ }
            }
        });

        // Wheel zoom (cursor-centred)
        scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const cam = scene.cameras.main;
            const prevZoom = cam.zoom;
            const newZoom = Phaser.Math.Clamp(prevZoom - deltaY * controls.zoomSensitivity * prevZoom, controls.minZoom, controls.maxZoom);
            if (newZoom === prevZoom) {
                return;
            }
            const before = cam.getWorldPoint(pointer.x, pointer.y);
            cam.setZoom(newZoom);
            const after = cam.getWorldPoint(pointer.x, pointer.y);
            cam.scrollX += before.x - after.x;
            cam.scrollY += before.y - after.y;
            if (typeof scene._updateHover === 'function') {
                try { scene._updateHover(pointer); } catch (e) { /* ignore */ }
            }
        });

        // Reset camera with R key: zoom 1 and center on the title text
        scene.input.keyboard.on('keydown-R', () => {
            const cam = scene.cameras.main;
            cam.setZoom(1);
            try { cam.centerOn(scene.titleText.x, scene.titleText.y); } catch (e) { /* ignore */ }
        });
    }
}

export default CameraController;
