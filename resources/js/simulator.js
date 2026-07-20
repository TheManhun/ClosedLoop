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
        });

        // Middle-button drag to pan
        this.input.on('pointerdown', (pointer) => {
            if (pointer.middleButtonDown()) {
                this._cameraControls.dragging = true;
                this._cameraControls.dragStart = { x: pointer.x, y: pointer.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
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
        });

        // Reset camera with R key: zoom 1 and center on the prototype text
        this.input.keyboard.on('keydown-R', () => {
            cam.setZoom(1);
            cam.centerOn(this.titleText.x, this.titleText.y);
        });
    }
}

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
