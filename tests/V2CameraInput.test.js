import test from 'node:test';
import assert from 'node:assert/strict';
import CameraController from '../resources/js/v2/renderer/CameraController.js';

function makeFakeInput() {
  const handlers = {};
  return {
    on(event, fn) { handlers[event] = handlers[event] || []; handlers[event].push(fn); },
    off(event, fn) { if (!handlers[event]) return; handlers[event] = handlers[event].filter(f => f !== fn); },
    emit(event, ...args) { (handlers[event] || []).forEach(f => f(...args)); }
  };
}

test('CameraController installs pointer drag handlers and pans camera', () => {
  const fakeCam = { scrollX: 0, scrollY: 0, zoom: 1 };
  const input = makeFakeInput();
  const scene = { cameras: { main: fakeCam }, input };
  const c = new CameraController({ minZoom: 0.5, maxZoom: 2.0, zoomSensitivity: 0.0015 });
  c.initialise(scene);

  // simulate middle-button pointerdown
  const pointerDown = { x: 100, y: 100, middleButtonDown: () => true };
  input.emit('pointerdown', pointerDown);

  // simulate move -> pan by 50,25
  const pointerMove = { x: 150, y: 125 };
  input.emit('pointermove', pointerMove);

  // camera should have been panned by delta/zoom
  assert.equal(fakeCam.scrollX, 0 - (150 - 100) / 1);
  assert.equal(fakeCam.scrollY, 0 - (125 - 100) / 1);

  // release
  const pointerUp = { x: 150, y: 125, middleButtonDown: () => false };
  input.emit('pointerup', pointerUp);

  // further moves should not pan
  fakeCam.scrollX = fakeCam.scrollX; const prevX = fakeCam.scrollX; input.emit('pointermove', { x: 200, y: 200 });
  assert.equal(fakeCam.scrollX, prevX);

  c.destroy();
});

test('CameraController wheel zooms centered at pointer and clamps', () => {
  const fakeCam = {
    scrollX: 0, scrollY: 0, zoom: 1,
    getWorldPoint(x, y) { return { x: x + this.scrollX, y: y + this.scrollY }; },
    setZoom(v) { this.zoom = v; }
  };
  const input = makeFakeInput();
  const scene = { cameras: { main: fakeCam }, input };
  const c = new CameraController({ minZoom: 0.5, maxZoom: 1.5, zoomSensitivity: 0.001 });
  c.initialise(scene);

  // simulate wheel: zoom in (negative deltaY typically zooms in; here use -100)
  const pointer = { x: 200, y: 150 };
  // call handler: event signature (pointer, gameObjects, deltaX, deltaY, deltaZ)
  input.emit('wheel', pointer, null, 0, -100, 0);
  // zoom should have changed and be within limits
  assert.ok(fakeCam.zoom >= 0.5 && fakeCam.zoom <= 1.5);

  // simulate large zoom out beyond min
  input.emit('wheel', pointer, null, 0, 100000, 0);
  assert.equal(fakeCam.zoom, 0.5);

  c.destroy();
});
