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
      global.document.createElement = (tag) => {
        const node = {
          tagName: tag.toUpperCase(),
          style: {},
          className: '',
          id: '',
          type: '',
          src: '',
          alt: '',
          value: '',
          onclick: null,
          parentNode: null,
          children: [],
          _attrs: {},
          _innerText: '',
          setAttribute(name, value) {
            this._attrs[name] = value;
            if (name === 'class') this.className = value;
          },
          appendChild(c) { this.children.push(c); c.parentNode = this; },
          removeChild(c) { this.children = this.children.filter((child) => child !== c); },
          querySelector(sel) { const cls = sel && sel[0] === '.' ? sel.slice(1) : sel; return this.children.find(ch => ch.className === cls) || null; },
          querySelectorAll(sel) { const cls = sel && sel[0] === '.' ? sel.slice(1) : sel; return this.children.filter(ch => ch.className === cls); }
        };

        Object.defineProperty(node, 'innerText', {
          get() { return this._innerText; },
          set(value) {
            this._innerText = value == null ? '' : String(value);
            this.children = [];
          },
          configurable: true,
        });

        Object.defineProperty(node, 'textContent', {
          get() {
            const collect = (current) => {
              if (!current) return '';
              const values = [];
              if (current.children && current.children.length > 0) {
                for (const child of current.children) {
                  const childText = collect(child);
                  if (childText) values.push(childText);
                }
              }
              if (typeof current.innerText === 'string' && current.innerText.trim() && current.children.length === 0) {
                values.push(current.innerText.trim());
              }
              return values.join('\n');
            };
            return collect(node).trim();
          },
          set(value) {
            this._innerText = value == null ? '' : String(value);
            this.children = [];
          },
          configurable: true,
        });

        return node;
      };
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

function collect(node, predicate) {
  if (!node) return [];
  const results = [];
  const walk = (current) => {
    if (!current) return;
    if (predicate(current)) results.push(current);
    if (Array.isArray(current.children)) {
      for (const child of current.children) walk(child);
    }
  };
  walk(node);
  return results;
}

function clickButton(panel, label) {
  const matches = collect(panel, (n) => n && n.tagName === 'BUTTON' && (n.innerText || n.textContent) === label);
  assert.ok(matches.length > 0, `button ${label} exists`);
  if (matches[0].onclick) matches[0].onclick({ preventDefault() {} });
}

test('ContextPanel: resource selection renders Recommended Technologies', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = {
    getCompatibleMachinesForResource: () => [{ id: 3, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', {
    kind: 'resource',
    meta: { display_name: 'Agricultural Organic Residues', current_quantity: 30000, unit: 'tonnes/year', resource: { id: 14 } }
  });

  const panel = root.querySelector('.v2-context-panel');
  assert.ok(panel, 'context panel created');
  const txt = panel.textContent || '';
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('Anaerobic Digester'));
  cp.destroy();
});

test('ContextPanel: Agricultural Organic Residues / resource 14 produces Anaerobic Digester through compatibility data', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = {
    getCompatibleMachinesForResource: (rid) => (Number(rid) === 14 ? [{ id: 10, name: 'Anaerobic Digester', category: 'Biological Processing' }] : []),
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  const txt = (panel && panel.textContent) || '';
  assert.ok(txt.includes('Agricultural Organic Residues'));
  assert.ok(txt.includes('Anaerobic Digester'));
  cp.destroy();
});

test('ContextPanel: technology Select emits technology:selected and does not place anything', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const emitted = [];
  bus.on('technology:selected', (payload) => emitted.push(payload));

  const mockTech = {
    getCompatibleMachinesForResource: () => [{ id: 17, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Select');

  assert.equal(emitted.length, 1, 'technology:selected emitted once');
  assert.equal(emitted[0].machine.name, 'Anaerobic Digester');
  assert.equal(emitted[0].resource.display_name, 'Agricultural Organic Residues');
  cp.destroy();
});

test('ContextPanel: Show All Technologies shows the complete loaded machine catalogue', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Composting Unit', category: 'Biological Processing' },
    { id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 3, name: 'Biomass Dryer', category: 'Thermal Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  const txt = panel.textContent || '';
  const catalogue = panel.querySelector('.v2-context-catalogue');
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('ALL TECHNOLOGIES'));
  assert.ok(txt.includes('Composting Unit'));
  assert.ok(txt.includes('Biomass Dryer'));
  assert.ok(catalogue, 'catalogue container created');
  assert.equal(catalogue.style.overflowY, 'auto');
  assert.ok(panel.textContent.includes('Hide All Technologies ▲'));
  cp.destroy();
});

test('ContextPanel: returning from Show All restores the current resource recommendations', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Composting Unit', category: 'Biological Processing' },
    { id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  clickButton(panel, 'Hide All Technologies ▲');

  const txt = panel.textContent || '';
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('Anaerobic Digester'));
  assert.ok(txt.includes('Show All Technologies ▼'));
  assert.ok(!panel.querySelector('.v2-context-catalogue'), 'catalogue hidden when back to recommendations');
  cp.destroy();
});

test('ContextPanel: no-match resource renders the no-compatible message', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = { getCompatibleMachinesForResource: () => [] };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'X', resource: { id: 999 } } });

  const panel = root.querySelector('.v2-context-panel');
  const txt = panel.textContent || '';
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('No compatible technologies defined yet.'));
  cp.destroy();
});

test('ContextPanel: repeated selection does not duplicate panels', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = { getCompatibleMachinesForResource: () => [{ id: 10, name: 'Anaerobic Digester', category: 'Biological Processing' }] };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  assert.equal(root.querySelectorAll('.v2-context-panel').length, 1, 'single panel remains mounted');
  cp.destroy();
});
