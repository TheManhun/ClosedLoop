import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionManager from '../resources/js/simulator/managers/ConnectionManager.js';

test('flow indicator metadata keeps missing values null and defaults water to normal state', () => {
    const manager = new ConnectionManager({ add: () => null, _getRecordCenter: () => ({ x: 0, y: 0 }) }, { getMachine: () => null });

    const metadata = manager._getFlowIndicatorMetadata({ type: 'water' });

    assert.deepEqual(metadata, {
        resourceKey: null,
        resourceName: null,
        flowRate: null,
        flowUnit: null,
        temperature: null,
        pressure: null,
        quality: null,
        state: 'normal'
    });
});

test('water flow indicator interpolates from live endpoints without a tween', () => {
    const positions = [];
    const container = {
        x: 0,
        y: 0,
        visible: true,
        setVisible(value) { this.visible = value; },
        setPosition(x, y) { this.x = x; this.y = y; positions.push({ x, y }); },
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
                setPosition(x, y) { positions.push({ x, y }); },
                setRotation() {}
            })
        },
        tweens: {
            add() {
                throw new Error('water indicator should not use tweens');
            }
        },
        _getRecordCenter(record) {
            return { x: record.x, y: record.y };
        }
    };

    const source = { id: 1, x: 0, y: 0 };
    const target = { id: 2, x: 10, y: 0 };
    const manager = new ConnectionManager(scene, {
        getMachine(id) {
            return id === 1 ? source : id === 2 ? target : null;
        }
    });

    const connection = {
        type: 'water',
        sourceBuildingId: 1,
        targetBuildingId: 2,
        flowProgress: 0,
        _renderer: {}
    };

    manager.createFlowIndicator(connection);
    manager.updateFlowIndicator(connection, 16);

    target.x = 20;
    target.y = 5;
    manager.updateFlowIndicator(connection, 16);

    assert.ok(positions.length >= 2);
    assert.ok(positions[1].x >= 0);
});
