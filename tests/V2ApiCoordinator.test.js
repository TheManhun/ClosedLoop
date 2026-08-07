import test from 'node:test';
import assert from 'node:assert/strict';

import ApiCoordinator from '../resources/js/v2/api/ApiCoordinator.js';

test('ApiCoordinator requests /api/machines and returns JSON', async () => {
  let calledUrl = null;
  global.fetch = async (url, opts) => {
    calledUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ value: [{ id: 1, name: 'Test' }], Count: 1 }),
    };
  };

  const api = new ApiCoordinator();
  const res = await api.fetchMachines();
  assert.equal(calledUrl, '/api/machines');
  assert.ok(res && Array.isArray(res.value));
  assert.equal(res.value[0].id, 1);
});

test('ApiCoordinator throws useful error for HTTP failure', async () => {
  global.fetch = async (url, opts) => ({ ok: false, status: 500, statusText: 'Server Error', text: async () => 'failure' });
  const api = new ApiCoordinator();
  let threw = false;
  try {
    await api.fetchMachines();
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('HTTP 500') || e.message.includes('500'));
  }
  assert.equal(threw, true);
});
