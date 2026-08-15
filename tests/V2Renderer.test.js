import test from 'node:test';
import assert from 'node:assert/strict';
import Renderer from '../resources/js/v2/renderer/Renderer.js';
import App from '../resources/js/v2/App.js';
import ConnectionController from '../resources/js/v2/connection/ConnectionController.js';
import ConnectionPreviewRenderer from '../resources/js/v2/connection/ConnectionPreviewRenderer.js';
import ConnectionPortRenderer from '../resources/js/v2/connection/ConnectionPortRenderer.js';

class MockEventBus {
  constructor() {
    this.listeners = new Map();
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
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try { handler(payload); } catch (e) {}
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
            { id: 17, direction: 'input', name: 'Feedstock' },
          ],
        },
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
            { id: 18, direction: 'output', name: 'Granules' },
          ],
        },
      },
    ],
  };
}

function makeScene() {
  return {
    add: {
      zone: (x, y, width, height) => ({
        x,
        y,
        width,
        height,
        setInteractive: () => {},
        setDepth: () => {},
        on: () => {},
        destroy: () => {},
      }),
      graphics: () => ({
        clear: () => {},
        lineStyle: () => {},
        strokeLineStyle: () => {},
        lineBetween: () => {},
        setDepth: () => {},
        fillStyle: () => {},
        fillCircle: () => {},
        strokeCircle: () => {},
        destroy: () => {},
      }),
    },
    events: { on: () => {}, off: () => {} },
    input: { on: () => {}, off: () => {} },
    cameras: { main: { getWorldPoint: (x, y) => ({ x, y }) } },
    textures: { exists: () => false },
  };
}

function makeInputController() {
  return {
    getPointerWorld: () => ({ x: 320, y: 200 }),
  };
}

test('Renderer construction in Node is safe and does not import Phaser', () => {
  const r = new Renderer({});
  // In Node environment initialise should be a no-op and not throw
  assert.doesNotThrow(() => r.initialise());
  // Not initialised in Node
  assert.equal(r.initialised, false);
});

test('Renderer destroy is safe before initialise and idempotent', () => {
  const r = new Renderer({});
  assert.doesNotThrow(() => r.destroy());
  // second call should also be safe
  assert.doesNotThrow(() => r.destroy());
});

test('App initialises renderer, ui and game in order and destroys in reverse', () => {
  const calls = [];
  const renderer = { initialise: () => calls.push('renderer.init'), destroy: () => calls.push('renderer.destroy') };
  const ui = { initialise: () => calls.push('ui.init'), destroy: () => calls.push('ui.destroy') };
  const game = { initialise: () => calls.push('game.init'), start: () => calls.push('game.start'), destroy: () => calls.push('game.destroy') };

  const app = new App({ eventBus: {}, renderer, gameEngine: game, uiManager: ui, scenario: null });
  app.initialise();
  // check initialisation order
  assert.deepEqual(calls.slice(0, 3), ['renderer.init', 'ui.init', 'game.init']);

  app.destroy();
  const gi = calls.indexOf('game.destroy');
  const uii = calls.indexOf('ui.destroy');
  const ri = calls.indexOf('renderer.destroy');
  assert(gi >= 0 && uii >= 0 && ri >= 0);
  assert(gi < uii && uii < ri);
});

test('Renderer bootstrap initialises placement controller with the live scene and input controller exactly once', () => {
  const bus = { on: () => {}, off: () => {}, emit: () => {} };
  const renderer = new Renderer({ eventBus: bus, mountId: 'closed-loop-v2-canvas' });
  const scene = { input: { on: () => {}, off: () => {} } };
  const input = { initialise: () => {} };

  let initCalls = 0;
  let seenScene = null;
  let seenInput = null;
  let isInitialisedState = false;

  renderer._placementController = {
    initialise: (sceneArg, inputArg) => {
      initCalls += 1;
      seenScene = sceneArg;
      seenInput = inputArg;
      isInitialisedState = true;
    },
    destroy: () => {
      isInitialisedState = false;
    },
    isInitialised: () => !!isInitialisedState,
  };

  renderer._initialisePlacementController(scene, input);
  renderer._initialisePlacementController(scene, input);

  assert.equal(initCalls, 1);
  assert.equal(seenScene, scene);
  assert.equal(seenInput, input);
  assert.equal(typeof renderer._placementController.destroy === 'function', true);

  const placementController = renderer._placementController;
  renderer.destroy();
  assert.equal(renderer._placementController, null);
  assert.equal(typeof placementController.destroy === 'function', true);
});

