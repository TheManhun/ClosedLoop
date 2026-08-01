import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionController from '../resources/js/simulator/controllers/ConnectionController.js';
import ConnectionDefinitions from '../resources/js/simulator/data/ConnectionDefinitions.js';

test('gas connections validate when the source provides gas and the target accepts it', () => {
    const scene = {
        _buildingDefs: {
            gasWell: { name: 'Gas Well', provides: ['gas'], accepts: [] },
            processUnit: { name: 'Process Unit', provides: [], accepts: ['gas'] }
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
    controller._def = ConnectionDefinitions.gas;
    controller._defKey = 'gas';

    const valid = controller._validateConnection({ id: 1, defKey: 'gasWell' }, { id: 2, defKey: 'processUnit' });
    assert.deepEqual(valid, { valid: true, message: '' });
});
