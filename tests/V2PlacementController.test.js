import test from 'node:test';
import assert from 'node:assert/strict';

import PlacementController from '../resources/js/v2/placement/PlacementController.js';
import EventBus from '../resources/js/v2/events/EventBus.js';

function makeScene() {
  return {
    input: {
      on: () => {},
      off: () => {},
    },
    events: {
      on: () => {},
      off: () => {},
    },
    cameras: {
      main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } },
    },
    add: {
      graphics: () => ({
        clear() {},
        fillStyle() {},
        fillRect() {},
        strokeRect() {},
        lineStyle() {},
        setAlpha() {},
        destroy() {},
      }),
      image: () => ({
        setAlpha() {},
        setPosition() {},
        setDisplaySize() {},
        setVisible() {},
        destroy() {},
      }),
    },
    textures: { exists: () => false },
  };
}

test('technology:selected enters preview mode', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });
  const machine = { id: 12, name: 'Anaerobic Digester', image: 'anaerobic-digester.png', footprint_x: 4, footprint_y: 4 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });

  assert.equal(controller.getPreviewMachine()?.id, 12);
  assert.equal(controller.getPreviewState().visible, true);
  assert.equal(controller.getPreviewState().valid, true);
});

test('selected machine becomes current preview machine', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });
  const first = { id: 1, name: 'First', image: 'first.png', footprint_x: 2, footprint_y: 2 };
  const second = { id: 2, name: 'Second', image: 'second.png', footprint_x: 3, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine: first });
  bus.emit('technology:selected', { machine: second });

  assert.equal(controller.getPreviewMachine().id, 2);
  assert.equal(controller.getPreviewMachine().name, 'Second');
});

test('pointer movement updates snapped grid position', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 7, name: 'Machine', image: 'placeholder.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 173, y: 210 });

  const state = controller.getPreviewState();
  assert.equal(state.x, 128);
  assert.equal(state.y, 192);
  assert.equal(state.visible, true);
});

test('unsnapped pointer coordinates do not become ghost coordinates', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 5, name: 'Machine', image: 'placeholder.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 77, y: 88 });

  const state = controller.getPreviewState();
  assert.equal(state.x, 64);
  assert.equal(state.y, 64);
  assert.notEqual(state.x, 77);
  assert.notEqual(state.y, 88);
});

test('Escape cancels preview', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });
  const machine = { id: 9, name: 'Example', image: 'example.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller.cancelPreview();

  assert.equal(controller.getPreviewMachine(), null);
  assert.equal(controller.getPreviewState().visible, false);
});

test('changing selected technology changes the ghost', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });
  const first = { id: 10, name: 'Old Ghost', image: 'old.png', footprint_x: 2, footprint_y: 2 };
  const second = { id: 11, name: 'New Ghost', image: 'new.png', footprint_x: 3, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine: first });
  bus.emit('technology:selected', { machine: second });

  assert.equal(controller.getPreviewMachine().id, 11);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);
});

test('preview creates no scenario object/permanent placement', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });
  const machine = { id: 19, name: 'Preview Only', image: 'preview.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });

  assert.equal(controller.getPreviewState().placed, false);
  assert.equal(controller.getPreviewState().scenarioObjectCreated, false);
  assert.equal(controller.getPreviewMachine().id, 19);
});

test('preview remains visible at world coordinates beyond 8000 in the expandable workspace', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 20, name: 'Expanded Workspace', image: 'expand.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(8384, 384);

  const state = controller.getPreviewState();
  assert.equal(state.visible, true);
  assert.equal(state.valid, true);
  assert.equal(state.x, 8384);
  assert.equal(state.y, 384);
  assert.equal(state.width, 128);
  assert.equal(state.height, 128);
});

test('camera scrolling beyond 8000 does not hide preview and negative coords remain valid', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 21, name: 'Large Workspace', image: 'large.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });

  controller._updateGhostPosition(8430, 450);
  let state = controller.getPreviewState();
  assert.equal(state.visible, true);
  assert.equal(state.valid, true);

  controller._updateGhostPosition(-64, -64);
  state = controller.getPreviewState();
  assert.equal(state.visible, true);
  assert.equal(state.valid, true);
  assert.equal(state.x, -64);
  assert.equal(state.y, -64);
});

test('malformed or non-finite coordinates still invalidate preview', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 22, name: 'Finite Only', image: 'finite.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(Number.NaN, 200);

  const state = controller.getPreviewState();
  assert.equal(state.visible, false);
  assert.equal(state.valid, false);

  controller._updateGhostPosition(200, Number.POSITIVE_INFINITY);
  const infinityState = controller.getPreviewState();
  assert.equal(infinityState.visible, false);
  assert.equal(infinityState.valid, false);
});

