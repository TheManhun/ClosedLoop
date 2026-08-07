import test from 'node:test';
import assert from 'node:assert/strict';

import ApiCoordinator from '../resources/js/v2/api/ApiCoordinator.js';
import DataLoader from '../resources/js/v2/services/DataLoader.js';
import ScenarioLoader from '../resources/js/v2/scenarios/ScenarioLoader.js';

test('ApiCoordinator.fetchScenario requests correct URL and returns JSON', async () => {
  let calledUrl = null;
  global.fetch = async (url, opts) => {
    calledUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ id: 2, stable_key: 'dandenong-south', name: 'Dandenong South Closed Loop Hub', population: 860060, scenario_resources: [] }),
    };
  };

  const api = new ApiCoordinator();
  const res = await api.fetchScenario(2);
  assert.equal(calledUrl, '/api/scenarios/2');
  assert.equal(res.id, 2);
  assert.equal(res.name, 'Dandenong South Closed Loop Hub');
});

test('DataLoader.loadScenario stores scenario and links resources when available', async () => {
  const scenarioFixture = {
    id: 2,
    name: 'Dandenong South Closed Loop Hub',
    population: 860060,
    scenario_resources: [
      { id: 1, resource_id: 101, display_name: 'residual waste', initial_quantity: 100, current_quantity: 90, unit: 't' },
      { id: 2, resource_id: 102, display_name: 'mixed recycling', initial_quantity: 50, current_quantity: 40, unit: 't' },
    ],
  };

  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  // preload resources so canonical linking finds them
  dl._resources = [ { id: 101, name: 'residual waste' }, { id: 102, name: 'mixed recycling' } ];

  const loaded = await dl.loadScenario(2);
  assert.equal(loaded.id, 2);
  const s = dl.getScenarioById(2);
  assert.ok(s);
  assert.equal(s.scenario_resources.length, 2);
  assert.ok(s.scenario_resources[0].resource_canonical);
  assert.equal(s.scenario_resources[0].resource_canonical.name, 'residual waste');
});

test('ScenarioLoader.load emits scenario:loaded via eventBus', async () => {
  const scenarioFixture = { id: 2, name: 'Dandenong' };
  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const events = [];
  const eventBus = { emit: (k, v) => events.push({ k, v }) };
  const loader = new ScenarioLoader({ dataLoader: dl, eventBus });
  const s = await loader.load(2);
  assert.equal(s.id, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].k, 'scenario:loaded');
  assert.equal(events[0].v.id, 2);
});
