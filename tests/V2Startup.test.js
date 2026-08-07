import test from 'node:test';
import assert from 'node:assert/strict';

import ApiCoordinator from '../resources/js/v2/api/ApiCoordinator.js';
import DataLoader from '../resources/js/v2/services/DataLoader.js';
import ScenarioLoader from '../resources/js/v2/scenarios/ScenarioLoader.js';
import UIManager from '../resources/js/v2/ui/UIManager.js';
import App from '../resources/js/v2/App.js';

test('App startup loads machines and UI shows real data', async () => {
  // Fake DOM
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  // Mock ApiCoordinator to return a realistic envelope
  const fixture = { value: [ { id: 101, name: 'LoaderMachine' } ], Count: 1 };
  const api = new ApiCoordinator({});
  api.fetchMachines = async () => fixture;
  api.fetchScenario = async (id) => ({ id: id ?? 'default', name: 'Empty' });

  const dataLoader = new DataLoader({ apiCoordinator: api });
  const scenarioLoader = new ScenarioLoader({ dataLoader });

  const uiManager = new UIManager({ statusProviders: { dataLoader } });

  // Minimal renderer and gameEngine mocks
  const renderer = { initialise: () => {} };
  const gameEngine = { initialise: () => {}, start: () => {} };

  const app = new App({ eventBus: null, renderer, gameEngine, uiManager, scenario: null, scenarioLoader, dataLoader });
  await app.start();

  assert.ok(root.innerText.includes('Machines: 1'));
  assert.ok(root.innerText.includes('First: LoaderMachine'));
});
