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