test('valid empty location stays green and valid', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 30, name: 'Clear Cell', image: 'clear.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 9, grid_x: 2, grid_y: 2, machine: { id: 99, footprint_x: 3, footprint_y: 3 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(0, 0);

  const state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);
  assert.equal(state.visible, true);
});

test('direct overlap becomes invalid collision and the ghost stays visible', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 31, name: 'Overlap Machine', image: 'overlap.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 10, grid_x: 0, grid_y: 0, machine: { id: 100, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(64, 64);

  const state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');
  assert.equal(state.visible, true);
});

test('moving away from collision restores valid green state', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 32, name: 'Move Away', image: 'moveaway.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 11, grid_x: 0, grid_y: 0, machine: { id: 101, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });

  controller._updateGhostPosition(64, 64);
  let state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');

  controller._updateGhostPosition(256, 256);
  state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);
  assert.equal(state.visible, true);
});

test('partial multi-cell overlap is collision', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 33, name: 'Partial Overlap', image: 'partial.png', footprint_x: 3, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 12, grid_x: 1, grid_y: 0, machine: { id: 102, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(64, 0);

  const state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');
});

test('touching edges do not count as collision', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 34, name: 'Touch Edge', image: 'edge.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 13, position_x: 0, position_y: 0, machine: { id: 103, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(192, 0);

  const state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);
});

test('negative coordinates remain valid when clear and collision at negative coordinates is invalid', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 35, name: 'Negative Coord', image: 'negative.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(-64, -64);
  let state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);

  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 14, position_x: -128, position_y: -128, machine: { id: 104, footprint_x: 2, footprint_y: 2 } },
  ] });
  controller._updateGhostPosition(-64, -64);
  state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');
});

test('Escape still cancels preview normally', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 36, name: 'Cancel', image: 'cancel.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller.cancelPreview();

  assert.equal(controller.getPreviewMachine(), null);
  assert.equal(controller.getPreviewState().visible, false);
  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, null);
});

test('no permanent placement path exists during collision preview', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 37, name: 'No Placement', image: 'noplace.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 15, position_x: 0, position_y: 0, machine: { id: 105, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(64, 64);

  const state = controller.getPreviewState();
  assert.equal(state.placed, false);
  assert.equal(state.scenarioObjectCreated, false);
  assert.equal(typeof controller._persistPreviewPlacement, 'undefined');
});

test('scenario object grid-origin rectangles align with visible renderer geometry', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const scenario = {
    scenario_objects: [
      { id: 22, grid_x: 1, grid_y: 1, machine: { id: 106, footprint_x: 2, footprint_y: 2 } },
    ],
  };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', scenario);

  const rect = controller.getOccupiedRectangles()[0];
  assert.deepEqual(rect, { id: 22, x: 64, y: 64, width: 128, height: 128 });
});

test('visible overlap on a grid-origin scenario object turns preview invalid red', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 40, name: 'Visible Collision', image: 'collision.png', footprint_x: 2, footprint_y: 2 };
  const fillLog = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, fillStyle(color) { fillLog.push(color); }, fillRect() {}, strokeRect() {}, lineStyle() {}, setAlpha() {}, destroy() {},
      }),
      image: () => ({ setAlpha() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => false },
  };

  controller.initialise(fakeScene);
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 23, grid_x: 1, grid_y: 1, machine: { id: 107, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(128, 128);

  const state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');
  assert.equal(fillLog[fillLog.length - 1], 0xff5c5c);
});

test('moving away from grid-origin collision restores green valid state', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 41, name: 'Recover Green', image: 'recover.png', footprint_x: 2, footprint_y: 2 };
  const fillLog = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, fillStyle(color) { fillLog.push(color); }, fillRect() {}, strokeRect() {}, lineStyle() {}, setAlpha() {}, destroy() {},
      }),
      image: () => ({ setAlpha() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => false },
  };

  controller.initialise(fakeScene);
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 24, grid_x: 1, grid_y: 1, machine: { id: 108, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });

  controller._updateGhostPosition(128, 128);
  let state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');

  controller._updateGhostPosition(320, 320);
  state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);
  assert.equal(fillLog[fillLog.length - 1], 0x7dd3fc);
});

test('edge-touching remains valid for centre-origin objects', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 42, name: 'Edge Touch', image: 'edge.png', footprint_x: 2, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 25, position_x: 128, position_y: 128, machine: { id: 109, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(256, 128);

  const state = controller.getPreviewState();
  assert.equal(state.valid, true);
  assert.equal(state.reason, null);
});

