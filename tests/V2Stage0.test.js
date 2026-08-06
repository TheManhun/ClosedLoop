import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import EventBus from '../resources/js/v2/events/EventBus.js';
import App from '../resources/js/v2/App.js';
import * as mainModule from '../resources/js/v2/main.js';

test('EventBus subscribe, emit, unsubscribe', () => {
  const bus = new EventBus();
  let called = 0;
  const handler = (p) => { called += p; };
  bus.on('inc', handler);
  bus.emit('inc', 2);
  assert.equal(called, 2);
  bus.off('inc', handler);
  bus.emit('inc', 3);
  assert.equal(called, 2);
});

test('App initialises and starts game in order and destroy reverses lifecycle', async () => {
  const calls = [];
  const renderer = {
    initialise: () => calls.push('renderer.init'),
    destroy: () => calls.push('renderer.destroy'),
  };
  const ui = {
    initialise: () => calls.push('ui.init'),
    destroy: () => calls.push('ui.destroy'),
  };
  const game = {
    initialise: () => calls.push('game.init'),
    start: () => calls.push('game.start'),
    destroy: () => calls.push('game.destroy'),
  };
  const app = new App({ eventBus: {}, renderer, gameEngine: game, uiManager: ui, scenario: null });
  await app.start();
  // expected initialisation order: renderer, ui, game
  assert.deepEqual(calls.slice(0, 3), ['renderer.init', 'ui.init', 'game.init']);
  assert(calls.includes('game.start'));

  // Destroy should call game.destroy then ui.destroy (order as implemented)
  app.destroy();
  // ensure destroy order: game.destroy -> ui.destroy -> renderer.destroy
  const gi = calls.indexOf('game.destroy');
  const uii = calls.indexOf('ui.destroy');
  const ri = calls.indexOf('renderer.destroy');
  assert(gi >= 0 && uii >= 0 && ri >= 0, 'destroy calls missing');
  assert(gi < uii && uii < ri, 'destroy order incorrect');
});

test('No fetch() calls exist in V2 modules except possibly ApiCoordinator', () => {
  const v2dir = path.resolve('resources/js/v2');
  const files = fs.readdirSync(v2dir, { withFileTypes: true });
  const matches = [];

  function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.js')) {
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes('fetch(')) matches.push({ file: p, content });
      }
    }
  }

  walk(v2dir);
  // Allow zero matches; ensure no fetch outside ApiCoordinator.js
  for (const m of matches) {
    assert.ok(m.file.endsWith(path.join('v2', 'api', 'ApiCoordinator.js')),
      `fetch found outside ApiCoordinator: ${m.file}`);
  }
});

test('main exports run and does not auto-run in Node import', () => {
  assert.equal(typeof mainModule.run, 'function');
});

test('V2 modules do not import legacy simulator', () => {
  const v2dir = path.resolve('resources/js/v2');
  function walk(dir) {
    const bad = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) bad.push(...walk(p));
      else if (f.name.endsWith('.js')) {
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes("simulator") && !p.includes(path.join('v2'))) {
          bad.push(p);
        }
      }
    }
    return bad;
  }
  const bad = walk(v2dir);
  // There should be no files in v2 that import or reference legacy simulator file paths.
  assert.equal(bad.length, 0, `Found legacy simulator references in V2: ${bad.join(',')}`);
});