test('Renderer bootstrap initialises one live ConnectionPortRenderer and registers its selection:changed path', () => {
  const bus = new MockEventBus();
  const renderer = new Renderer({ eventBus: bus, mountId: 'closed-loop-v2-canvas' });
  const scene = makeScene();
  const input = makeInputController();
  const scenario = makeScenario();

  const controller = new ConnectionController({ eventBus: bus });
  const preview = new ConnectionPreviewRenderer({ eventBus: bus, cellSize: 64 });
  const portRenderer = new ConnectionPortRenderer({ eventBus: bus, cellSize: 64 });

  renderer._connectionController = controller;
  renderer._connectionPreviewRenderer = preview;
  renderer._connectionPortRenderer = portRenderer;

  const selectionBefore = bus.listeners.get('selection:changed')?.size ?? 0;
  const modeBefore = bus.listeners.get('connection:mode:changed')?.size ?? 0;

  renderer._initialiseConnectionComponents(scene, input);

  assert.equal(portRenderer._initialised, true);
  assert.equal((bus.listeners.get('selection:changed')?.size ?? 0) >= selectionBefore + 1, true);
  assert.equal((bus.listeners.get('connection:mode:changed')?.size ?? 0) >= modeBefore + 1, true);

  controller.setScenario(scenario);
  bus.emit('scenario:loaded', scenario);
  bus.emit('selection:changed', {
    kind: 'object',
    id: 10,
    instance_key: 'digester-a',
    meta: scenario.scenario_objects[0],
    world: { x: 128, y: 128 },
  });

  assert.equal(portRenderer._selectedObjectId, 10);
  assert.equal(portRenderer._scenario, scenario);
  assert.equal(portRenderer._portObjects.length, 2);
  assert.deepEqual(portRenderer._portObjects.map((entry) => entry.port.direction).sort(), ['input', 'output']);

  const portListenerCount = bus.listeners.get('selection:changed')?.size ?? 0;
  const connectionModeCount = bus.listeners.get('connection:mode:changed')?.size ?? 0;
  assert.ok(portListenerCount >= 1);
  assert.ok(connectionModeCount >= 1);

  bus.emit('connection:begin', {
    source_object_id: 10,
    resource_id: 16,
    scenario,
  });

  assert.equal(controller.getState().active, true);
  assert.equal(controller.getState().source_object_id, 10);
  assert.equal(controller.getState().resource_id, 16);
  assert.ok(controller.getState().compatible_target_ids.includes(11));
  assert.equal(preview._active, true);
  assert.equal(preview._state.active, true);
  assert.ok(Array.isArray(preview._state.compatible_target_ids));
  assert.ok(preview._state.compatible_target_ids.includes(11));

  bus.emit('connection:target:hover', { scenario_object_id: 11 });
  assert.equal(controller.getState().target_object_id, 11);
  assert.equal(preview._state.target_object_id, 11);

  bus.emit('connection:target:clear', { scenario_object_id: 11 });
  assert.equal(controller.getState().target_object_id, null);
  assert.equal(preview._state.target_object_id, null);

  bus.emit('connection:target:hover', { scenario_object_id: 999 });
  assert.equal(controller.getState().target_object_id, null);

  renderer.destroy();
  assert.equal(renderer._connectionController, null);
  assert.equal(renderer._connectionPreviewRenderer, null);
  assert.equal(renderer._connectionPortRenderer, null);
});

