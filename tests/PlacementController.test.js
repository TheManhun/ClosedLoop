import assert from 'assert';
import PlacementController from '../resources/js/simulator/controllers/PlacementController.js';

// Minimal scene stub with camera and grid config
const scene = {
    cameras: {
        main: { getWorldPoint: (x, y) => ({ x: x, y: y }) }
    },
    _gridConfig: { minor: 32 },
    _hoverGraphics: { clear: () => {}, fillStyle: () => {}, fillRect: () => {}, lineStyle: () => {}, strokeRect: () => {} }
};
// minimal building definitions used by PlacementController._footprintFor
scene._buildingDefs = {
    anaerobicDigester: { footprint: [3,2] },
    processUnit: { footprint: [2,2] }
};

let selectCalled = false;
const buildingManager = {
    placeMachine: (ix, iy, defKey) => ({ id: 123, defKey, gridX: ix, gridY: iy }),
    selectMachine: (rec) => { selectCalled = true; },
    getMachineAt: (ix, iy) => null
};

const pc = new PlacementController(scene, buildingManager);
pc.beginPlacement('anaerobicDigester');

// simulate pointer down at pixel coords which map to grid ix,iy = 0,0
pc.handlePointerDown({ x: 0, y: 0 });

assert.ok(selectCalled, 'selectMachine should be called after placing');

console.log('PlacementController selection persistence test passed');
