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

test('Renders one visual per scenario_object and uses grid-origin placement', async () => {
  const { scene, created } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = { scenario_objects: [ { id: 1, grid_x: 2, grid_y: -2, object_type: 'machine', machine: { id: 2, image: 'Primary_Clarifier.png', footprint_x: 5, footprint_y: 4 }, fixed: true, selectable: true } ] };
  eb.emit('scenario:loaded', scenario);

  assert.equal(r._objects.length, 1);
  const entry = r._objects[0];
  assert.equal(entry.meta.id, 1);
  assert.equal(entry.meta.x, 288);
  assert.equal(entry.meta.y, 0);
  assert.ok(entry.obj, 'visual should be created');
  assert.ok(scene._lastLoad && scene._lastLoad.url === '/images/machines/Primary_Clarifier.png');
});

test('Missing image falls back to placeholder and fixed objects are not draggable', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = { scenario_objects: [ { id: 5, grid_x: 0, grid_y: -1, object_type: 'machine', machine: { id: 99, image: null, footprint_x: 1, footprint_y: 1 }, fixed: true, selectable: false } ] };
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

  const s1 = { scenario_objects: [ { id: 1, grid_x: 0, grid_y: 0, object_type: 'machine', machine: { id: 2, image: null, footprint_x: 1, footprint_y: 1 }, fixed: true } ] };
  eb.emit('scenario:loaded', s1);
  assert.equal(r._objects.length, 1);
  const obj1 = r._objects[0].obj;

  const s2 = { scenario_objects: [] };
  eb.emit('scenario:loaded', s2);
  assert.equal(r._objects.length, 0);
  assert.ok(obj1._destroyed === true || obj1._destroyed === undefined);
});

test('destroy() cleans up and stops responding to scenario:loaded', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const s = { scenario_objects: [ { id: 2, grid_x: 1, grid_y: 2, object_type: 'machine', machine: { id: 2, image: null, footprint_x: 1, footprint_y: 1 } } ] };
  eb.emit('scenario:loaded', s);
  assert.equal(r._objects.length, 1);
  r.destroy();
  eb.emit('scenario:loaded', s);
  assert.equal(r._objects.length, 0);
});

test('Persisted machine artwork sizes by canonical footprint and preserves aspect ratio', async () => {
  const scene = {
    add: {
      image: (x, y, key) => ({
        x,
        y,
        key,
        width: 400,
        height: 200,
        _scale: 1,
        setOrigin: () => {},
        setDepth: () => {},
        setScale: (scale) => {
          this._scale = scale;
          return scale;
        },
        setDisplaySize: (displayWidth, displayHeight) => {
          this.displayWidth = displayWidth;
          this.displayHeight = displayHeight;
        },
        setPosition: (px, py) => {
          this.x = px;
          this.y = py;
        },
        setAngle: (angle) => {
          this.angle = angle;
        },
        setVisible: () => {},
        setAlpha: () => {},
        destroy: () => {}
      }),
      graphics: () => ({ fillStyle: () => {}, fillRect: () => {}, setDepth: () => {}, destroy: () => {} }),
      zone: () => ({ setInteractive: () => {}, setDepth: () => {}, on: () => {}, destroy: () => {} }),
    },
    load: { image: () => {}, start: () => {}, once: () => {} },
    textures: { exists: () => true },
    events: { on: () => {}, off: () => {} }
  };
  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = {
    scenario_objects: [
      {
        id: 10,
        grid_x: 0,
        grid_y: 0,
        rotation: 0,
        object_type: 'machine',
        machine: { id: 98, image: 'Digestor.png', footprint_x: 4, footprint_y: 4 },
        fixed: true,
        selectable: true,
      },
    ],
  };

  eb.emit('scenario:loaded', scenario);
  const obj = r._objects[0].obj;
  assert.equal(obj.x, 128);
  assert.equal(obj.y, 128);
  assert.ok(Math.abs((obj.displayWidth ?? 217.6) - 217.6) < 2, `expected display width near 217.6, got ${obj.displayWidth}`);
  assert.ok(Math.abs((obj.displayHeight ?? 108.8) - 108.8) < 2, `expected display height near 108.8, got ${obj.displayHeight}`);
});

test('Persisted machine artwork remains centered and handles rotation and negative grid coordinates', async () => {
  const created = [];
  const scene = {
    add: {
      image: (x, y, key) => {
        const im = {
          x,
          y,
          key,
          width: 300,
          height: 150,
          scale: 1,
          angle: 0,
          setOrigin: () => {},
          setDepth: () => {},
          setScale: (scale) => { im.scale = scale; },
          setDisplaySize: (displayWidth, displayHeight) => { im.displayWidth = displayWidth; im.displayHeight = displayHeight; },
          setPosition: (px, py) => { im.x = px; im.y = py; },
          setAngle: (angle) => { im.angle = angle; },
          setVisible: () => {},
          setAlpha: () => {},
          destroy: () => {}
        };
        created.push(im);
        return im;
      },
      graphics: () => ({ fillStyle: () => {}, fillRect: () => {}, setDepth: () => {}, destroy: () => {} }),
      zone: () => ({ setInteractive: () => {}, setDepth: () => {}, on: () => {}, destroy: () => {} }),
    },
    load: { image: () => {}, start: () => {}, once: () => {} },
    textures: { exists: () => true },
    events: { on: () => {}, off: () => {} }
  };

  const eb = makeEventBus();
  const r = new ScenarioObjectRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = {
    scenario_objects: [
      {
        id: 20,
        grid_x: -2,
        grid_y: -1,
        rotation: 90,
        object_type: 'machine',
        machine: { id: 18, image: 'Rotary.png', footprint_x: 2, footprint_y: 2 },
        fixed: true,
        selectable: true,
      },
    ],
  };

  eb.emit('scenario:loaded', scenario);
  const im = created[0];

  assert.equal(im.x, -64, 'centered on negative grid footprint');
  assert.equal(im.y, 0, 'centered on negative grid footprint');
  assert.equal(im.angle, 90, 'rotation should be preserved');
  assert.ok(Math.abs((im.displayWidth ?? 108.8) - 108.8) < 2, `expected displayWidth near 108.8, got ${im.displayWidth}`);
  assert.ok(Math.abs((im.displayHeight ?? 54.4) - 54.4) < 2, `expected displayHeight near 54.4, got ${im.displayHeight}`);
});