test('multi-cell footprints are detected correctly with grid-origin objects', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 43, name: 'Multi Cell', image: 'multicell.png', footprint_x: 3, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 26, grid_x: 0, grid_y: 0, machine: { id: 110, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(64, 0);

  const state = controller.getPreviewState();
  assert.equal(state.valid, false);
  assert.equal(state.reason, 'collision');
});

test('live scenario objects are supplied through the production eventBus path', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const scenario = {
    scenario_objects: [
      { id: 22, position_x: 128, position_y: 128, machine: { id: 106, footprint_x: 2, footprint_y: 2 } },
    ],
  };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', scenario);

  assert.equal(controller.getScenarioObjects().length, 1);
  assert.equal(controller.getScenarioObjects()[0].id, 22);
  assert.equal(controller.getOccupiedRectangles().length, 1);
});

test('live ghost updates colour in place with no duplicate ghost objects', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 44, name: 'Live Ghost', image: 'live-ghost.png', footprint_x: 2, footprint_y: 2 };
  const fillColors = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => {
        const g = {
          clear() {},
          lineStyle() {},
          fillStyle(color) { fillColors.push(color); },
          fillRect() {},
          strokeRect() {},
          destroy() {},
        };
        return g;
      },
      image: () => ({ setOrigin() {}, setAlpha() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => false },
  };

  controller.initialise(fakeScene);
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 27, position_x: 0, position_y: 0, machine: { id: 111, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });

  controller._updateGhostPosition(256, 256);
  assert.equal(controller._ghost && typeof controller._ghost.fillStyle === 'function', true);
  assert.equal(fillColors[fillColors.length - 1], 0x7dd3fc);

  controller._updateGhostPosition(64, 64);
  assert.equal(controller._ghost && typeof controller._ghost.fillStyle === 'function', true);
  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, 'collision');
  assert.equal(fillColors[fillColors.length - 1], 0xff5c5c);

  controller._updateGhostPosition(256, 256);
  assert.equal(controller._ghost && typeof controller._ghost.fillStyle === 'function', true);
  assert.equal(fillColors[fillColors.length - 1], 0x7dd3fc);
});

test('valid preview draws green footprint without artwork dependency', () => {
  const bus = new EventBus();
  const machine = { id: 90, name: 'Green Preview', image: 'green.png', footprint_x: 3, footprint_y: 2 };
  const footprintLogs = [];
  let imageCount = 0;
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {},
        lineStyle(color, alpha) { footprintLogs.push({ type: 'line', color, alpha }); },
        fillStyle(color, alpha) { footprintLogs.push({ type: 'fill', color, alpha }); },
        fillRect(x, y, width, height) { footprintLogs.push({ type: 'fillRect', x, y, width, height }); },
        strokeRect(x, y, width, height) { footprintLogs.push({ type: 'strokeRect', x, y, width, height }); },
        destroy() {},
      }),
      image: () => {
        imageCount += 1;
        return {
          setOrigin() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setAlpha() {}, setTint() {}, destroy() {},
        };
      },
    },
    textures: { exists: () => false },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(128, 128);

  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller.getPreviewState().visible, true);
  assert.equal(controller._graphics !== null, true);
  assert.equal(imageCount, 0);
  assert.equal(footprintLogs.some((entry) => entry.type === 'fill' && entry.color === 0x7dd3fc), true);
  assert.equal(footprintLogs.some((entry) => entry.type === 'strokeRect'), true);
});

test('occupied-cell collision draws red footprint and returns to green after moving away', () => {
  const bus = new EventBus();
  const machine = { id: 91, name: 'Collision Preview', image: 'collision.png', footprint_x: 2, footprint_y: 2 };
  const footprintColors = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {},
        lineStyle(color) { footprintColors.push({ line: color }); },
        fillStyle(color) { footprintColors.push({ fill: color }); },
        fillRect() {}, strokeRect() {}, destroy() {},
      }),
      image: () => ({ setOrigin() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setAlpha() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => false },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('scenario:loaded', { scenario_objects: [{ id: 999, grid_x: 0, grid_y: 0, machine: { id: 555, footprint_x: 2, footprint_y: 2 } }] });
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(64, 64);

  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, 'collision');
  assert.equal(footprintColors.some((entry) => entry.fill === 0xff5c5c), true);

  controller._updateGhostPosition(256, 256);
  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller.getPreviewState().reason, null);
  assert.equal(footprintColors.some((entry) => entry.fill === 0x7dd3fc), true);
});

