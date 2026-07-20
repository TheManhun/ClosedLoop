import Phaser from 'phaser';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    create() {
        const { width, height } = this.scale;
        this.add.text(width / 2, height / 2, 'Closed Loop Prototype', {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'simulator-root',
    width: 1024,
    height: 600,
    backgroundColor: '#0f172a',
    scene: [PrototypeScene]
};

new Phaser.Game(config);
