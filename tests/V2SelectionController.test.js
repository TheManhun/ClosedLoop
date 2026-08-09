import test from 'node:test';
import assert from 'node:assert/strict';

import SelectionController from '../resources/js/v2/selection/SelectionController.js';

// Minimal mock EventBus to capture emits and allow on/off
class MockEventBus {
  constructor() { this._handlers = new Map(); this.emits = []; }
  on(k, h) { if (!this._handlers.has(k)) this._handlers.set(k, new Set()); this._handlers.get(k).add(h); }
  off(k, h) { const s = this._handlers.get(k); if (s) s.delete(h); }
  emit(k, v) { this.emits.push({ k, v }); const s = this._handlers.get(k); if (s) for (const h of Array.from(s)) try { h(v); } catch (e) {} }
}

// Minimal mock input plugin to register handlers and allow invoking them
class MockInput {
  constructor() { this._handlers = {}; }
  on(name, handler) { if (!this._handlers[name]) this._handlers[name] = []; this._handlers[name].push(handler); }
  off(name, handler) { if (!this._handlers[name]) return; this._handlers[name] = this._handlers[name].filter(h => h !== handler); }
  // helper to invoke
  invoke(name, ...args) { const list = this._handlers[name] || []; for (const h of list) { try { h(...args); } catch (e) {} } }
}

test('SelectionController: later pointerdown with same mouse pointer id clears when currentlyOver empty', async () => {
  const bus = new MockEventBus();
  const input = new MockInput();
  const scene = { input };

  const sc = new SelectionController({ eventBus: bus });
  sc.initialise(scene, null);

  // simulate renderer emitted selection request with pointer id 1
  bus.emit('selection:request', { kind: 'resource', id: 101, _pointerId: 1, world: { x: 10, y: 20 } });

  // first emit should be the resource selection
  assert(bus.emits.length >= 1, 'expected at least one emit after request');
  const first = bus.emits[bus.emits.length - 1];
  assert.equal(first.k, 'selection:changed');
  assert.equal(first.v.kind, 'resource');

  // allow the next-tick timeout in SelectionController to clear _lastPointerId
  await new Promise((r) => setTimeout(r, 0));

  // simulate a later pointerdown with same pointer id but currentlyOver empty
  input.invoke('pointerdown', { id: 1, pointerId: 1, currentlyOver: [], x: 100, y: 200 });

  // now expect a clear event to have been emitted
  const sawClear = bus.emits.some(e => e.k === 'selection:changed' && e.v && e.v.kind === 'clear');
  assert.ok(sawClear, 'expected selection to be cleared by later pointerdown with empty currentlyOver');
});

test('SelectionController: harmless currentlyOver object should NOT block clearing (regression test)', async () => {
  const bus = new MockEventBus();
  const input = new MockInput();
  const scene = { input };

  const sc = new SelectionController({ eventBus: bus });
  sc.initialise(scene, null);

  bus.emit('selection:request', { kind: 'resource', id: 102, _pointerId: 5, world: { x: 50, y: 60 } });
  assert.equal(bus.emits[bus.emits.length - 1].k, 'selection:changed');

  // wait for the microtask timeout to clear the last pointer id
  await new Promise((r) => setTimeout(r, 0));

  // harmless object: input null should be considered non-blocking
  input.invoke('pointerdown', { id: 5, pointerId: 5, currentlyOver: [{ input: null }], x: 400, y: 300 });

  const sawClear = bus.emits.some(e => e.k === 'selection:changed' && e.v && e.v.kind === 'clear');
  // This is the expected behavior we want to enforce (test will fail if current impl blocks on any non-empty currentlyOver)
  assert.ok(sawClear, 'expected harmless currentlyOver object NOT to block clearing (regression)');
});

test('SelectionController: pointerdown over selectable hit zone must NOT clear', async () => {
  const bus = new MockEventBus();
  const input = new MockInput();
  const scene = { input };

  const sc = new SelectionController({ eventBus: bus });
  sc.initialise(scene, null);

  bus.emit('selection:request', { kind: 'resource', id: 200, _pointerId: 9, world: { x: 0, y: 0 } });
  assert.equal(bus.emits[bus.emits.length - 1].k, 'selection:changed');

  await new Promise((r) => setTimeout(r, 0));

  // simulate currentlyOver containing a hit zone object marked as selection target
  input.invoke('pointerdown', { id: 9, pointerId: 9, currentlyOver: [{ _selectionTarget: true }], x: 10, y: 10 });

  const sawClear = bus.emits.some(e => e.k === 'selection:changed' && e.v && e.v.kind === 'clear');
  assert.ok(!sawClear, 'expected pointerdown over selectable hit zone NOT to clear selection');
});

test('SelectionController: same click cycle does not clear immediately (suppression)', async () => {
  const bus = new MockEventBus();
  const input = new MockInput();
  const scene = { input };

  const sc = new SelectionController({ eventBus: bus });
  sc.initialise(scene, null);

  // emit selection request with pointer id 42
  bus.emit('selection:request', { kind: 'resource', id: 300, _pointerId: 42, world: { x: 1, y: 2 } });
  assert.equal(bus.emits[bus.emits.length - 1].k, 'selection:changed');

  // Immediately invoke pointerdown with same id before timeout clears; currentlyOver empty
  input.invoke('pointerdown', { id: 42, pointerId: 42, currentlyOver: [], x: 0, y: 0 });

  // Should NOT have emitted a clear during the same cycle
  const recentClears = bus.emits.filter(e => e.k === 'selection:changed' && e.v && e.v.kind === 'clear');
  assert.equal(recentClears.length, 0, 'expected no immediate clear during same click cycle');
});
