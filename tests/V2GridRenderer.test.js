import test from 'node:test';
import assert from 'node:assert/strict';
import GridRenderer from '../resources/js/v2/renderer/GridRenderer.js';

test('GridRenderer constructs in Node without Phaser globals', () => {
  const g = new GridRenderer();
  assert.equal(typeof g, 'object');
});

test('destroy before initialise is safe and idempotent', () => {
  const g = new GridRenderer();
  assert.doesNotThrow(() => g.destroy());
  assert.doesNotThrow(() => g.destroy());
});

test('initialise with fake scene calls add.graphics() and draws expected number of lines', () => {
  const calls = [];
  const fakeGraphics = {
    lineStyle: (w, color, alpha) => { calls.push(['lineStyle', w, color, alpha]); },
    lineBetween: (x1, y1, x2, y2) => { calls.push(['lineBetween', x1, y1, x2, y2]); },
    moveTo: (x, y) => { calls.push(['moveTo', x, y]); },
    lineTo: (x, y) => { calls.push(['lineTo', x, y]); },
    strokePath: () => { calls.push(['strokePath']); },
    destroy: () => { calls.push(['destroy']); }
  };

  const fakeScene = {
    add: {
      graphics: () => fakeGraphics
    }
  };

  const g = new GridRenderer();
  g.initialise(fakeScene);

  // For default 4096x4096 with 64 spacing, expect (4096/64 + 1) vertical and same horizontal lines
  const linesPerAxis = Math.floor(g.width / g.cellSize) + 1;
  const expectedLineBetweenCalls = linesPerAxis * 2; // vertical + horizontal

  // Count actual lineBetween entries
  const actualLineBetween = calls.filter(c => c[0] === 'lineBetween').length;
  assert.equal(actualLineBetween, expectedLineBetweenCalls);

  // Now destroy and verify graphics.destroy was called
  g.destroy();
  const destroyedCalls = calls.filter(c => c[0] === 'destroy').length;
  assert(destroyedCalls >= 1, 'graphics.destroy should be called during GridRenderer.destroy()');
});

test('destroy after initialise is idempotent', () => {
  const fakeGraphics = { lineStyle: () => {}, lineBetween: () => {}, destroy: () => { } };
  const fakeScene = { add: { graphics: () => fakeGraphics } };
  const g = new GridRenderer();
  g.initialise(fakeScene);
  assert.doesNotThrow(() => g.destroy());
  assert.doesNotThrow(() => g.destroy());
});
