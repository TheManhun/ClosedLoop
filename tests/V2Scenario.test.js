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

test('DataLoader.loadScenario preserves embedded resource.visual_type from API payload', async () => {
  const scenarioFixture = {
    id: 2,
    name: 'Dandenong South Closed Loop Hub',
    scenario_resources: [
      { id: 1, resource_id: 101, display_name: 'Residual Waste', current_quantity: 100, unit: 't', resource: { id: 101, name: 'Residual Waste', visual_type: 'mixed_waste' } },
    ],
  };

  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadScenario(2);
  assert.equal(loaded.scenario_resources[0].resource.visual_type, 'mixed_waste');
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

test('DataLoader.loadScenario preserves scenario_objects and machine metadata', async () => {
  const scenarioFixture = {
    id: 2,
    name: 'Dandenong South Closed Loop Hub',
    scenario_objects: [
      {
        id: 1,
        scenario_id: 2,
        object_key: 'dandenong-existing-wastewater-plant',
        object_type: 'machine',
        name: 'Regional Wastewater Treatment Plant',
        machine_id: 2,
        position_x: 320,
        position_y: 0,
        rotation: 0,
        fixed: true,
        selectable: true,
        object_config: {},
        notes: "Represents existing regional wastewater treatment infrastructure serving Melbourne's south-east.",
        machine: { id: 2, stable_key: null, name: 'Wastewater Treatment Plant', category: 'Water Treatment', image: 'Primary_Clarifier.png', footprint_x: 4, footprint_y: 3 },
      },
    ],
  };

  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadScenario(2);
  assert.ok(Array.isArray(loaded.scenario_objects));
  assert.equal(loaded.scenario_objects.length, 1);
  const so = loaded.scenario_objects[0];
  assert.equal(so.id, 1);
  assert.equal(so.machine.id, 2);
  assert.equal(so.machine.name, 'Wastewater Treatment Plant');
  assert.equal(so.machine.footprint_x, 4);
  assert.equal(so.machine.footprint_y, 3);
  // object_config should be preserved as an object (empty object serializes as {})
  assert.equal(typeof so.object_config, 'object');
  assert.equal(Object.keys(so.object_config).length, 0);
});

test('DataLoader.loadScenario tolerates empty scenario_objects', async () => {
  const scenarioFixture = { id: 2, name: 'Dandenong South Closed Loop Hub', scenario_objects: [] };
  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadScenario(2);
  assert.ok(Array.isArray(loaded.scenario_objects));
  assert.equal(loaded.scenario_objects.length, 0);
});

test('DataLoader.loadScenario preserves scenario.map_image when present', async () => {
  const scenarioFixture = { id: 2, name: 'Dandenong South Closed Loop Hub', map_image: 'dandenong_vic.png', scenario_objects: [] };
  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const loaded = await dl.loadScenario(2);
  assert.equal(loaded.map_image, 'dandenong_vic.png');
});
