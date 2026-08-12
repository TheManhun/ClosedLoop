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

test('destroy removes listeners', () => {
  const bus = new EventBus();
  const controller = new PlacementController({ eventBus: bus });

  controller.initialise(makeScene());
  assert.equal(controller.isInitialised(), true);
  controller.destroy();
  assert.equal(controller.isInitialised(), false);
  assert.equal(controller.getPreviewMachine(), null);
});