test('footprint dimensions match footprint_x by footprint_y and negative grid coords still work', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 92, name: 'Negative Grid', image: 'negative-grid.png', footprint_x: 3, footprint_y: 4 };
  const sizes = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {},
        lineStyle() {},
        fillStyle() {},
        fillRect(x, y, width, height) { sizes.push({ width, height, x, y }); },
        strokeRect() {},
        destroy() {},
      }),
      image: () => ({ setOrigin() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setAlpha() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => false },
  };

  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(-192, -256);

  const state = controller.getPreviewState();
  assert.equal(state.x, -192);
  assert.equal(state.y, -256);
  assert.equal(state.width, 192);
  assert.equal(state.height, 256);
  assert.equal(sizes.length > 0, true);
  assert.equal(sizes[sizes.length - 1].width, 192);
  assert.equal(sizes[sizes.length - 1].height, 256);
  assert.equal(state.valid, true);
});

test('missing artwork never creates a fallback image sprite, but footprint remains visible', () => {
  const bus = new EventBus();
  const machine = { id: 93, name: 'Missing Artwork', image: 'missing.png', footprint_x: 2, footprint_y: 2 };
  const createdImages = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, lineStyle() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, destroy() {},
      }),
      image: (x, y, key) => {
        createdImages.push({ x, y, key });
        return { setOrigin() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setAlpha() {}, setTint() {}, destroy() {} };
      },
    },
    textures: { exists: () => false },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(96, 96);

  assert.equal(createdImages.length, 0);
  assert.equal(controller.getPreviewState().visible, true);
  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller._graphics !== null, true);
});

test('loaded artwork is positioned over the same canonical footprint and only one sprite exists', () => {
  const bus = new EventBus();
  const machine = { id: 94, name: 'Loaded Artwork', image: 'loaded.png', footprint_x: 2, footprint_y: 3 };
  const createdImages = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, lineStyle() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, destroy() {},
      }),
      image: (x, y, key) => {
        const obj = {
          x, y, key,
          setOrigin() {},
          setPosition(x2, y2) { obj.x = x2; obj.y = y2; },
          setDisplaySize() {},
          setVisible() {},
          setAlpha() {},
          setTint() {},
          destroy() {},
        };
        createdImages.push(obj);
        return obj;
      },
    },
    textures: { exists: (key) => key === 'preview_machine_94_loaded_png' },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(128, 128);

  assert.equal(createdImages.length, 1);
  assert.equal(controller._artworkSprite, createdImages[0]);
  assert.equal(createdImages[0].x, 192);
  assert.equal(createdImages[0].y, 224);
  assert.equal(controller.getPreviewState().width, 128);
  assert.equal(controller.getPreviewState().height, 192);
});

test('Escape cleans up both footprint and artwork preview objects', () => {
  const bus = new EventBus();
  const machine = { id: 95, name: 'Escape Cleanup', image: 'cleanup.png', footprint_x: 2, footprint_y: 2 };
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({ clear() {}, lineStyle() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, destroy() {} }),
      image: () => ({ setOrigin() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setAlpha() {}, setTint() {}, destroy() {} }),
    },
    textures: { exists: () => true },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller._updateGhostPosition(128, 128);
  controller.cancelPreview();

  assert.equal(controller.getPreviewMachine(), null);
  assert.equal(controller.getPreviewState().visible, false);
  assert.equal(controller._graphics, null);
  assert.equal(controller._artworkSprite, null);
});

test('default preview rotation is 0 and R rotates 90 degrees', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 96, name: 'Rotating Preview', image: 'rotate.png', footprint_x: 2, footprint_y: 3 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  assert.equal(controller.getPreviewState().rotation, 0);

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 90);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);
});

test('repeated rotations cycle 0 90 180 270 0 and keep canonical top-left origin', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 97, name: 'Rotation Cycle', image: 'cycle.png', footprint_x: 2, footprint_y: 3 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 256, y: 192 });

  assert.equal(controller.getPreviewState().rotation, 0);
  assert.equal(controller.getPreviewState().x, 256);
  assert.equal(controller.getPreviewState().y, 192);

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 90);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);
  assert.equal(controller.getPreviewState().x, 256);
  assert.equal(controller.getPreviewState().y, 192);

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 180);
  assert.equal(controller.getPreviewState().width, 128);
  assert.equal(controller.getPreviewState().height, 192);

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 270);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 0);
  assert.equal(controller.getPreviewState().width, 128);
  assert.equal(controller.getPreviewState().height, 192);
});

