import test from 'node:test';
import assert from 'node:assert/strict';

import ApiCoordinator from '../resources/js/v2/api/ApiCoordinator.js';
import DataLoader from '../resources/js/v2/services/DataLoader.js';
import ScenarioLoader from '../resources/js/v2/scenarios/ScenarioLoader.js';
import LocalScenarioStore from '../resources/js/v2/store/LocalScenarioStore.js';
import EventBus from '../resources/js/v2/events/EventBus.js';
import { autoSelectPlacedObject, handleLocalPlacement } from '../resources/js/v2/main.js';

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
        grid_x: 2,
        grid_y: -2,
        position_x: 320,
        position_y: 0,
        rotation: 0,
        fixed: true,
        selectable: true,
        object_config: {},
        notes: "Represents existing regional wastewater treatment infrastructure serving Melbourne's south-east.",
        machine: { id: 2, stable_key: null, name: 'Wastewater Treatment Plant', category: 'Water Treatment', image: 'Primary_Clarifier.png', footprint_x: 5, footprint_y: 4 },
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
  assert.equal(so.grid_x, 2);
  assert.equal(so.grid_y, -2);
  assert.equal(so.machine.name, 'Wastewater Treatment Plant');
  assert.equal(so.machine.footprint_x, 5);
  assert.equal(so.machine.footprint_y, 4);
  // object_config should be preserved as an object (empty object serializes as {})

  assert.equal(loaded.scenario_objects[0].object_config && typeof loaded.scenario_objects[0].object_config, 'object');
  assert.equal(Object.keys(loaded.scenario_objects[0].object_config).length, 0);
});

test('ScenarioLoader.load performs a fresh fetch and ignores stale cache during authoritative placement refresh', async () => {
  const staleScenario = {
    id: 2,
    name: 'stale cached scenario',
    scenario_objects: [{ id: 10, name: 'stale object' }],
  };
  const freshScenario = {
    id: 2,
    name: 'fresh scenario after placement',
    scenario_objects: [
      { id: 10, name: 'existing object' },
      { id: 77, name: 'newly placed object' },
    ],
  };

  let fetchCalls = 0;
  const api = {
    fetchScenario: async (id) => {
      fetchCalls += 1;
      assert.equal(id, 2);
      return freshScenario;
    },
  };

  const dl = new DataLoader({ apiCoordinator: api });
  dl._scenarios = { 2: staleScenario };

  const events = [];
  const loader = new ScenarioLoader({
    dataLoader: dl,
    eventBus: { emit: (name, payload) => events.push({ name, payload }) },
  });

  const scenario = await loader.load(2);

  assert.equal(fetchCalls, 1);
  assert.equal(scenario.scenario_objects.length, 2);
  assert.equal(scenario.scenario_objects[1].id, 77);
  assert.equal(dl.getScenarioById(2).scenario_objects.length, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'scenario:loaded');
  assert.equal(events[0].payload.scenario_objects[1].id, 77);
});

test('autoSelectPlacedObject selects the exact created DB object after a fresh authoritative reload', async () => {
  const events = [];
  const eventBus = {
    emit: (name, payload) => events.push({ name, payload }),
  };

  const scenarioLoader = {
    load: async (scenarioId) => ({
      id: scenarioId,
      scenario_objects: [
        { id: 10, object_key: 'existing' },
        { id: 77, object_key: 'newly-placed' },
      ],
    }),
  };

  const created = { id: 77, scenario_id: 9 };
  const result = await autoSelectPlacedObject({ eventBus, scenarioLoader }, created, 9);

  assert.equal(result, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'selection:request');
  assert.equal(events[0].payload.id, 77);
  assert.equal(events[0].payload.instance_key, 'newly-placed');
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

test('ScenarioLoader.load boots the local save once and composes a runtime scenario', async () => {
  const scenarioFixture = {
    id: 2,
    name: 'Dandenong South Closed Loop Hub',
    scenario_objects: [
      {
        id: 10,
        object_type: 'machine',
        machine_id: 2,
        grid_x: 0,
        grid_y: 0,
        rotation: 0,
        object_config: { fixed: true },
        name: 'Existing Feed Pump',
        fixed: true,
        selectable: true,
      },
    ],
    scenario_connections: [],
  };

  const api = { fetchScenario: async (id) => scenarioFixture };
  const dl = new DataLoader({ apiCoordinator: api });
  const localScenarioStore = new LocalScenarioStore({ templateId: 2, dbName: 'closed-loop-v2-phase2', storeName: 'local_saves' });
  const loader = new ScenarioLoader({ dataLoader: dl, eventBus: { emit: () => {} }, localScenarioStore });

  const first = await loader.load(2);
  const second = await loader.load(2);

  assert.equal(first.id, 2);
  assert.equal(second.id, 2);
  assert.equal(first.scenario_objects.length, 2);
  assert.equal(localScenarioStore.getState().objects.length, 1);
  assert.equal(typeof localScenarioStore.getState().objects[0].id, 'string');
  assert.notEqual(first.scenario_objects[0].id, first.scenario_objects[1].id);
  assert.equal(first.scenario_objects[1].source, 'local');
});

test('LocalScenarioStore initialises canonical objects into local save without mutating the canonical source', async () => {
  const canonical = {
    id: 2,
    name: 'Dandenong South Closed Loop Hub',
    scenario_objects: [
      { id: 10, object_type: 'machine', machine_id: 2, grid_x: 2, grid_y: 3, rotation: 90, object_config: { locked: true }, name: 'Existing Tank' },
    ],
  };

  const localScenarioStore = new LocalScenarioStore({ templateId: 2, dbName: 'closed-loop-v2-phase2-a', storeName: 'local_saves' });
  const initialState = await localScenarioStore.initialise({ templateId: 2, canonicalScenario: canonical });
  const runtime = localScenarioStore.getRuntimeScenario(canonical);

  assert.equal(initialState.objects.length, 1);
  assert.equal(typeof initialState.objects[0].id, 'string');
  assert.equal(runtime.scenario_objects.length, 2);
  assert.equal(runtime.scenario_objects[0].id, 10);
  assert.equal(runtime.scenario_objects[1].source, 'local');
  assert.equal(canonical.scenario_objects[0].id, 10);
});

test('local placement creates a stable runtime object and selects the exact local ID without API persistence', async () => {
  const eventBus = new EventBus();
  const emitted = [];
  const selected = [];
  eventBus.on('scenario:local:changed', (payload) => emitted.push(payload));
  eventBus.on('selection:request', (payload) => selected.push(payload));

  const localScenarioStore = new LocalScenarioStore({ eventBus, templateId: 2, dbName: `closed-loop-v2-phase3-${Date.now()}-${Math.random().toString(16).slice(2)}`, storeName: 'local_saves' });
  await localScenarioStore.initialise({ templateId: 2, canonicalScenario: { id: 2, name: 'Scenario 2', scenario_objects: [] } });

  const created = handleLocalPlacement({
    eventBus,
    localScenarioStore,
    payload: {
      scenario_id: 2,
      machine_id: 13,
      grid_x: 3,
      grid_y: 4,
      rotation: 90,
      object_config: { foo: 'bar' },
      name: 'Anaerobic Digester',
    },
  });

  assert.ok(created);
  assert.equal(typeof created.id, 'string');
  assert.equal(localScenarioStore.getState().objects.length, 1);
  assert.equal(localScenarioStore.getState().objects[0].id, created.id);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].scenario_objects.length, 1);
  assert.equal(emitted[0].scenario_objects[0].source, 'local');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, created.id);
  assert.equal(selected[0].instance_key, created.id);
});
