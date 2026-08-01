import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionManager from '../resources/js/simulator/managers/ConnectionManager.js';
import ConnectionDefinitions from '../resources/js/simulator/data/ConnectionDefinitions.js';

function createStubGraphics() {
    const state = { visible: true, x: 0, y: 0, depth: 0, alpha: 1 };
    const methods = {
        setDepth(value) { state.depth = value; return this; },
        setScrollFactor() { return this; },
        disableInteractive() { return this; },
        setVisible(value) { state.visible = value; return this; },
        setPosition(x, y) { state.x = x; state.y = y; return this; },
        setAlpha(value) { state.alpha = value; return this; },
        clear() { return this; },
        lineStyle() { return this; },
        beginPath() { return this; },
        moveTo() { return this; },
        lineTo() { return this; },
        strokePath() { return this; },
        fillStyle() { return this; },
        fillPath() { return this; },
        closePath() { return this; },
        destroy() { return this; },
        add() { return this; },
        setRotation() { return this; },
        input: { enabled: false }
    };
    return methods;
}

test('conveyor connections create a multi-item flow indicator using the connection metadata icon', () => {
    const scene = {
        add: () => createStubGraphics(),
        cameras: { main: { getWorldPoint: () => ({ x: 0, y: 0 }) } },
        _getRecordCenter: () => ({ x: 0, y: 0 }),
        tweens: { add: () => ({ stop() {}, isPlaying() { return false; } }) }
    };

    const buildingManager = {
        getMachine: () => null,
        getMachineAt: () => null,
        getPlacedMachines: () => []
    };

    const connectionManager = new ConnectionManager(scene, buildingManager);
    const fromRecord = { id: 1, defKey: 'farmWaste' };
    const toRecord = { id: 2, defKey: 'sortingFacility' };

    const connection = connectionManager.createConnection(ConnectionDefinitions.conveyor, fromRecord, toRecord, { resourceIcon: 'crate' });

    assert.ok(connection);
    assert.ok(connection._renderer);
    assert.ok(connection._renderer.flowIndicator);
    assert.equal(connection._renderer.flowIndicator.items.length, 3);
    assert.equal(connection._renderer.flowIndicator.items[0].resourceIcon, 'crate');
});

test('conveyor item styles are derived from metadata and fall back to a generic crate', () => {
    const scene = {
        add: () => createStubGraphics(),
        cameras: { main: { getWorldPoint: () => ({ x: 0, y: 0 }) } },
        _getRecordCenter: () => ({ x: 0, y: 0 }),
        tweens: { add: () => ({ stop() {}, isPlaying() { return false; } }) }
    };

    const buildingManager = {
        getMachine: () => null,
        getMachineAt: () => null,
        getPlacedMachines: () => []
    };

    const connectionManager = new ConnectionManager(scene, buildingManager);
    const fromRecord = { id: 1, defKey: 'farmWaste' };
    const toRecord = { id: 2, defKey: 'sortingFacility' };

    const plasticConnection = connectionManager.createConnection(ConnectionDefinitions.conveyor, fromRecord, toRecord, {
        resourceKey: 'plastic-flakes',
        resourceName: 'Plastic flakes',
        resourceIcon: 'plastic_flakes'
    });

    const unknownConnection = connectionManager.createConnection(ConnectionDefinitions.conveyor, fromRecord, toRecord);

    assert.equal(plasticConnection._renderer.flowIndicator.items[0].resourceStyle.shape, 'pellet');
    assert.equal(unknownConnection._renderer.flowIndicator.items[0].resourceStyle.shape, 'crate');
});

test('conveyor rail layout includes tie bars between the rails', () => {
    const scene = {
        add: () => createStubGraphics(),
        cameras: { main: { getWorldPoint: () => ({ x: 0, y: 0 }) } },
        _getRecordCenter: () => ({ x: 0, y: 0 }),
        tweens: { add: () => ({ stop() {}, isPlaying() { return false; } }) }
    };

    const buildingManager = {
        getMachine: () => null,
        getMachineAt: () => null,
        getPlacedMachines: () => []
    };

    const connectionManager = new ConnectionManager(scene, buildingManager);
    const layout = connectionManager._getConveyorRailLayout({ x: 0, y: 0 }, { x: 60, y: 0 });

    assert.ok(layout.ties.length > 0);
    assert.equal(layout.ties[0].start.x, layout.ties[0].end.x);
    assert.notEqual(layout.ties[0].start.y, layout.ties[0].end.y);
});
