import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionController from '../resources/js/simulator/controllers/ConnectionController.js';
import ConnectionDefinitions from '../resources/js/simulator/data/ConnectionDefinitions.js';

test('water connections validate when the source provides water and the target accepts it', () => {
    const scene = {
        _buildingDefs: {
            sewerage: { name: 'Sewerage', provides: ['water'], accepts: [] },
            algaeFarm: { name: 'Algae Farm', provides: [], accepts: ['water'] }
        },
        add: () => ({
            clear() {},
            setVisible() {},
            disableInteractive() {},
            input: { enabled: false }
        }),
        cameras: { main: { getWorldPoint: () => ({ x: 0, y: 0 }) } },
        _getRecordCenter: () => ({ x: 0, y: 0 })
    };

    const connectionManager = {
        getAll: () => [],
        buildingManager: { getMachineAt: () => null }
    };

    const controller = new ConnectionController(scene, connectionManager);
    controller._def = ConnectionDefinitions.water;
    controller._defKey = 'water';

    const valid = controller._validateConnection({ id: 1, defKey: 'sewerage' }, { id: 2, defKey: 'algaeFarm' });
    assert.deepEqual(valid, { valid: true, message: '' });

    const source = { id: 2, defKey: 'algaeFarm' };
    const invalid = controller._validateConnection(source, source);
    assert.equal(invalid.valid, false);
    assert.match(invalid.message, /itself/i);
});
