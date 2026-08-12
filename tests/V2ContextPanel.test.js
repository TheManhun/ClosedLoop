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
          querySelector(sel) {
            if (!sel) return null;
            const matchesSelector = (node, selector) => {
              if (!node) return false;
              if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                return node.className === cls;
              }
              if (selector.startsWith('input[')) {
                const match = selector.match(/^input\[type="?([^"]+)"?\]$/i);
                if (match) return node.tagName === 'INPUT' && (node.type || '').toLowerCase() === match[1].toLowerCase();
                return node.tagName === 'INPUT';
              }
              if (selector.startsWith('[type="')) {
                const match = selector.match(/^\[type="?([^"]+)"?\]$/i);
                if (match) return (node.type || '').toLowerCase() === match[1].toLowerCase();
              }
              return node.tagName === selector.toUpperCase();
            };
            const walk = (current) => {
              if (!current) return null;
              if (matchesSelector(current, sel)) return current;
              for (const child of current.children || []) {
                const match = walk(child);
                if (match) return match;
              }
              return null;
            };
            return walk(this);
          },
          querySelectorAll(sel) {
            if (!sel) return [];
            const matchesSelector = (node, selector) => {
              if (!node) return false;
              if (selector.startsWith('.')) {
                const cls = selector.slice(1);
                return node.className === cls;
              }
              if (selector.startsWith('input[')) {
                const match = selector.match(/^input\[type="?([^"]+)"?\]$/i);
                if (match) return node.tagName === 'INPUT' && (node.type || '').toLowerCase() === match[1].toLowerCase();
                return node.tagName === 'INPUT';
              }
              if (selector.startsWith('[type="')) {
                const match = selector.match(/^\[type="?([^"]+)"?\]$/i);
                if (match) return (node.type || '').toLowerCase() === match[1].toLowerCase();
              }
              return node.tagName === selector.toUpperCase();
            };
            const results = [];
            const walk = (current) => {
              if (!current) return;
              if (matchesSelector(current, sel)) results.push(current);
              for (const child of current.children || []) walk(child);
            };
            walk(this);
            return results;
          }
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

function clickStar(panel, label = '☆') {
  const matches = collect(panel, (n) => n && n.tagName === 'BUTTON' && (n.innerText || n.textContent) === label);
  assert.ok(matches.length > 0, `star button ${label} exists`);
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

test('ContextPanel: catalogue dropdown includes All Technologies, Favourites and sorted categories', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Sorting Shed', category: 'Logistics' },
    { id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 3, name: 'Biogas Tank', category: 'Biological Processing' },
    { id: 4, name: 'Mixer', category: ' ' },
    { id: 5, name: 'Composter', category: null },
    { id: 6, name: 'Dryer', category: 'Thermal Processing' },
    { id: 7, name: 'Duplicate', category: 'Logistics' },
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
  const select = panel.querySelector('select');
  assert.ok(select, 'catalogue selector exists');
  const values = Array.from(select.children).map((opt) => opt.value || opt.innerText || opt.textContent || '');
  assert.deepEqual(values[0], 'All Technologies');
  assert.deepEqual(values[1], '★ Favourites');
  assert.ok(values.includes('Biological Processing'));
  assert.ok(values.includes('Logistics'));
  assert.ok(values.includes('Thermal Processing'));
  assert.ok(!values.includes(''));
  assert.ok(!values.includes(' '));
  assert.ok(!values.includes('null'));
  assert.equal(new Set(values).size, values.length, 'duplicate categories are removed');
  assert.deepEqual([...values].slice(2).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [...values].slice(2));
  cp.destroy();
});

test('ContextPanel: filtering All Technologies only affects the catalogue and leaves recommendations alone', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Sorting Shed', category: 'Logistics' },
    { id: 2, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 3, name: 'Biogas Tank', category: 'Biological Processing' },
    { id: 4, name: 'Dryer', category: 'Thermal Processing' },
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
  const select = panel.querySelector('select');
  select.value = 'Biological Processing';
  if (select.onchange) select.onchange({ target: select });

  const txt = panel.textContent || '';
  assert.ok(txt.includes('Anaerobic Digester'));
  assert.ok(txt.includes('Biogas Tank'));
  assert.ok(!txt.includes('Sorting Shed'));
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('Anaerobic Digester'));

  select.value = 'All Technologies';
  if (select.onchange) select.onchange({ target: select });
  const restored = panel.textContent || '';
  assert.ok(restored.includes('Sorting Shed'));
  assert.ok(restored.includes('Dryer'));
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

