import test from 'node:test';
import assert from 'node:assert/strict';

import SelectionInspector from '../resources/js/v2/ui/SelectionInspector.js';

class MockBus {
  constructor() { this._m = new Map(); }
  on(k,h) { if (!this._m.has(k)) this._m.set(k,new Set()); this._m.get(k).add(h); }
  off(k,h) { const s=this._m.get(k); if (s) s.delete(h); }
  emit(k,v) { const s=this._m.get(k); if (!s) return; for (const h of Array.from(s)) try { h(v); } catch(e){} }
}

function makeRoot() {
  // Ensure minimal DOM for Node test environment
  if (typeof document === 'undefined') {
    global.document = global.document || {};
    if (typeof global.document.getElementById !== 'function') {
      const store = {};
      global.document.getElementById = (id) => store[id] || null;
      global.document.createElement = (tag) => ({ tagName: tag, style: {}, className: '', setAttribute() {}, parentNode: null, children: [], appendChild(c) { this.children.push(c); c.parentNode = this; }, querySelector(sel) { const cls = sel && sel[0] === '.' ? sel.slice(1) : sel; return this.children.find(ch => ch.className === cls) || null; } });
      global.document.body = { appendChild(e) { store[e.id] = e; } };
      global.document._store = store;
      global.document.getElementById = (id) => store[id] || null;
    }
  }
  const root = document.createElement('div');
  root.id = 'closed-loop-v2-ui';
  document.body.appendChild(root);
  return root;
}

test('Resource payload renders name + quantity + unit', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const si = new SelectionInspector({ eventBus: bus });
  si.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'TestRes', current_quantity: 1234, unit: 't' , resource: { visual_type: 'bulk_solid' } } });
  const el = root.querySelector('.v2-selection-inspector');
  assert.ok(el, 'inspector element created');
  const txt = el.textContent || '';
  assert.ok(txt.includes('TestRes'));
  assert.ok(txt.includes('1234'));
  assert.ok(txt.includes('t'));
  si.destroy();
});

test('Object payload renders name + fixed/selectable', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const si = new SelectionInspector({ eventBus: bus });
  si.initialise();

  bus.emit('selection:changed', { kind: 'object', meta: { name: 'Pump', object_type: 'machine', fixed: true, selectable: false } });
  const el = root.querySelector('.v2-selection-inspector');
  const txt = el.textContent || '';
  assert.ok(txt.includes('Pump'));
  assert.ok(txt.includes('fixed: true'));
  assert.ok(txt.includes('selectable: false'));
  si.destroy();
});

test('Ground payload renders coordinates', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const si = new SelectionInspector({ eventBus: bus });
  si.initialise();

  bus.emit('selection:changed', { kind: 'ground', world: { x: 10.5, y: -2 } });
  const el = root.querySelector('.v2-selection-inspector');
  const txt = el.textContent || '';
  assert.ok(txt.includes('Ground'));
  assert.ok(txt.includes('X: 10'));
  assert.ok(txt.includes('Y: -2'));
  si.destroy();
});

test('Clear hides panel', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const si = new SelectionInspector({ eventBus: bus });
  si.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'X' } });
  const el = root.querySelector('.v2-selection-inspector');
  assert.equal(el.style.display, 'block');
  bus.emit('selection:changed', { kind: 'clear' });
  assert.equal(el.style.display, 'none');
  si.destroy();
});
