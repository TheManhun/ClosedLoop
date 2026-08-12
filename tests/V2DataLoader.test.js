import test from 'node:test';
import assert from 'node:assert/strict';

import DataLoader from '../resources/js/v2/services/DataLoader.js';

test('DataLoader uses ApiCoordinator and stores machines', async () => {
  const fixture = { value: [ { id: 11, name: 'A' }, { id: 22, name: 'B' } ], Count: 2 };
  const api = { fetchMachines: async () => fixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadMachines();
  assert.ok(Array.isArray(loaded));
  assert.equal(loaded.length, 2);
  const all = dl.getMachines();
  assert.equal(all.length, 2);
  const m = dl.getMachineById(22);
  assert.equal(m.name, 'B');
});

test('DataLoader loads and stores resources from ApiCoordinator array response', async () => {
  const fixture = [ { id: 101, name: 'Water' }, { id: 102, name: 'Electricity' } ];
  const api = { fetchResources: async () => fixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadResources();
  assert.ok(Array.isArray(loaded));
  assert.equal(loaded.length, 2);
  const all = dl.getResources();
  assert.equal(all.length, 2);
  const r = dl.getResourceById(102);
  assert.equal(r.name, 'Electricity');
});

test('DataLoader.loadMachines preserves embedded resources array', async () => {
  const fixture = {
    value: [
      {
        id: 3,
        name: 'Anaerobic Digester',
        resources: [
          { id: 14, direction: 'input', amount: 1, unit: 't/t' },
          { id: 15, direction: 'output', amount: 100, unit: 'm3/t input' },
        ],
      },
    ],
    Count: 1,
  };
  const api = { fetchMachines: async () => fixture };
  const dl = new DataLoader({ apiCoordinator: api });
  await dl.loadMachines();
  const machine = dl.getMachineById(3);
  assert.ok(machine);
  assert.ok(Array.isArray(machine.resources));
  const resource14 = machine.resources.find((resource) => Number(resource.id) === 14);
  assert.ok(resource14);
  assert.equal(resource14.direction, 'input');
});

test('DataLoader.loadResources rejects non-array response as malformed', async () => {
  const api = { fetchResources: async () => ({ value: [] }) };
  const dl = new DataLoader({ apiCoordinator: api });
  let threw = false;
  try {
    await dl.loadResources();
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('expected array'));
  }
  assert.equal(threw, true);
});
