import test from 'node:test';
import assert from 'node:assert/strict';
import InputController from '../resources/js/v2/renderer/InputController.js';

function makeFakeInput(handlers) {
  const map = {};
  return {
    on(event, fn) { map[event] = map[event] || []; map[event].push(fn); handlers.push(['on', event]); },
    off(event, fn) { if (!map[event]) return; map[event] = map[event].filter(f => f !== fn); handlers.push(['off', event]); },
    emit(event, payload) { (map[event] || []).forEach(f => f(payload)); handlers.push(['emit', event, payload]); },
    _map: map
  };
}

function makeFakeCamera() {
  // simulate camera with scroll and zoom and a getWorldPoint method
  const cam = { scrollX: 0, scrollY: 0, zoom: 1 };
  cam.getWorldPoint = (sx, sy) => {
    const x = (sx / cam.zoom) + cam.scrollX;
    const y = (sy / cam.zoom) + cam.scrollY;
    return { x, y };
  };
  return cam;
}

test('InputController constructs in Node without Phaser globals', () => {
  const ic = new InputController();
  assert.equal(typeof ic, 'object');
});

test('destroy before initialise is safe and idempotent', () => {
  const ic = new InputController();
  assert.doesNotThrow(() => ic.destroy());
  assert.doesNotThrow(() => ic.destroy());
});

test('initialise registers pointermove and updates screen/world coordinates', () => {
  const calls = [];
  const fakeInput = makeFakeInput(calls);
  const cam = makeFakeCamera();
  const fakeScene = { input: fakeInput, cameras: { main: cam } };

  const ic = new InputController();
  ic.initialise(fakeScene);

  // ensure on registered
  assert.ok(calls.find(c => c[0] === 'on' && c[1] === 'pointermove'));
  // ensure over/out registered
  assert.ok(calls.find(c => c[0] === 'on' && c[1] === 'pointerover'));
  assert.ok(calls.find(c => c[0] === 'on' && c[1] === 'pointerout'));

  // emit pointermove
  fakeInput.emit('pointermove', { x: 100, y: 50 });
  const screen = ic.getPointerScreen();
  const world = ic.getPointerWorld();
  assert.equal(screen.x, 100);
  assert.equal(screen.y, 50);
  assert.equal(world.x, 100 / cam.zoom + cam.scrollX);
  assert.equal(world.y, 50 / cam.zoom + cam.scrollY);

  // change camera state and emit again
  cam.scrollX = 200;
  cam.scrollY = -10;
  cam.zoom = 2;
  fakeInput.emit('pointermove', { x: 100, y: 50 });
  const world2 = ic.getPointerWorld();
  assert.equal(world2.x, 100 / cam.zoom + cam.scrollX);
  assert.equal(world2.y, 50 / cam.zoom + cam.scrollY);

  // destroy removes handler
  ic.destroy();
  assert.ok(calls.find(c => c[0] === 'off' && c[1] === 'pointermove'));
  assert.ok(calls.find(c => c[0] === 'off' && c[1] === 'pointerover'));
  assert.ok(calls.find(c => c[0] === 'off' && c[1] === 'pointerout'));

  // repeated destroy safe
  assert.doesNotThrow(() => ic.destroy());
});