test('ConnectionPortRenderer keeps Graphics and Zone anchored to the same world position and draws circles locally', () => {
  const bus = new MockEventBus();
  const renderer = new ConnectionPortRenderer({ eventBus: bus, cellSize: 64 });
  const zoneRecords = [];
  const graphicsRecords = [];
  const scene = {
    add: {
      zone: (x, y, width, height) => {
        const zone = {
          x,
          y,
          width,
          height,
          setInteractive: () => {},
          setDepth: () => {},
          on: () => {},
          destroy: () => {},
        };
        zoneRecords.push(zone);
        return zone;
      },
      graphics: () => {
        const visual = {
          x: 0,
          y: 0,
          setDepth: () => {},
          setPosition: (x, y) => {
            visual.x = x;
            visual.y = y;
          },
          fillStyle: () => {},
          fillCircle: (...args) => {
            visual.circleArgs = args;
          },
          strokeCircle: (...args) => {
            visual.strokeArgs = args;
          },
          lineStyle: () => {},
          destroy: () => {},
        };
        graphicsRecords.push(visual);
        return visual;
      },
    },
    cameras: { main: { getWorldPoint: (x, y) => ({ x, y }) } },
    textures: { exists: () => false },
    events: { on: () => {}, off: () => {} },
    input: { on: () => {}, off: () => {} },
  };

  renderer._scene = scene;
  renderer._scenario = {
    id: 2,
    scenario_objects: [{
      id: 2,
      grid_x: 6,
      grid_y: 2,
      machine_id: 3,
      machine: {
        id: 3,
        footprint_x: 4,
        footprint_y: 4,
        resources: [
          { id: 14, name: 'Farm Waste', direction: 'input' },
          { id: 15, name: 'Biogas', direction: 'output' },
          { id: 16, name: 'Digestate', direction: 'output' },
        ],
      },
    }],
  };
  renderer._selectedObjectId = 2;
  renderer._connectionState = { active: false, source_object_id: null, resource_id: null, target_object_id: null, compatible_target_ids: [] };

  renderer.render();

  assert.equal(zoneRecords.length, 3);
  assert.equal(graphicsRecords.length, 3);
  for (let i = 0; i < zoneRecords.length; i++) {
    const zone = zoneRecords[i];
    const graphic = graphicsRecords[i];
    const expectedWorld = {
      0: { x: 372, y: 157 },
      1: { x: 652, y: 175 },
      2: { x: 652, y: 193 },
    }[i];
    assert.deepEqual({ x: zone.x, y: zone.y }, expectedWorld);
    assert.deepEqual({ x: graphic.x, y: graphic.y }, expectedWorld);
    assert.deepEqual(graphic.circleArgs, [0, 0, 7]);
    assert.deepEqual(graphic.strokeArgs, [0, 0, 7]);
  }

  const leftEdgeDelta = 372 - 384;
  const rightEdgeDelta = 652 - 640;
  assert.equal(leftEdgeDelta, -12);
  assert.equal(rightEdgeDelta, 12);
  assert.equal(zoneRecords[0].x, 372);
  assert.equal(zoneRecords[1].x, 652);
  assert.equal(zoneRecords[2].x, 652);
});

test('ConnectionPortRenderer uses explicit artwork-relative visual anchors before fallback edges', () => {
  const renderer = new ConnectionPortRenderer({ eventBus: null, cellSize: 64 });
  const so = {
    id: 101,
    grid_x: 3,
    grid_y: 2,
    rotation: 0,
    machine: {
      id: 41,
      footprint_x: 4,
      footprint_y: 4,
      visual_ports: [
        { resource_id: 14, direction: 'input', x: 0.10, y: 0.70 },
        { resource_id: 15, direction: 'output', x: 0.88, y: 0.22 },
        { resource_id: 16, direction: 'output', x: 0.90, y: 0.78 },
      ],
      resources: [
        { id: 14, direction: 'input', name: 'Farm Waste' },
        { id: 15, direction: 'output', name: 'Biogas' },
        { id: 16, direction: 'output', name: 'Digestate' },
      ],
    },
  };

  const rect = renderer._getObjectWorldRect(so);
  const inputPort = renderer._makePortDefinition(so, so.machine.resources[0], 0, 'left');
  const biogasPort = renderer._makePortDefinition(so, so.machine.resources[1], 0, 'right');
  const digestatePort = renderer._makePortDefinition(so, so.machine.resources[2], 1, 'right');

  const displayWidth = rect.width * 0.85;
  const displayHeight = rect.height * 0.85;
  const expectedInput = {
    x: rect.centerX + ((0.10 - 0.5) * displayWidth),
    y: rect.centerY + ((0.70 - 0.5) * displayHeight),
  };

  assert.ok(Math.abs(inputPort.world.x - expectedInput.x) < 0.001);
  assert.ok(Math.abs(inputPort.world.y - expectedInput.y) < 0.001);
  assert.ok(Math.abs(biogasPort.world.x - (rect.centerX + ((0.88 - 0.5) * displayWidth))) < 0.001);
  assert.ok(Math.abs(digestatePort.world.x - (rect.centerX + ((0.90 - 0.5) * displayWidth))) < 0.001);
  assert.notDeepEqual(inputPort.world, { x: rect.left - 12, y: rect.top + 20 });
});

