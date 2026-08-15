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

test('ApiCoordinator requests /api/resources and returns JSON array', async () => {
  let calledUrl = null;
  global.fetch = async (url, opts) => {
    calledUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ([ { id: 1, name: 'Water' } ]),
    };
  };

  const api = new ApiCoordinator();
  const res = await api.fetchResources();
  assert.equal(calledUrl, '/api/resources');
  assert.ok(res && Array.isArray(res));
  assert.equal(res[0].id, 1);
});

test('ApiCoordinator sends same-origin CSRF metadata when creating a scenario object', async () => {
  const originalDocument = global.document;
  global.document = {
    querySelector: (selector) => selector === 'meta[name="csrf-token"]' ? { content: 'abc123' } : null,
    cookie: 'XSRF-TOKEN=abc123; other=value',
  };

  let seen = null;
  global.fetch = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 201, statusText: 'Created', json: async () => ({ id: 77, scenario_id: 2 }) };
  };

  try {
    const api = new ApiCoordinator();
    await api.createScenarioObject({ scenario_id: 2, machine_id: 2, grid_x: 1, grid_y: 1, object_type: 'machine', object_key: 'machine_2_1_1_1', name: 'Test', rotation: 0, fixed: true, selectable: true, object_config: {} });

    assert.equal(seen.url, '/api/scenarios/2/scenario-objects');
    assert.equal(seen.opts.credentials, 'same-origin');
    assert.equal(seen.opts.headers['X-CSRF-TOKEN'], 'abc123');
    assert.equal(seen.opts.headers['X-XSRF-TOKEN'], 'abc123');
  } finally {
    global.document = originalDocument;
  }
});

test('ApiCoordinator.fetchResources throws useful error for HTTP failure', async () => {
  global.fetch = async (url, opts) => ({ ok: false, status: 500, statusText: 'Server Error', text: async () => 'failure' });
  const api = new ApiCoordinator();
  let threw = false;
  try {
    await api.fetchResources();
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('HTTP 500') || e.message.includes('500'));
  }
  assert.equal(threw, true);
});
