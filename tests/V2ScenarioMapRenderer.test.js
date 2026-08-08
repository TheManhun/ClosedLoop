import test from 'node:test';
import assert from 'node:assert/strict';

import ScenarioMapRenderer from '../resources/js/v2/renderer/ScenarioMapRenderer.js';
import { uiImage, scenarioImage } from '../resources/js/v2/renderer/AssetPaths.js';

function makeMockScene() {
  const created = [];
  const loads = [];
  let completeHandler = null;
  const scene = {
    add: {
      image: (x, y, key) => {
        const im = {
          _destroyed: false,
          _x: x,
          _y: y,
          _key: key,
          width: 1024,
          height: 512,
          setOrigin: () => {},
          setDepth: (d) => { im._depth = d; },
          setAlpha: (a) => { im._alpha = a; },
          setScale: (s) => { im._scale = s; },
          destroy: () => { im._destroyed = true; }
        };
        created.push(im);
        return im;
      }
    },
    load: {
      image: (key, url) => { loads.push({ key, url }); },
      once: (ev, h) => { if (ev === 'complete') completeHandler = h; },
      start: () => { if (typeof completeHandler === 'function') completeHandler(); }
    },
    textures: {
      exists: (k) => false
    },
    events: { on: () => {}, off: () => {} }
  };
  scene._loads = loads;
  scene._created = created;
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

test('ScenarioMapRenderer registers loader using scenarioImage resolver and renders map', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioMapRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const scenario = { id: 2, map_image: 'dandenong_vic.png' };
  eb.emit('scenario:loaded', scenario);

  // loader should have been registered with the UI background path, not the scenario map
  assert.ok(scene._loads && scene._loads.some(l => l.url === uiImage('background.png')),
    'expected loader to be registered for UI background image');
  assert.ok(!(scene._loads && scene._loads.some(l => l.url === scenarioImage('dandenong_vic.png'))),
    'scenario aerial image should not be used as simulator background');

  const created = scene._created;
  assert.ok(created.length >= 1, 'expected an image to be created');
  const img = created[created.length - 1];
  assert.equal(img._key, `sim_background`);
  assert.equal(img._depth, -20);
  assert.ok(img._alpha > 0 && img._alpha <= 1);
  assert.ok(img._scale && img._scale > 0);
});

test('ScenarioMapRenderer tolerates null map_image and destroys previous map on reload', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new ScenarioMapRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  // first load (scenario payload exists but we ignore scenario.map_image for simulator ground)
  eb.emit('scenario:loaded', { id: 2, map_image: 'dandenong_vic.png' });
  const img1 = scene._created[scene._created.length - 1];
  assert.ok(img1 && !img1._destroyed);

  // reload with no image should destroy previous
  eb.emit('scenario:loaded', { id: 2, map_image: null });
  assert.ok(img1._destroyed === true);

  // destroy renderer removes listeners and visuals
  r.destroy();
  // after destroy, further emits should have no effect (no new images created)
  const prevCount = scene._created.length;
  eb.emit('scenario:loaded', { id: 2, map_image: 'dandenong_vic.png' });
  assert.equal(scene._created.length, prevCount);
});
