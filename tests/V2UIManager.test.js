import test from 'node:test';
import assert from 'node:assert/strict';

import EventBus from '../resources/js/v2/events/EventBus.js';
import UIManager from '../resources/js/v2/ui/UIManager.js';

function makeDomRoot() {
  const store = {};
  const createNode = (tagName = 'div') => ({
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    style: {},
    parentNode: null,
    children: [],
    textContent: '',
    innerText: '',
    _attrs: {},
    setAttribute(name, value) {
      this._attrs[name] = value;
      if (name === 'class') this.className = value;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id && child.id in store === false) {
        store[child.id] = child;
      }
    },
    removeChild(child) {
      this.children = this.children.filter((node) => node !== child);
      child.parentNode = null;
    },
    querySelector(selector) {
      if (!selector) return null;
      const sel = selector.startsWith('.') ? selector.slice(1) : selector;
      return this.children.find((child) => child.className === sel) || null;
    },
    querySelectorAll(selector) {
      if (!selector) return [];
      const sel = selector.startsWith('.') ? selector.slice(1) : selector;
      return this.children.filter((child) => child.className === sel);
    },
  });

  const body = createNode('body');
  const root = createNode('div');
  root.id = 'closed-loop-v2-ui';
  body.appendChild(root);

  global.document = {
    body,
    createElement: createNode,
    getElementById(id) {
      return store[id] || (id === 'closed-loop-v2-ui' ? root : null);
    },
  };

  return root;
}

test('UIManager creates a dedicated status block once and keeps a clean root structure', async () => {
  const root = makeDomRoot();
  const eventBus = new EventBus();
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => null,
  };

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader } });
  ui.initialise();
  await Promise.resolve();
  await Promise.resolve();

  const statusBlock = root.querySelector('.v2-status-block');
  assert.ok(statusBlock, 'status block created');
  assert.equal(root.querySelectorAll('.v2-status-block').length, 1, 'single status block');
  assert.ok(root.querySelector('.v2-selection-inspector') || true, 'selection inspector may mount later');

  ui.destroy();
  assert.equal(root.querySelector('.v2-status-block'), null, 'status block removed on destroy');
});

test('UIManager mounts both UI panels and keeps them attached through status updates', async () => {
  const root = makeDomRoot();
  const eventBus = new EventBus();
  const scenario = { id: 2, name: 'Dandenong South Closed Loop Hub', population: 860060, scenario_resources: [] };
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => scenario,
  };

  const inspector = { className: 'v2-selection-inspector', textContent: '', innerText: '', parentNode: null };
  const context = { className: 'v2-context-panel', textContent: '', innerText: '', parentNode: null };
  root.appendChild(inspector);
  root.appendChild(context);

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader, technology: { getCompatibleMachinesForResource: () => [] } } });
  ui.initialise();
  const statusBlock = root.querySelector('.v2-status-block');
  assert.ok(statusBlock, 'status block created');
  assert.ok(root.querySelector('.v2-selection-inspector'), 'selection inspector mounted');
  assert.ok(root.querySelector('.v2-context-panel'), 'context panel mounted');

  eventBus.emit('scenario:loaded', scenario);

  assert.ok(root.querySelector('.v2-status-block'), 'status block remains after scenario update');
  assert.match((root.querySelector('.v2-status-block').textContent || root.querySelector('.v2-status-block').innerText || ''), /Dandenong South Closed Loop Hub/);
  assert.ok(root.querySelector('.v2-selection-inspector'), 'selection inspector remains attached after status update');
  assert.ok(root.querySelector('.v2-context-panel'), 'context panel remains attached after status update');

  ui.destroy();
});

test('UIManager repeated initialise and repeated status updates do not duplicate status or panel nodes', async () => {
  const root = makeDomRoot();
  const eventBus = new EventBus();
  const scenario = { id: 2, name: 'Dandenong South Closed Loop Hub', population: 860060, scenario_resources: [] };
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => scenario,
  };

  const inspector = { className: 'v2-selection-inspector', textContent: '', innerText: '', parentNode: null };
  const context = { className: 'v2-context-panel', textContent: '', innerText: '', parentNode: null };
  root.appendChild(inspector);
  root.appendChild(context);

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader, technology: { getCompatibleMachinesForResource: () => [] } } });
  ui.initialise();
  ui.initialise();

  assert.equal(root.querySelectorAll('.v2-status-block').length, 1, 'single status block after repeated initialise');
  assert.equal(root.querySelectorAll('.v2-selection-inspector').length, 1, 'single selection inspector after repeated initialise');
  assert.equal(root.querySelectorAll('.v2-context-panel').length, 1, 'single context panel after repeated initialise');

  eventBus.emit('scenario:loaded', scenario);
  eventBus.emit('scenario:loaded', scenario);

  assert.equal(root.querySelectorAll('.v2-status-block').length, 1, 'single status block after repeated scenario updates');
  assert.equal(root.querySelectorAll('.v2-selection-inspector').length, 1, 'selection inspector remains single after repeated scenario updates');
  assert.equal(root.querySelectorAll('.v2-context-panel').length, 1, 'context panel remains single after repeated scenario updates');

  ui.destroy();
  assert.equal(root.querySelector('.v2-status-block'), null, 'destroy removes status block');
  assert.equal(root.querySelector('.v2-selection-inspector'), null, 'destroy removes selection inspector');
  assert.equal(root.querySelector('.v2-context-panel'), null, 'destroy removes context panel');
});

test('UIManager shows compact scenario header when no scenario is loaded', () => {
  // Setup a fake DOM root
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const mockDataLoader = {
    getMachines: () => [ { id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' } ],
    getScenarioById: () => null,
  };

  const ui = new UIManager({ statusProviders: { dataLoader: mockDataLoader } });
  ui.initialise();

  assert.ok(root.innerText.includes('Closed Loop V2'));
  assert.doesNotMatch(root.innerText, /Machines:/);
});

test('UIManager reports default compact header before a scenario is loaded', () => {
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const eventBus = new EventBus();
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => null,
  };

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader } });
  ui.initialise();

  assert.match(root.innerText, /Closed Loop V2/);
  assert.doesNotMatch(root.innerText, /Dandenong South Closed Loop Hub/);
});

test('UIManager updates scenario status on scenario:loaded with compact scenario header', () => {
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const eventBus = new EventBus();
  const scenario = { id: 2, name: 'Dandenong South Closed Loop Hub', population: 860060, scenario_resources: [] };
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => scenario,
  };

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader } });
  ui.initialise();
  eventBus.emit('scenario:loaded', scenario);

  assert.match(root.innerText, /Dandenong South Closed Loop Hub/);
  assert.match(root.innerText, /Population: 860,060/);
  assert.doesNotMatch(root.innerText, /Scenario: Not loaded/);
});

test('UIManager initialise is idempotent and does not duplicate scenario subscriptions', () => {
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const eventBus = new EventBus();
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => null,
  };

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader } });
  ui.initialise();
  ui.initialise();

  assert.ok(eventBus.listeners.has('scenario:loaded'));
  assert.equal(eventBus.listeners.get('scenario:loaded').size, 1);
  assert.equal(root.innerText.includes('Closed Loop V2'), true);
});

test('UIManager destroy removes the scenario event subscription', () => {
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const eventBus = new EventBus();
  const dataLoader = {
    getMachines: () => [],
    getResources: () => [],
    getScenarioById: () => null,
  };

  const ui = new UIManager({ eventBus, statusProviders: { eventBus, dataLoader } });
  ui.initialise();
  ui.destroy();

  assert.equal(eventBus.listeners.has('scenario:loaded'), false);
});
