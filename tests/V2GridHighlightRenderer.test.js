import test from 'node:test';
import assert from 'node:assert/strict';
import GridHighlightRenderer from '../resources/js/v2/renderer/GridHighlightRenderer.js';

function makeFakeGraphics(calls) {
  return {
    clear: () => { calls.push(['clear']); },
    fillStyle: (color, alpha) => { calls.push(['fillStyle', color, alpha]); },
    fillRect: (x, y, w, h) => { calls.push(['fillRect', x, y, w, h]); },
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

test('GridHighlightRenderer constructs in Node without Phaser globals', () => {
  const g = new GridHighlightRenderer();
  assert.equal(typeof g, 'object');
});

test('destroy before initialise is safe and idempotent', () => {
  const g = new GridHighlightRenderer();
  assert.doesNotThrow(() => g.destroy());
  assert.doesNotThrow(() => g.destroy());
});

test('initialise draws highlight aligned to grid and hides on pointer out', () => {
  const calls = [];
  const fakeGraphics = makeFakeGraphics(calls);
  const events = makeFakeEvents();

  const fakeScene = { add: { graphics: () => fakeGraphics }, events };

  // fake input controller
  let inside = true;
  let world = { x: 150, y: 90 };
  const fakeInput = {
    isPointerInside: () => inside,
    getPointerWorld: () => ({ x: world.x, y: world.y })
  };

  const g = new GridHighlightRenderer();
  g.initialise(fakeScene, fakeInput);

  // trigger update -> draw
  events.emit('update');
  // expected cell origin
  const cs = g.cellSize;
  const expectedX = Math.floor(world.x / cs) * cs;
  const expectedY = Math.floor(world.y / cs) * cs;

  const rectCalls = calls.filter(c => c[0] === 'fillRect');
  assert.ok(rectCalls.length > 0, 'expected fillRect to be called');
  const [, x, y, w, h] = rectCalls[0];
  assert.equal(x, expectedX);
  assert.equal(y, expectedY);
  assert.equal(w, cs);
  assert.equal(h, cs);

  // same cell -> no redraw
  calls.length = 0;
  events.emit('update');
  const rectsAfter = calls.filter(c => c[0] === 'fillRect').length;
  assert.equal(rectsAfter, 0);

  // move to another cell
  world = { x: 500, y: -10 };
  events.emit('update');
  const rects2 = calls.filter(c => c[0] === 'fillRect');
  assert.ok(rects2.length > 0, 'expected redraw when cell changed');

  // pointer out -> hide
  calls.length = 0;
  inside = false;
  events.emit('update');
  const clears = calls.filter(c => c[0] === 'clear').length;
  assert.ok(clears > 0, 'expected clear when pointer out');

  g.destroy();
});
