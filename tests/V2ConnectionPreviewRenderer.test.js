import test from 'node:test';
import assert from 'node:assert/strict';

import ConnectionPreviewRenderer from '../resources/js/v2/connection/ConnectionPreviewRenderer.js';

function makeScenario() {
  return {
    id: 9,
    scenario_objects: [
      {
        id: 40,
        scenario_id: 9,
        grid_x: 2,
        grid_y: 2,
        rotation: 0,
        machine: {
          id: 7,
          name: 'Source Machine',
          footprint_x: 2,
          footprint_y: 2,
          resources: [{ id: 100, direction: 'output', name: 'Flow' }],
        },
      },
      {
        id: 41,
        scenario_id: 9,
        grid_x: 6,
        grid_y: 2,
        rotation: 0,
        machine: {
          id: 8,
          name: 'Target Machine',
          footprint_x: 2,
          footprint_y: 2,
          resources: [{ id: 100, direction: 'input', name: 'Flow' }],
        },
      },
    ],
  };
}

function makeScene() {
  return {
    add: {
      graphics: () => ({
        clear: () => {},
        lineStyle: () => {},
        strokeLineStyle: () => {},
        lineBetween: () => {},
        setDepth: () => {},
        destroy: () => {},
      }),
    },
    events: {
      on: () => {},
      off: () => {},
    },
    input: { on: () => {}, off: () => {} },
    cameras: { main: { getWorldPoint: (x, y) => ({ x, y }) } },
    textures: { exists: () => false },
  };
}

function makeInputController(pointerWorld = { x: 300, y: 200 }) {
  return {
    getPointerWorld: () => ({ ...pointerWorld }),
  };
}

test('preview renderer creates a graphics object for a valid connection mode', () => {
  const eventBus = { on: () => {}, off: () => {}, emit: () => {} };
  const scene = makeScene();
  const renderer = new ConnectionPreviewRenderer({ eventBus, cellSize: 64 });
  let created = 0;
  scene.add.graphics = () => {
    created += 1;
    return {
      clear: () => {},
      lineStyle: () => {},
      strokeLineStyle: () => {},
      lineBetween: () => {},
      setDepth: () => {},
      destroy: () => {},
    };
  };

  renderer.initialise(scene, makeInputController({ x: 320, y: 200 }));
  renderer._onConnectionModeChanged({
    active: true,
    source_object_id: 40,
    resource_id: 100,
    compatible_target_ids: [41],
    transport_class: 'water',
  });
  renderer._setScenario(makeScenario());
  renderer.update();

  assert.equal(created, 1);
  renderer.destroy();
});

test('source and target anchors derive from footprint rectangles and rotation', () => {
  const renderer = new ConnectionPreviewRenderer({ cellSize: 64 });
  const scenario = makeScenario();
  const source = scenario.scenario_objects[0];
  const target = scenario.scenario_objects[1];

  const sourceAnchor = renderer._getAnchorForObject(source, { x: 700, y: 200 }, scenario);
  const targetAnchor = renderer._getAnchorForObject(target, { x: 100, y: 200 }, scenario);

  assert.equal(typeof sourceAnchor.x, 'number');
  assert.equal(typeof sourceAnchor.y, 'number');
  assert.equal(typeof targetAnchor.x, 'number');
  assert.equal(typeof targetAnchor.y, 'number');
  assert.ok(sourceAnchor.x >= 0);
  assert.ok(targetAnchor.x >= 0);
});

test('valid target snaps, incompatible target does not snap, and transport style is metadata-only', () => {
  const renderer = new ConnectionPreviewRenderer({ cellSize: 64 });
  const scenario = makeScenario();
  const source = scenario.scenario_objects[0];
  const target = scenario.scenario_objects[1];

  const state = {
    active: true,
    source_object_id: 40,
    resource_id: 100,
    compatible_target_ids: [41],
    target_object_id: 41,
    transport_class: 'gas',
    source_port: { x: 320, y: 192 },
    target_port: { x: 640, y: 192 },
  };

  const geometry = renderer._buildGeometryForState(state, scenario, { x: 350, y: 200 });
  assert.equal(geometry.target_object_id, 41);
  assert.equal(geometry.validTarget, true);
  assert.equal(geometry.endpoint.x, geometry.targetAnchor.x);
  assert.equal(geometry.endpoint.y, geometry.targetAnchor.y);

  const badState = { ...state, compatible_target_ids: [], target_object_id: null, target_port: null };
  const badGeometry = renderer._buildGeometryForState(badState, scenario, { x: 350, y: 200 });
  assert.equal(badGeometry.validTarget, false);
  assert.ok(Math.abs(badGeometry.endpoint.x - 350) < 0.0001 || badGeometry.endpoint.x !== geometry.endpoint.x);

  const style = renderer._getStyleForTransportClass('gas');
  assert.equal(typeof style.stroke, 'number');
  assert.equal(typeof style.alpha, 'number');
  assert.equal(style.alpha > 0, true);
});

test('preview uses exact source and target port coordinates when a compatible input port is hovered', () => {
  const renderer = new ConnectionPreviewRenderer({ cellSize: 64 });
  const scenario = makeScenario();
  const state = {
    active: true,
    source_object_id: 40,
    resource_id: 100,
    compatible_target_ids: [41],
    target_object_id: 41,
    source_port: { x: 640, y: 256 },
    target_port: { x: -384, y: 32 },
    transport_class: 'water',
  };

  const geometry = renderer._buildGeometryForState(state, scenario, { x: -300, y: 90 });
  assert.deepEqual(geometry.sourceAnchor, { x: 640, y: 256 });
  assert.deepEqual(geometry.targetAnchor, { x: -384, y: 32 });
  assert.deepEqual(geometry.endpoint, { x: -384, y: 32 });
  assert.equal(geometry.validTarget, true);
});
