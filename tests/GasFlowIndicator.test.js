import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionManager from '../resources/js/simulator/managers/ConnectionManager.js';

test('gas flow indicator uses a bubble cluster and supports gas metadata', () => {
    const manager = new ConnectionManager({ add: () => null, _getRecordCenter: () => ({ x: 0, y: 0 }) }, { getMachine: () => null });

    const style = manager._getFlowIndicatorStyle({ type: 'gas', gasType: 'biogas', purity: 0.92 });
    const metadata = manager._getFlowIndicatorMetadata({ type: 'gas', gasType: 'biogas', purity: 0.92 });

    assert.equal(style.shape, 'bubble-cluster');
    assert.equal(style.color, 0xfacc15);
    assert.equal(metadata.gasType, undefined);
    assert.equal(metadata.purity, undefined);
});

test('gas flow indicator exposes a reusable position setter for the shared animation path', () => {
    const container = {
        x: 0,
        y: 0,
        visible: true,
        setVisible(value) { this.visible = value; },
        setPosition(x, y) { this.x = x; this.y = y; },
        setDepth() {},
        setScrollFactor() {},
        disableInteractive() {},
        destroy() {},
        add() {}
    };
    const scene = {
        add: {
            container: () => container,
            graphics: () => ({
                clear() {},
                lineStyle() {},
                fillStyle() {},
                beginPath() {},
                moveTo() {},
                lineTo() {},
                closePath() {},
                fillPath() {},
                strokePath() {},
                setDepth() {},
                setScrollFactor() {},
                disableInteractive() {},
                setVisible() {},
                setAlpha() {},
                setPosition() {},
                setRotation() {}
            })
        },
        tweens: { add() { throw new Error('no tween'); } },
        _getRecordCenter: () => ({ x: 0, y: 0 })
    };

    const manager = new ConnectionManager(scene, { getMachine: () => null });
    const connection = { type: 'gas', _renderer: {} };
    const indicator = manager.createFlowIndicator(connection);

    indicator.setPosition(12, 34);

    assert.equal(container.x, 12);
    assert.equal(container.y, 34);
});

test('gas connections created from the toolbox inherit default transport metadata', () => {
    const scene = {
        add: {
            graphics: () => ({
                setDepth() {},
                disableInteractive() {},
                input: { enabled: false },
                lineStyle() {},
                beginPath() {},
                moveTo() {},
                lineTo() {},
                strokePath() {},
                clear() {},
                setVisible() {},
                setScrollFactor() {},
                setAlpha() {},
                setPosition() {},
                setRotation() {}
            })
        },
        _getRecordCenter: () => ({ x: 0, y: 0 })
    };
    const buildingManager = {
        getMachine: () => null,
        getPlacedMachines: () => []
    };
    const manager = new ConnectionManager(scene, buildingManager);

    const connection = manager.createConnection({ key: 'gas', label: 'Gas Pipe', resourceCategories: ['gas'] }, { id: 1 }, { id: 2 });

    assert.equal(connection.resourceKey, null);
    assert.equal(connection.resourceName, null);
    assert.equal(connection.flowUnit, null);
});