test('ContextPanel: favourite star toggles on and off for a machine', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = {
    getCompatibleMachinesForResource: () => [{ id: 7, name: 'Gas Generator', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickStar(panel, '☆');
  assert.ok(cp._favouriteMachineIds.has(7), 'machine was favourited');

  clickStar(panel, '★');
  assert.ok(!cp._favouriteMachineIds.has(7), 'machine was unfavourited');
  cp.destroy();
});

test('ContextPanel: favourite state is shared between Recommended and All cards', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 7, name: 'Gas Generator', category: 'Energy' },
    { id: 8, name: 'Biogas Tank', category: 'Energy' },
    { id: 9, name: 'Composting Unit', category: 'Biological Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 7, name: 'Gas Generator', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickStar(panel, '☆');
  clickButton(panel, 'Show All Technologies ▼');
  const allText = (panel.textContent || '');
  assert.ok(cp._favouriteMachineIds.has(7));
  assert.ok(allText.includes('Gas Generator'));
  assert.ok(allText.includes('★'));
  cp.destroy();
});

test('ContextPanel: favourites filter shows only favourited catalogue entries', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 7, name: 'Gas Generator', category: 'Energy' },
    { id: 8, name: 'Biogas Tank', category: 'Energy' },
    { id: 9, name: 'Composting Unit', category: 'Biological Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 7, name: 'Gas Generator', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');

  const gasGenButton = collect(panel, (n) => n && n.tagName === 'BUTTON' && (n.innerText || n.textContent) === '☆')[0];
  if (gasGenButton && gasGenButton.onclick) gasGenButton.onclick({ preventDefault() {} });

  const select = panel.querySelector('select');
  select.value = '★ Favourites';
  if (select.onchange) select.onchange({ target: select });

  let catalogueText = (panel.querySelector('.v2-context-catalogue') && panel.querySelector('.v2-context-catalogue').textContent) || '';
  assert.ok(catalogueText.includes('Gas Generator'));
  assert.ok(!catalogueText.includes('Composting Unit'));

  clickStar(panel, '★');
  catalogueText = (panel.querySelector('.v2-context-catalogue') && panel.querySelector('.v2-context-catalogue').textContent) || '';
  assert.ok(!catalogueText.includes('Gas Generator'));
  assert.ok(!catalogueText.includes('Composting Unit'));
  cp.destroy();
});

test('ContextPanel: category + search combine in the catalogue and favourites remains a separate option', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 7, name: 'Gas Generator', category: 'Energy' },
    { id: 8, name: 'Biogas Tank', category: 'Energy' },
    { id: 9, name: 'Biogas Filter', category: 'Treatment' },
    { id: 10, name: 'Composting Unit', category: 'Biological Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 7, name: 'Gas Generator', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  const select = panel.querySelector('select');
  const searchInput = panel.querySelector('input[type="search"]');

  const gasGenButton = collect(panel, (n) => n && n.tagName === 'BUTTON' && (n.innerText || n.textContent) === '☆')[0];
  if (gasGenButton && gasGenButton.onclick) gasGenButton.onclick({ preventDefault() {} });

  const biogasButton = collect(panel, (n) => n && n.tagName === 'BUTTON' && (n.innerText || n.textContent) === '☆' && n !== gasGenButton)[0];
  if (biogasButton && biogasButton.onclick) biogasButton.onclick({ preventDefault() {} });

  select.value = 'Energy';
  if (select.onchange) select.onchange({ target: select });
  searchInput.value = 'gas';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  const txt = panel.textContent || '';
  assert.ok(txt.includes('Gas Generator'));
  assert.ok(txt.includes('Biogas Tank'));
  assert.ok(!txt.includes('Composting Unit'));
  assert.ok(!txt.includes('Biogas Filter'));
  cp.destroy();
});

