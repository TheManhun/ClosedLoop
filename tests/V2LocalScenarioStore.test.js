import test from 'node:test';
import assert from 'node:assert/strict';

import LocalScenarioStore from '../resources/js/v2/store/LocalScenarioStore.js';

function makeIndexedDbHarness() {
  const dbs = new Map();

  function createRequest(result) {
    return {
      result,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      error: null,
      transaction: null,
    };
  }

  const open = (name, version) => {
    const existing = dbs.get(name);
    if (existing && existing.version >= version) {
      const req = createRequest(existing);
      queueMicrotask(() => {
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: { result: existing } });
      });
      return req;
    }

    const db = {
      name,
      version: version ?? 1,
      stores: new Map(),
      close() {},
      createObjectStore(storeName, options = {}) {
        const data = this.stores.get(storeName) || [];
        const store = {
          data,
          keyPath: options.keyPath || null,
          get(key) {
            return data.find((entry) => entry && entry[options.keyPath] === key) || null;
          },
          put(value) {
            const targetKey = options.keyPath ? value[options.keyPath] : value.id;
            const index = data.findIndex((entry) => entry && entry[options.keyPath] === targetKey);
            if (index >= 0) data[index] = value;
            else data.push(value);
            return { result: value, onsuccess: null, onerror: null };
          },
          delete(key) {
            const index = data.findIndex((entry) => entry && entry[options.keyPath] === key);
            if (index >= 0) data.splice(index, 1);
          },
          getAll() {
            return data.slice();
          },
        };
        this.stores.set(storeName, data);
        return store;
      },
      objectStoreNames: {
        contains: (storeName) => db.stores.has(storeName),
      },
      transaction(storeName, mode) {
        const data = this.stores.get(storeName) || [];
        const store = {
          data,
          get(key) {
            return data.find((entry) => entry && entry.template_id === key) || null;
          },
          put(value) {
            const targetKey = value.template_id;
            const index = data.findIndex((entry) => entry && entry.template_id === targetKey);
            if (index >= 0) data[index] = value;
            else data.push(value);
            const req = { result: value, onsuccess: null, onerror: null };
            queueMicrotask(() => {
              if (typeof req.onsuccess === 'function') req.onsuccess({ target: { result: value } });
            });
            return req;
          },
          delete(key) {
            const index = data.findIndex((entry) => entry && entry.template_id === key);
            if (index >= 0) data.splice(index, 1);
          },
          getAll() {
            return data.slice();
          },
        };
        return {
          objectStore() {
            return store;
          },
        };
      },
    };

    const objectStoreNamesContains = (storeName) => db.stores.has(storeName);
    db.objectStoreNames = {
      contains: objectStoreNamesContains,
    };

    dbs.set(name, db);
    const req = createRequest(db);
    queueMicrotask(() => {
      if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded({ target: { result: db } });
      if (typeof req.onsuccess === 'function') req.onsuccess({ target: { result: db } });
    });
    return req;
  };

  return {
    open,
    __dbs: dbs,
  };
}

test('LocalScenarioStore creates and persists a local layout for a template', async () => {
  const harness = makeIndexedDbHarness();
  globalThis.indexedDB = {
    open: harness.open,
  };

  const eventBus = { listeners: new Map(), emit(event, payload) { const set = this.listeners.get(event) || new Set(); for (const fn of set) fn(payload); } };
  const store = new LocalScenarioStore({ eventBus, templateId: 2, dbName: 'closed-loop-v2', storeName: 'local_saves' });

  await store.initialise({ templateId: 2, canonicalScenario: { id: 2, scenario_objects: [] } });
  const created = store.addObject({ machine_id: 3, grid_x: 6, grid_y: 2, rotation: 90, object_config: { test: true }, name: 'Pump' });

  assert.ok(created.id);
  assert.equal(typeof created.id, 'string');
  assert.equal(store.getState().objects.length, 1);
  assert.equal(store.getState().objects[0].machine_id, 3);

  await store.autosave();
  assert.ok(harness.__dbs.get('closed-loop-v2'));
  const saved = store.getSaveRecord();
  assert.equal(saved.template_id, 2);
  assert.equal(saved.objects.length, 1);
});

test('LocalScenarioStore exports valid JSON and rejects malformed imports', async () => {
  const harness = makeIndexedDbHarness();
  globalThis.indexedDB = {
    open: harness.open,
  };

  const store = new LocalScenarioStore({ templateId: 2, dbName: 'closed-loop-v2', storeName: 'local_saves' });
  await store.initialise({ templateId: 2, canonicalScenario: { id: 2, scenario_objects: [] } });

  store.addObject({ machine_id: 5, grid_x: 1, grid_y: 1, rotation: 0, object_config: {} });
  const exported = await store.exportDesign();

  assert.equal(exported.closed_loop_save_version, 1);
  assert.equal(exported.template_id, 2);
  assert.equal(exported.objects.length, 1);

  await assert.rejects(async () => {
    await store.importDesign({ closed_loop_save_version: 999, template_id: 2, objects: [] });
  }, /save version|template/i);

  await assert.rejects(async () => {
    await store.importDesign({
      closed_loop_save_version: 1,
      template_id: 2,
      objects: [
        { id: 'dup', machine_id: 99, grid_x: 1, grid_y: 1, rotation: 90 },
        { id: 'dup', machine_id: 42, grid_x: 2, grid_y: 3, rotation: 180 },
      ],
    });
  }, /duplicate/i);
});
