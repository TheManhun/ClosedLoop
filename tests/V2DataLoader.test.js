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
