import test from 'node:test';
import assert from 'node:assert/strict';
import BuildingDefinitions from '../resources/js/simulator/data/BuildingDefinitions.js';

test('placeholder gas machines expose the expected capabilities for the test chain', () => {
    const definitions = new BuildingDefinitions();

    const digester = definitions.get('anaerobicDigester');
    assert.ok(digester, 'anaerobic digester definition should exist');
    assert.deepEqual(digester.accepts, ['power', 'conveyor']);
    assert.deepEqual(digester.provides, ['gas']);

    const tank = definitions.get('biogasTank');
    assert.ok(tank, 'biogas tank definition should exist');
    assert.deepEqual(tank.accepts, ['gas']);
    assert.deepEqual(tank.provides, ['gas']);

    const generator = definitions.get('gasGenerator');
    assert.ok(generator, 'gas generator definition should exist');
    assert.deepEqual(generator.accepts, ['gas']);
    assert.deepEqual(generator.provides, ['power']);
});