test('ContextPanel: changing selected resource does not erase favourites', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 7, name: 'Gas Generator', category: 'Energy' },
    { id: 8, name: 'Biogas Tank', category: 'Energy' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: (rid) => Number(rid) === 14 ? [{ id: 7, name: 'Gas Generator', category: 'Energy' }] : [{ id: 8, name: 'Biogas Tank', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickStar(panel, '☆');
  assert.ok(cp._favouriteMachineIds.has(7));

  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Food Waste', resource: { id: 22 } } });
  assert.ok(cp._favouriteMachineIds.has(7), 'favourite state persists after resource change');
  cp.destroy();
});

test('ContextPanel: recommendations remain unchanged by favourite state', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const mockTech = {
    getCompatibleMachinesForResource: () => [{ id: 7, name: 'Gas Generator', category: 'Energy' }, { id: 8, name: 'Biogas Tank', category: 'Energy' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickStar(panel, '☆');
  const txt = (panel.textContent || '');
  assert.ok(txt.includes('Gas Generator'));
  assert.ok(txt.includes('Biogas Tank'));
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  cp.destroy();
});

test('ContextPanel: search filters the All Technologies catalogue by name and is case-insensitive', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 2, name: 'Composting Unit', category: 'Biological Processing' },
    { id: 3, name: 'Thermal Dryer', category: 'Thermal Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  const searchInput = panel.querySelector('input[type="search"]');
  assert.ok(searchInput, 'search input exists');
  searchInput.value = 'DIG';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  const txt = panel.textContent || '';
  assert.ok(txt.includes('Anaerobic Digester'));
  assert.ok(!txt.includes('Composting Unit'));
  assert.ok(!txt.includes('Thermal Dryer'));
  cp.destroy();
});

test('ContextPanel: category and search combine and clearing search restores the filtered catalogue', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 2, name: 'Composting Unit', category: 'Biological Processing' },
    { id: 3, name: 'Thermal Dryer', category: 'Thermal Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  const select = panel.querySelector('select');
  select.value = 'Biological Processing';
  if (select.onchange) select.onchange({ target: select });

  const searchInput = panel.querySelector('input[type="search"]');
  searchInput.value = 'comp';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  const catalogue = panel.querySelector('.v2-context-catalogue');
  assert.ok(catalogue, 'catalogue container exists');

  let txt = catalogue.textContent || '';
  assert.ok(txt.includes('Composting Unit'));
  assert.ok(!txt.includes('Anaerobic Digester'));

  searchInput.value = '';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  const refreshedCatalogue = panel.querySelector('.v2-context-catalogue');
  assert.ok(refreshedCatalogue, 'catalogue refreshed after clearing search');
  txt = refreshedCatalogue.textContent || '';
  assert.ok(txt.includes('Anaerobic Digester'));
  assert.ok(txt.includes('Composting Unit'));
  assert.ok(!txt.includes('Thermal Dryer'));
  cp.destroy();
});

test('ContextPanel: search by category and no-match message are shown without affecting recommendations', () => {
  const root = makeRoot();
  const bus = new MockBus();
  const allMachines = [
    { id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' },
    { id: 2, name: 'Composting Unit', category: 'Biological Processing' },
    { id: 3, name: 'Thermal Dryer', category: 'Thermal Processing' },
  ];
  const mockTech = {
    dataLoader: { getMachines: () => allMachines },
    getCompatibleMachinesForResource: () => [{ id: 1, name: 'Anaerobic Digester', category: 'Biological Processing' }],
  };
  const cp = new ContextPanel({ eventBus: bus, technology: mockTech });
  cp.initialise();
  bus.emit('selection:changed', { kind: 'resource', meta: { display_name: 'Agricultural Organic Residues', resource: { id: 14 } } });

  const panel = root.querySelector('.v2-context-panel');
  clickButton(panel, 'Show All Technologies ▼');
  const searchInput = panel.querySelector('input[type="search"]');
  searchInput.value = 'thermal';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  let txt = panel.textContent || '';
  assert.ok(txt.includes('Thermal Dryer'));
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('Anaerobic Digester'));

  searchInput.value = 'zzz-nomatch';
  if (searchInput.oninput) searchInput.oninput({ target: searchInput });

  txt = panel.textContent || '';
  assert.ok(txt.includes('No technologies match your filters.'));
  assert.ok(txt.includes('RECOMMENDED TECHNOLOGIES'));
  assert.ok(txt.includes('Anaerobic Digester'));
  cp.destroy();
});
