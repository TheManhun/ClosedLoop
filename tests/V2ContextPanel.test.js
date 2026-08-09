import test from 'node:test';
import assert from 'node:assert/strict';

import ContextPanel from '../resources/js/v2/ui/ContextPanel.js';

class MockBus {
  constructor() { this._m = new Map(); }
  on(k,h) { if (!this._m.has(k)) this._m.set(k,new Set()); this._m.get(k).add(h); }
  off(k,h) { const s=this._m.get(k); if (s) s.delete(h); }
  emit(k,v) { const s=this._m.get(k); if (!s) return; for (const h of Array.from(s)) try { h(v); } catch(e){} }
}

function makeRoot() {
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

test('ContextPanel: renders matching machine card when technology returns matches', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = { getCompatibleMachinesForResource: (rid) => [{ id: 3, name: 'Anaerobic Digester', category: 'Biological Processing' }] };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', current_quantity: 30000, unit: 'tonnes/year', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  assert.ok(panel, 'context panel created');
  const txt = panel.textContent || '';
  assert.ok(txt.includes('Compatible Technologies'));
  assert.ok(txt.includes('Anaerobic Digester'));
  cp.destroy();
});

test('ContextPanel: renders no-match message when technology returns empty', async () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = { getCompatibleMachinesForResource: (rid) => [] };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'X', current_quantity: 1, unit: 'u', resource: { id: 999 } } });

  const panel = root.querySelector('.v2-context-panel');
  assert.ok(panel);
  const txt = panel.textContent || '';
  assert.ok(txt.includes('No compatible technologies defined yet.'));
  cp.destroy();
});
