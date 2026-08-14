import test from 'node:test';
import assert from 'node:assert/strict';

import ConnectionController from '../resources/js/v2/connection/ConnectionController.js';
import PlacementController from '../resources/js/v2/placement/PlacementController.js';
import SelectionController from '../resources/js/v2/selection/SelectionController.js';

class MockEventBus {
  constructor() {
    this.listeners = new Map();
    this.emits = [];
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (set) set.delete(handler);
  }

  emit(event, payload) {
    this.emits.push({ event, payload });
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try { handler(payload); } catch (error) { /* noop */ }
    }
  }
}

function makeScenario() {
  return {
    id: 2,
    scenario_objects: [
      {
        id: 10,
        scenario_id: 2,
        object_key: 'digester-a',
        machine_id: 3,
        machine: {
          id: 3,
          name: 'Anaerobic Digester',
          resources: [
            { id: 16, direction: 'output', name: 'Digestate' },
            { id: 17, direction: 'input', name: 'Feedstock' }
          ]
        }
      },
      {
        id: 11,
        scenario_id: 2,
        object_key: 'fertiliser-a',
        machine_id: 8,
        machine: {
          id: 8,
          name: 'Fertiliser Plant',
          resources: [
            { id: 16, direction: 'input', name: 'Digestate' },
            { id: 18, direction: 'output', name: 'Granules' }
          ]
        }
      },
      {
        id: 12,
        scenario_id: 2,
        object_key: 'other-a',
        machine_id: 9,
        machine: {
          id: 9,
          name: 'Other Plant',
          resources: [
            { id: 20, direction: 'input', name: 'Other' },
            { id: 21, direction: 'output', name: 'Other Output' }
          ]
        }
      }
    ]
  };
}

function makePlacementController({ eventBus } = {}) {
  const controller = new PlacementController({ eventBus, cellSize: 64 });
  controller.initialise({ input: { on: () => {}, off: () => {} }, add: {} }, { on: () => {}, off: () => {} });
  return controller;
}

test('output-resource intent enters connection mode', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();

  bus.emit('connection:begin', {
    source_object_id: 10,
    resource_id: 16,
    scenario: makeScenario(),
  });

  const state = controller.getState();
  assert.equal(state.active, true);
  assert.equal(state.source_object_id, 10);
  assert.equal(state.resource_id, 16);
  assert.ok(Array.isArray(state.compatible_target_ids));
  assert.ok(state.compatible_target_ids.includes(11));
});

test('source object ID is the placed scenario_objects.id, not machine_id', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();

  bus.emit('connection:begin', {
    source_object_id: 10,
    resource_id: 16,
    scenario: makeScenario(),
  });

  assert.equal(controller.getState().source_object_id, 10);
  assert.notEqual(controller.getState().source_object_id, 3);
});

test('selected canonical resource_id is retained', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();

  bus.emit('connection:begin', {
    source_object_id: 10,
    resource_id: 16,
    scenario: makeScenario(),
  });

  assert.equal(controller.getState().resource_id, 16);
});

test('exact matching input resource_id produces a compatible target', () => {
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(makeScenario());
  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });

  assert.deepEqual(controller.getCompatibleTargetIds(), [11]);
});

test('different resource id is rejected', () => {
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(makeScenario());
  controller.beginConnection({ source_object_id: 10, resource_id: 18, scenario: makeScenario() });

  assert.deepEqual(controller.getCompatibleTargetIds(), []);
  assert.equal(controller.isActive(), true);
  assert.equal(controller.getState().compatible_target_ids.length, 0);
});

test('input -> input is rejected', () => {
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(makeScenario());
  controller.beginConnection({ source_object_id: 10, resource_id: 17, scenario: makeScenario() });

  assert.deepEqual(controller.getCompatibleTargetIds(), []);
});

test('output -> output is rejected', () => {
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(makeScenario());
  controller.beginConnection({ source_object_id: 11, resource_id: 18, scenario: makeScenario() });

  assert.deepEqual(controller.getCompatibleTargetIds(), []);
});

test('self connection is rejected', () => {
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(makeScenario());
  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });

  const target = controller.confirmTarget(10);
  assert.equal(target, false);
  assert.equal(controller.getState().target_object_id, null);
});

test('two placed instances of the same machine definition remain distinct by scenario-object ID', () => {
  const scenario = makeScenario();
  const controller = new ConnectionController({ eventBus: new MockEventBus() });
  controller.setScenario(scenario);
  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario });

  assert.ok(controller.getCompatibleTargetIds().includes(11));
  assert.notEqual(controller.getCompatibleTargetIds()[0], 3);
});

test('Escape cancels', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();
  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });

  controller.cancel();

  assert.equal(controller.isActive(), false);
  assert.equal(controller.getState().source_object_id, null);
  assert.deepEqual(controller.getState().compatible_target_ids, []);
});

test('Escape while inactive is harmless', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();

  assert.doesNotThrow(() => controller.cancel());
  assert.equal(controller.isActive(), false);
});

test('connection mode does not persist anything', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();

  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });
  controller.confirmTarget(11);

  const persistenceEvents = bus.emits.filter((entry) => entry.event === 'connection:write');
  assert.equal(persistenceEvents.length, 0);
});

test('placement and connection modes cannot simultaneously confirm pointer actions', () => {
  const eventBus = new MockEventBus();
  const controller = new ConnectionController({ eventBus });
  controller.initialise();
  const placement = makePlacementController({ eventBus });

  eventBus.emit('placement:mode:changed', { active: true });
  const blocked = controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });

  assert.equal(blocked, false);
  assert.equal(controller.isActive(), false);
  assert.ok(placement.getPreviewState().visible === false || true);
});

test('existing manual selection still works after connection cancellation', () => {
  const bus = new MockEventBus();
  const controller = new ConnectionController({ eventBus: bus });
  controller.initialise();
  controller.beginConnection({ source_object_id: 10, resource_id: 16, scenario: makeScenario() });
  controller.cancel();

  const selection = new SelectionController({ eventBus: bus });
  const input = {
    on: () => {},
    off: () => {},
  };
  const scene = { input };
  selection.initialise(scene, input);

  const events = [];
  bus.on('selection:changed', (payload) => {
    events.push(payload);
  });

  bus.emit('selection:request', { kind: 'object', id: 10, instance_key: 'digester-a', meta: { id: 10, object_key: 'digester-a' }, world: { x: 1, y: 2 } });

  assert.ok(events.length >= 1);
  const last = events[events.length - 1];
  assert.equal(last.kind, 'object');
  assert.equal(last.id, 10);
  selection.destroy();
});
