import test from 'node:test';
import assert from 'node:assert/strict';

import TechnologyEngine from '../resources/js/v2/technology/TechnologyEngine.js';

class MockDataLoader {
  constructor(machines = []) { this._machines = machines; }
  getMachines() { return this._machines.slice(); }
}

test('TechnologyEngine: exact-id input match returns machine', async () => {
  const machines = [
    { id: 3, name: 'Anaerobic Digester', resources: [{ id: 14, direction: 'input', amount: 1, unit: 't/t' }] },
  ];
  const dl = new MockDataLoader(machines);
  const te = new TechnologyEngine({ dataLoader: dl });
  const res = te.getCompatibleMachinesForResource(14);
  assert.ok(Array.isArray(res));
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 3);
});

test('TechnologyEngine: wrong resource id returns no matches', async () => {
  const machines = [ { id: 3, name: 'Anaerobic Digester', resources: [{ id: 14, direction: 'input' }] } ];
  const dl = new MockDataLoader(machines);
  const te = new TechnologyEngine({ dataLoader: dl });
  const res = te.getCompatibleMachinesForResource(999);
  assert.ok(Array.isArray(res));
  assert.equal(res.length, 0);
});

test('TechnologyEngine: output-only relationship does not count', async () => {
  const machines = [ { id: 7, name: 'Fake Output Machine', resources: [{ id: 14, direction: 'output' }] } ];
  const dl = new MockDataLoader(machines);
  const te = new TechnologyEngine({ dataLoader: dl });
  const res = te.getCompatibleMachinesForResource(14);
  assert.equal(res.length, 0);
});
