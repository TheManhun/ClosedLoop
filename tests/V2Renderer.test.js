import test from 'node:test';
import assert from 'node:assert/strict';
import Renderer from '../resources/js/v2/renderer/Renderer.js';
import App from '../resources/js/v2/App.js';

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
