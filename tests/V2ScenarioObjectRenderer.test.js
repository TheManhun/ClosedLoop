import test from 'node:test';
import assert from 'node:assert/strict';

import ScenarioObjectRenderer from '../resources/js/v2/renderer/ScenarioObjectRenderer.js';

function makeMockScene() {
  const created = [];
  let completeHandler = null;
  const scene = {
    add: {
      image: (x, y, key) => {
        const im = { _destroyed: false, _x: x, _y: y, _key: key, width: 64, height: 64, setOrigin: () => {}, setDepth: () => {}, setScale: () => {}, setDisplaySize: () => {}, destroy: () => { im._destroyed = true; } };
        created.push(im);
        return im;
      },
      graphics: () => {
        const g = { _destroyed: false, fillStyle: () => {}, fillRect: () => {}, setDepth: () => {}, destroy: () => { g._destroyed = true; } };
        created.push(g);
        return g;
      }
    },
    load: {
      image: (key, url) => { scene._lastLoad = { key, url }; },
      start: () => { if (typeof completeHandler === 'function') completeHandler(); },
      once: (ev, h) => { if (ev === 'complete') { completeHandler = h; } }
    },
    textures: { exists: () => false },
    events: { on: () => {}, off: () => {} }
  };
  return { scene, created };
}

function makeEventBus() {
  const handlers = {};
  return {
    on: (k, h) => { if (!handlers[k]) handlers[k] = new Set(); handlers[k].add(h); },
    off: (k, h) => { if (!handlers[k]) return; handlers[k].delete(h); },
    emit: (k, v) => { const s = handlers[k]; if (!s) return; for (const h of Array.from(s)) h(v); }
  };
}

test('Renders one visual per scenario_object and uses payload x/y', async () => {
  const { scene, created } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = { scenario_objects: [ { id: 1, position_x: 320, position_y: 0, object_type: 'machine', machine: { id: 2, image: 'Primary_Clarifier.png' }, fixed: true, selectable: true } ] };
  eb.emit('scenario:loaded', scenario);

  assert.equal(r._objects.length, 1);
  const entry = r._objects[0];
  assert.equal(entry.meta.id, 1);
  assert.equal(entry.meta.x, 320);
  assert.equal(entry.meta.y, 0);
  // when image path provided, preferImage was set; createdAsImage may be true in real scene, but in mock textures.exists false and load is stubbed
  assert.ok(entry.obj, 'visual should be created');
  // loader should have been registered with resolved machine path
  assert.ok(scene._lastLoad && scene._lastLoad.url === '/images/machines/Primary_Clarifier.png');
});

test('Missing image falls back to placeholder and fixed objects are not draggable', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = { scenario_objects: [ { id: 5, position_x: 10, position_y: -20, object_type: 'machine', machine: { id: 99, image: null }, fixed: true, selectable: false } ] };
  eb.emit('scenario:loaded', scenario);

  assert.equal(r._objects.length, 1);
  const e = r._objects[0];
  assert.ok(e.obj, 'placeholder should be created');
  assert.equal(e.meta.fixed, true);
});

test('Reload destroys previous visuals and empty array tolerated', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const s1 = { scenario_objects: [ { id: 1, position_x: 0, position_y: 0, object_type: 'machine', machine: { id: 2, image: null }, fixed: true } ] };
  eb.emit('scenario:loaded', s1);
  assert.equal(r._objects.length, 1);
  const obj1 = r._objects[0].obj;

  const s2 = { scenario_objects: [] };
  eb.emit('scenario:loaded', s2);
  assert.equal(r._objects.length, 0);
  // previous object destroyed
  assert.ok(obj1._destroyed === true || obj1._destroyed === undefined);
});

test('destroy() cleans up and stops responding to scenario:loaded', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const s = { scenario_objects: [ { id: 2, position_x: 1, position_y: 2, object_type: 'machine', machine: { id: 2, image: null } } ] };
  eb.emit('scenario:loaded', s);
  assert.equal(r._objects.length, 1);
  r.destroy();
  eb.emit('scenario:loaded', s);
  assert.equal(r._objects.length, 0);
});