test('rotation recalculates occupied cells and validity', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 98, name: 'Rotate Collision', image: 'rotate-collision.png', footprint_x: 2, footprint_y: 3 };

  controller.initialise(makeScene());
  bus.emit('scenario:loaded', { scenario_objects: [{ id: 66, grid_x: 2, grid_y: 0, machine: { id: 321, footprint_x: 1, footprint_y: 1 } }] });
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 0, y: 0 });

  assert.equal(controller.getPreviewState().valid, true);
  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 90);
  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, 'collision');

  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 180);
  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller.getPreviewState().reason, null);
});

test('artwork rotates and stays centred inside the rotated footprint', () => {
  const bus = new EventBus();
  const machine = { id: 99, name: 'Artwork Rotate', image: 'artwork-rotate.png', footprint_x: 2, footprint_y: 3 };
  const created = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({ clear() {}, lineStyle() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, destroy() {} }),
      image: (x, y, key) => {
        const obj = {
          x, y, key,
          angle: 0,
          setOrigin() {},
          setPosition(x2, y2) { obj.x = x2; obj.y = y2; },
          setDisplaySize() {},
          setVisible() {},
          setAlpha() {},
          setAngle(value) { obj.angle = value; },
          destroy() {},
        };
        created.push(obj);
        return obj;
      },
    },
    textures: { exists: () => true },
  };

  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  controller.initialise(fakeScene);
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 320, y: 128 });

  assert.equal(created.length, 1);
  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 90);
  assert.equal(created[0].angle, 90);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);
  assert.equal(controller._artworkSprite, created[0]);
});

test('rotation resets to zero when selecting another technology and R without preview does nothing', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const first = { id: 100, name: 'First Tech', image: 'first-tech.png', footprint_x: 2, footprint_y: 3 };
  const second = { id: 101, name: 'Second Tech', image: 'second-tech.png', footprint_x: 3, footprint_y: 2 };

  controller.initialise(makeScene());
  bus.emit('technology:selected', { machine: first });
  controller.rotatePreview();
  controller.rotatePreview();
  assert.equal(controller.getPreviewState().rotation, 180);

  bus.emit('technology:selected', { machine: second });
  assert.equal(controller.getPreviewState().rotation, 0);
  assert.equal(controller.getPreviewState().width, 192);
  assert.equal(controller.getPreviewState().height, 128);

  controller.cancelPreview();
  assert.doesNotThrow(() => controller.rotatePreview());
  assert.equal(controller.getPreviewState().visible, false);
});

test('valid preview confirms a canonical scenario_object payload and reloads after success', async () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64, scenarioId: 9 });
  const machine = { id: 120, name: 'Confirmable', image: 'confirmable.png', footprint_x: 2, footprint_y: 2 };
  const created = [];
  const reloaded = [];
  const api = {
    createScenarioObject: async (payload) => {
      created.push(payload);
      return { id: 88, ...payload };
    },
  };

  controller.initialise(makeScene());
  controller.setApiCoordinator(api);
  controller.setScenarioLoader({ load: async (scenarioId) => { reloaded.push(scenarioId); return { id: scenarioId, scenario_objects: [] }; } });

  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 128, y: 128 });

  const confirmed = await controller.confirmPlacement();
  assert.equal(confirmed, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].scenario_id, 9);
  assert.equal(created[0].machine_id, 120);
  assert.equal(created[0].grid_x, 2);
  assert.equal(created[0].grid_y, 2);
  assert.equal(created[0].rotation, 0);
  assert.equal(created[0].object_type, 'machine');
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0], 9);
  assert.equal(controller.getPreviewState().scenarioObjectCreated, true);
});

test('invalid preview cannot confirm placement and emits failure state', async () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64, scenarioId: 4 });
  const machine = { id: 121, name: 'Blocked', image: 'blocked.png', footprint_x: 2, footprint_y: 2 };
  const api = { createScenarioObject: async () => { throw new Error('should not be called'); } };

  controller.initialise(makeScene());
  controller.setApiCoordinator(api);
  bus.emit('scenario:loaded', { scenario_objects: [{ id: 333, grid_x: 0, grid_y: 0, machine: { id: 777, footprint_x: 2, footprint_y: 2 } }] });
  bus.emit('technology:selected', { machine });
  controller.updatePointerWorld({ x: 0, y: 0 });

  const confirmed = await controller.confirmPlacement();
  assert.equal(confirmed, false);
  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, 'collision');
  assert.equal(controller.getPreviewState().scenarioObjectCreated, false);
});

test('destroy removes listeners', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });

  controller.initialise(makeScene());
  assert.equal(controller.isInitialised(), true);
  controller.destroy();
  assert.equal(controller.isInitialised(), false);
  assert.equal(controller.getPreviewMachine(), null);
});