test('ConnectionPortRenderer uses normalized centre anchor and rotates artwork-relative positions', () => {
  const renderer = new ConnectionPortRenderer({ eventBus: null, cellSize: 64 });
  const so = {
    id: 102,
    grid_x: -2,
    grid_y: -1,
    rotation: 90,
    machine: {
      id: 44,
      footprint_x: 2,
      footprint_y: 3,
      visual_ports: [
        { resource_id: 22, direction: 'input', x: 0.50, y: 0.50 },
        { resource_id: 23, direction: 'output', x: 0.75, y: 0.25 },
      ],
      resources: [
        { id: 22, direction: 'input', name: 'Water In' },
        { id: 23, direction: 'output', name: 'Water Out' },
      ],
    },
  };

  const rect = renderer._getObjectWorldRect(so);
  const inputPort = renderer._makePortDefinition(so, so.machine.resources[0], 0, 'left');
  const outputPort = renderer._makePortDefinition(so, so.machine.resources[1], 0, 'right');

  // centre anchor remains the centre for (0.5,0.5)
  assert.ok(Math.abs(inputPort.world.x - rect.centerX) < 0.001);
  assert.ok(Math.abs(inputPort.world.y - rect.centerY) < 0.001);

  // 90° rotation changes the local vector projection without changing resource identity
  assert.ok(outputPort.world.x !== rect.centerX || outputPort.world.y !== rect.centerY);
  assert.equal(outputPort.resource_id, 23);
  assert.equal(outputPort.direction, 'output');

  const unrotated = renderer._getArtRelativePortWorld({ ...so, rotation: 0 }, so.machine, so.machine.resources[1]);
  const rotated90 = renderer._getArtRelativePortWorld(so, so.machine, so.machine.resources[1]);
  assert.ok(Math.abs(rotated90.x - unrotated.x) > 0.001 || Math.abs(rotated90.y - unrotated.y) > 0.001);
});

test('ConnectionPortRenderer keeps fallback edge placement for machines without visual anchors and respects negative grid coordinates', () => {
  const renderer = new ConnectionPortRenderer({ eventBus: null, cellSize: 64 });
  const so = {
    id: 103,
    grid_x: -3,
    grid_y: -2,
    rotation: 180,
    machine: {
      id: 45,
      footprint_x: 2,
      footprint_y: 2,
      resources: [
        { id: 30, direction: 'input', name: 'Fallback In' },
        { id: 31, direction: 'output', name: 'Fallback Out' },
      ],
    },
  };

  const rect = renderer._getObjectWorldRect(so);
  const inputPort = renderer._makePortDefinition(so, so.machine.resources[0], 0, 'left');
  const outputPort = renderer._makePortDefinition(so, so.machine.resources[1], 0, 'right');

  assert.ok(Math.abs(inputPort.world.x - (rect.left - 12)) < 0.001);
  assert.ok(Math.abs(outputPort.world.x - (rect.right + 12)) < 0.001);
  assert.ok(Number.isFinite(rect.left) && Number.isFinite(rect.top));
  assert.ok(rect.left < 0 && rect.top < 0);
});

test('ConnectionPreviewRenderer uses the resolved exact world port for visual-anchor based connections', () => {
  const renderer = new ConnectionPreviewRenderer({ eventBus: null, cellSize: 64 });
  const scenario = {
    id: 9,
    scenario_objects: [
      {
        id: 40,
        grid_x: 2,
        grid_y: 2,
        rotation: 0,
        machine: {
          id: 7,
          footprint_x: 2,
          footprint_y: 2,
          visual_ports: [
            { resource_id: 100, direction: 'output', x: 0.92, y: 0.40 },
          ],
          resources: [{ id: 100, direction: 'output', name: 'Flow' }],
        },
      },
      {
        id: 41,
        grid_x: 6,
        grid_y: 2,
        rotation: 0,
        machine: {
          id: 8,
          footprint_x: 2,
          footprint_y: 2,
          visual_ports: [
            { resource_id: 100, direction: 'input', x: 0.12, y: 0.60 },
          ],
          resources: [{ id: 100, direction: 'input', name: 'Flow' }],
        },
      },
    ],
  };

  const state = {
    active: true,
    source_object_id: 40,
    resource_id: 100,
    compatible_target_ids: [41],
    target_object_id: 41,
    source_port: { x: 500, y: 220 },
    target_port: { x: 780, y: 280 },
  };

  const geometry = renderer._buildGeometryForState(state, scenario, { x: 600, y: 220 });
  assert.deepEqual(geometry.sourceAnchor, { x: 500, y: 220 });
  assert.deepEqual(geometry.targetAnchor, { x: 780, y: 280 });
  assert.deepEqual(geometry.endpoint, { x: 780, y: 280 });
  assert.equal(geometry.validTarget, true);
});
