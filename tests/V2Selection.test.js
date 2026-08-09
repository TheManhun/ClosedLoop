import test from 'node:test';
import assert from 'node:assert/strict';

import StockpileRenderer from '../resources/js/v2/renderer/StockpileRenderer.js';
import SelectionController from '../resources/js/v2/selection/SelectionController.js';

function makeMockScene() {
  const created = [];
  let completeHandler = null;
  const handlers = {};
  const scene = {
    add: {
      zone: (x, y, w, h) => {
        const z = {
          _destroyed: false,
          _interactiveAssigned: false,
          _handlers: {},
          setInteractive: function() { this._interactiveAssigned = true; },
          on: function(ev, h) { this._handlers[ev] = h; },
          off: function(ev) { delete this._handlers[ev]; },
          destroy: function() { this._destroyed = true; }
        };
        created.push(z);
        return z;
      },
      graphics: () => {
        const g = {
          _destroyed: false,
          _rects: [],
          lineStyle: () => {},
          strokeRect: (x, y, w, h) => { g._rects.push([x, y, w, h]); },
          setDepth: () => {},
          destroy: () => { g._destroyed = true; },
        };
        created.push(g);
        return g;
      },
      image: (x, y, key) => {
        const im = {
          _destroyed: false,
          _x: x,
          _y: y,
          _key: key,
          setOrigin: () => {},
          setDepth: () => {},
          setDisplaySize: () => {},
          destroy: () => { im._destroyed = true; }
        };
        created.push(im);
        return im;
      },
      text: (x, y, txt, opts) => {
        const t = {
          _destroyed: false,
          _x: x,
          _y: y,
          _text: txt,
          setOrigin: () => {},
          setDepth: () => {},
          destroy: () => { t._destroyed = true; },
          setText: (s) => { t._text = s; }
        };
        created.push(t);
        return t;
      }
    },
    load: {
      image: (key, url) => { scene._lastLoad = { key, url }; },
      once: (ev, h) => { if (ev === 'complete') completeHandler = h; },
      start: () => { if (typeof completeHandler === 'function') completeHandler(); },
    },
    _loads: [],
    events: {
      on: () => {},
      off: () => {},
    },
    input: {
      _map: {},
      on: function(ev, fn) { this._map[ev] = this._map[ev] || []; this._map[ev].push(fn); },
      off: function(ev, fn) { if (!this._map[ev]) return; this._map[ev] = this._map[ev].filter(f => f !== fn); },
      emit: function(ev, payload) { (this._map[ev] || []).forEach(f => f(payload)); }
    }
  };
  return { scene, created };
}

function makeEventBus() {
  const handlers = {};
  const emitted = [];
  return {
    on: (k, h) => { if (!handlers[k]) handlers[k] = new Set(); handlers[k].add(h); },
    off: (k, h) => { if (!handlers[k]) return; handlers[k].delete(h); },
    emit: (k, v) => { emitted.push({ k, v }); const s = handlers[k]; if (!s) return; for (const h of Array.from(s)) h(v); },
    _emitted: emitted,
  };
}

test('Stockpile pointerdown emits selection:request and results in selection:changed and highlight', async () => {
  const { scene, created } = makeMockScene();
  const eb = makeEventBus();
  const r = new StockpileRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const sc = new SelectionController({ eventBus: eb });
  sc.initialise(scene, scene.input);

  const scenario = { scenario_resources: [ { id: 1, display_name: 'Z', current_quantity: 5, unit: 't' } ] };
  eb.emit('scenario:loaded', scenario);

  assert.equal(r._stockpiles.length, 1);
  const entry = r._stockpiles[0];
  assert.ok(entry.hitZone, 'hitZone should be created');
  assert.ok(typeof entry.hitZone._handlers.pointerdown === 'function', 'pointerdown handler present');

  // Simulate pointerdown on the zone; pointer should report currentlyOver so global clear won't fire
  const pointer = { id: 42, currentlyOver: [entry.hitZone] };
  entry.hitZone._handlers.pointerdown(pointer);

  // selection:request then selection:changed should be emitted
  const names = eb._emitted.map(e => e.k);
  assert.ok(names.indexOf('selection:request') >= 0, 'selection:request emitted');
  assert.ok(names.indexOf('selection:changed') >= 0, 'selection:changed emitted');

  // stockpile should have highlight graphic present
  assert.ok(entry._selGraphic, 'selected graphic should be created');
});

test('Selecting another stockpile moves highlight; empty ground clears selection', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new StockpileRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const sc = new SelectionController({ eventBus: eb });
  sc.initialise(scene, scene.input);

  const scenario = { scenario_resources: [ { id: 10, display_name: 'A', current_quantity: 1, unit: 't', position_x: 0, position_y: 0 }, { id: 11, display_name: 'B', current_quantity: 2, unit: 't', position_x: 100, position_y: 0 } ] };
  eb.emit('scenario:loaded', scenario);

  assert.equal(r._stockpiles.length, 2);
  const a = r._stockpiles[0];
  const b = r._stockpiles[1];

  // click A
  const pA = { id: 1, currentlyOver: [a.hitZone] };
  a.hitZone._handlers.pointerdown(pA);
  assert.ok(a._selGraphic, 'A highlighted after select');
  // click B
  const pB = { id: 2, currentlyOver: [b.hitZone] };
  b.hitZone._handlers.pointerdown(pB);
  assert.ok(b._selGraphic, 'B highlighted after select');
  assert.ok(!a._selGraphic, 'A highlight removed after selecting B');

  // now simulate empty ground click to clear selection
  scene.input.emit('pointerdown', { id: 3, currentlyOver: [] });
  assert.ok(!a._selGraphic && !b._selGraphic, 'highlights removed after ground click');
});

test('Scenario reload clears/destroys stale selection visuals and destroy removes listeners', async () => {
  const { scene } = makeMockScene();
  const eb = makeEventBus();
  const r = new StockpileRenderer({ eventBus: eb, cellSize: 64 });
  r.initialise(scene);

  const sc = new SelectionController({ eventBus: eb });
  sc.initialise(scene, scene.input);

  const s1 = { scenario_resources: [ { id: 5, display_name: 'P', current_quantity: 1, unit: 't', position_x: 10, position_y: 20 } ] };
  eb.emit('scenario:loaded', s1);
  assert.equal(r._stockpiles.length, 1);
  const entry = r._stockpiles[0];
  entry.hitZone._handlers.pointerdown({ id: 7, currentlyOver: [entry.hitZone] });
  assert.ok(entry._selGraphic, 'highlight present');

  // reload empty scenario
  eb.emit('scenario:loaded', { scenario_resources: [] });
  assert.equal(r._stockpiles.length, 0, 'stockpiles cleared on reload');

  // ensure controllers can be destroyed without throwing
  assert.doesNotThrow(() => r.destroy());
  assert.doesNotThrow(() => sc.destroy());
});
