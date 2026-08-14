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
  const tintLog = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, lineStyle() {}, setAlpha() {}, destroy() {},
      }),
      image: () => ({
        setAlpha() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setTint(color) { tintLog.push(color); }, destroy() {},
      }),
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
  assert.equal(tintLog[tintLog.length - 1], 0xff5c5c);
});

test('moving away from grid-origin collision restores green valid state', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus, cellSize: 64 });
  const machine = { id: 41, name: 'Recover Green', image: 'recover.png', footprint_x: 2, footprint_y: 2 };
  const tintLog = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {}, fillStyle() {}, fillRect() {}, strokeRect() {}, lineStyle() {}, setAlpha() {}, destroy() {},
      }),
      image: () => ({
        setAlpha() {}, setPosition() {}, setDisplaySize() {}, setVisible() {}, setTint(color) { tintLog.push(color); }, destroy() {},
      }),
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
  assert.equal(tintLog[tintLog.length - 1], 0x7dd3fc);
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
  const created = [];
  const fakeScene = {
    input: { on: () => {}, off: () => {} },
    events: { on: () => {}, off: () => {} },
    cameras: { main: { worldView: { x: 0, y: 0, width: 2000, height: 2000 } } },
    add: {
      graphics: () => ({
        clear() {},
        lineStyle() {},
        fillStyle() {},
        fillRect() {},
        strokeRect() {},
        destroy() {},
      }),
      image: () => {
        const img = {
          x: 0,
          y: 0,
          tint: null,
          alpha: 1,
          visible: true,
          displayWidth: 0,
          displayHeight: 0,
          setOrigin() {},
          setAlpha(value) { this.alpha = value; },
          setPosition(x, y) { this.x = x; this.y = y; },
          setDisplaySize(width, height) { this.displayWidth = width; this.displayHeight = height; },
          setVisible(value) { this.visible = value; },
          setTint(value) { this.tint = value; },
          destroy() {},
        };
        created.push(img);
        return img;
      },
    },
    textures: { exists: () => false },
  };

  controller.initialise(fakeScene);
  bus.emit('scenario:loaded', { scenario_objects: [
    { id: 27, position_x: 0, position_y: 0, machine: { id: 111, footprint_x: 2, footprint_y: 2 } },
  ] });
  bus.emit('technology:selected', { machine });

  controller._updateGhostPosition(256, 256);
  assert.equal(controller._ghost, created[0]);
  assert.equal(created.length, 1);
  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller._ghost.tint, 0x7dd3fc);

  controller._updateGhostPosition(64, 64);
  assert.equal(controller._ghost, created[0]);
  assert.equal(created.length, 1);
  assert.equal(controller.getPreviewState().valid, false);
  assert.equal(controller.getPreviewState().reason, 'collision');
  assert.equal(controller._ghost.tint, 0xff5c5c);

  controller._updateGhostPosition(256, 256);
  assert.equal(controller._ghost, created[0]);
  assert.equal(created.length, 1);
  assert.equal(controller.getPreviewState().valid, true);
  assert.equal(controller._ghost.tint, 0x7dd3fc);
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
