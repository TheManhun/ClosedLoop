import test from 'node:test';
import assert from 'node:assert/strict';
import GridRenderer from '../resources/js/v2/renderer/GridRenderer.js';

function makeFakeGraphics(calls) {
  return {
    clear: () => { calls.push(['clear']); },
    lineStyle: (w, color, alpha) => { calls.push(['lineStyle', w, color, alpha]); },
    lineBetween: (x1, y1, x2, y2) => { calls.push(['lineBetween', x1, y1, x2, y2]); },
    destroy: () => { calls.push(['destroy']); }
  };
}

function makeFakeEvents() {
  const handlers = {};
  return {
    on(event, fn) { handlers[event] = handlers[event] || []; handlers[event].push(fn); },
    off(event, fn) { if (!handlers[event]) return; handlers[event] = handlers[event].filter(f => f !== fn); },
    emit(event, ...args) { (handlers[event] || []).forEach(f => f(...args)); },
    _handlers: handlers
  };
}

test('GridRenderer constructs in Node without Phaser globals', () => {
  const g = new GridRenderer();
  assert.equal(typeof g, 'object');
});

test('destroy before initialise is safe and idempotent', () => {
  const g = new GridRenderer();
  assert.doesNotThrow(() => g.destroy());
  assert.doesNotThrow(() => g.destroy());
});

test('initial draw aligns first visible line for positive and negative camera coordinates', () => {
  const calls = [];
  const fakeGraphics = makeFakeGraphics(calls);
  const events = makeFakeEvents();

  const fakeScene = {
    add: { graphics: () => fakeGraphics },
    events,
    cameras: { main: { worldView: { x: 100, y: 150, width: 800, height: 600 }, zoom: 1 } }
  };

  const g = new GridRenderer();
  g.initialise(fakeScene);

  // trigger update
  events.emit('update');

  // find vertical lines (lineBetween where x1===x2)
  const verticals = calls.filter(c => c[0] === 'lineBetween' && c[1] === c[3]);
  const xs = verticals.map(v => v[1]);
  const minX = Math.min(...xs);
  const expectedStartX = Math.floor(100 / g.cellSize) * g.cellSize;
  assert.equal(minX, expectedStartX);

  // Now test negative coordinates
  calls.length = 0;
  fakeScene.cameras.main.worldView.x = -50;
  fakeScene.cameras.main.worldView.y = -30;
  events.emit('update');
  const verticals2 = calls.filter(c => c[0] === 'lineBetween' && c[1] === c[3]);
  const xs2 = verticals2.map(v => v[1]);
  const minX2 = Math.min(...xs2);
  const expectedStartX2 = Math.floor(-50 / g.cellSize) * g.cellSize;
  assert.equal(minX2, expectedStartX2);

  g.destroy();
});

test('visible bounds coverage and extra cell beyond edges', () => {
  const calls = [];
  const fakeGraphics = makeFakeGraphics(calls);
  const events = makeFakeEvents();
  const vw = { x: 0, y: 0, width: 300, height: 200 };
  const fakeScene = { add: { graphics: () => fakeGraphics }, events, cameras: { main: { worldView: vw, zoom: 1 } } };
  const g = new GridRenderer();
  g.initialise(fakeScene);
  events.emit('update');

  // compute expected endX/endY
  const cs = g.cellSize;
  const expectedEndX = Math.ceil((vw.x + vw.width) / cs) * cs + cs;
  const expectedEndY = Math.ceil((vw.y + vw.height) / cs) * cs + cs;

  const verticals = calls.filter(c => c[0] === 'lineBetween' && c[1] === c[3]);
  const xs = verticals.map(v => v[1]);
  const maxX = Math.max(...xs);
  assert.ok(maxX >= expectedEndX - 0.0001);

  const horizontals = calls.filter(c => c[0] === 'lineBetween' && c[2] === c[4] || c[0] === 'lineBetween');
  const ys = calls.filter(c => c[0] === 'lineBetween').map(c => c[2] === c[0] ? null : c[2]);
  // instead, find horizontal calls by y equality on positions
  const hor = calls.filter(c => c[0] === 'lineBetween' && c[2] !== c[1]);
  const yVals = hor.map(h => h[2]);
  const maxY = Math.max(...yVals);
  assert.ok(maxY >= expectedEndY - 0.0001);

  g.destroy();
});

test('redraw when camera scroll or zoom changes, no redraw when unchanged', () => {
  const calls = [];
  const fakeGraphics = makeFakeGraphics(calls);
  const events = makeFakeEvents();
  const cam = { worldView: { x: 0, y: 0, width: 200, height: 200 }, zoom: 1 };
  const fakeScene = { add: { graphics: () => fakeGraphics }, events, cameras: { main: cam } };
  const g = new GridRenderer();
  g.initialise(fakeScene);

  // first update -> draw
  events.emit('update');
  const callsAfterFirst = calls.filter(c => c[0] === 'lineBetween').length;
  assert.ok(callsAfterFirst > 0);

  // same state -> no new draw
  events.emit('update');
  const callsAfterSecond = calls.filter(c => c[0] === 'lineBetween').length;
  assert.equal(callsAfterSecond, callsAfterFirst);

  // change scroll -> draw more
  cam.worldView.x = 50;
  events.emit('update');
  const callsAfterThird = calls.filter(c => c[0] === 'lineBetween').length;
  assert.ok(callsAfterThird > callsAfterSecond);

  // change zoom -> draw more
  cam.zoom = 2;
  events.emit('update');
  const callsAfterFourth = calls.filter(c => c[0] === 'lineBetween').length;
  assert.ok(callsAfterFourth > callsAfterThird);

  g.destroy();
});

test('destroy removes listener and destroys graphics idempotently', () => {
  const calls = [];
  const fakeGraphics = makeFakeGraphics(calls);
  const events = makeFakeEvents();
  const fakeScene = { add: { graphics: () => fakeGraphics }, events, cameras: { main: { worldView: { x: 0, y: 0, width: 100, height: 100 }, zoom: 1 } } };
  const g = new GridRenderer();
  g.initialise(fakeScene);
  // ensure on was registered
  assert.ok(events._handlers['update'] && events._handlers['update'].length > 0);
  g.destroy();
  // ensure off removed handler
  const remaining = events._handlers['update'] ? events._handlers['update'].length : 0;
  assert.equal(remaining, 0);
  // destroy again is safe
  assert.doesNotThrow(() => g.destroy());
});
