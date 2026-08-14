import EventBus from './events/EventBus.js';
import ApiCoordinator from './api/ApiCoordinator.js';
import DataLoader from './services/DataLoader.js';
import TechnologyEngine from './technology/TechnologyEngine.js';
import SimulationEngine from './simulation/SimulationEngine.js';
import GameEngine from './engine/GameEngine.js';
import UIManager from './ui/UIManager.js';
import Renderer from './renderer/Renderer.js';
import ToolboxController from './toolbox/ToolboxController.js';
import ScenarioLoader from './scenarios/ScenarioLoader.js';
import App from './App.js';

export async function autoSelectPlacedObject({ eventBus, scenarioLoader }, created, scenarioId = null) {
  if (!eventBus || typeof eventBus.emit !== 'function') return false;
  if (!created || created.id == null) return false;

  const resolvedScenarioId = Number.isFinite(Number(scenarioId ?? created.scenario_id))
    ? Number(scenarioId ?? created.scenario_id)
    : null;

  if (!resolvedScenarioId || !scenarioLoader || typeof scenarioLoader.load !== 'function') {
    return false;
  }

  try {
    const scenario = await scenarioLoader.load(resolvedScenarioId);
    const match = Array.isArray(scenario && scenario.scenario_objects)
      ? scenario.scenario_objects.find((obj) => Number(obj && obj.id) === Number(created.id))
      : null;

    if (!match) {
      eventBus.emit('placement:selection:skipped', {
        created,
        scenario_id: resolvedScenarioId,
        reason: 'matching-object-not-found',
      });
      return false;
    }

    eventBus.emit('selection:request', {
      kind: 'object',
      id: Number(match.id),
      instance_key: match.object_key ?? null,
      meta: match,
      world: {
        x: Number(match.grid_x ?? 0) * 64,
        y: Number(match.grid_y ?? 0) * 64,
      },
      _pointerId: null,
    });

    return true;
  } catch (error) {
    eventBus.emit('placement:failed', {
      created,
      scenario_id: resolvedScenarioId,
      error,
    });
    return false;
  }
}

export async function run() {
  // Bootstrap sequence (Stage 0) — no gameplay or simulation implementation here.
  const eventBus = new EventBus();


  const api = new ApiCoordinator({ eventBus });
  const dataLoader = new DataLoader({ apiCoordinator: api });
  const scenarioLoader = new ScenarioLoader({ dataLoader, eventBus });

  eventBus.on('placement:confirm', async (payload) => {
    if (!payload || !payload.scenario_id || !payload.machine_id) return;
    try {
      const created = await api.createScenarioObject(payload);
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('placement:committed', { ...payload, created });
      }
      await autoSelectPlacedObject({ eventBus, scenarioLoader }, created, payload.scenario_id);
    } catch (error) {
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('placement:failed', { payload, error });
      }
    }
  });

  const technology = new TechnologyEngine({ eventBus, dataLoader });
  const simulation = new SimulationEngine({ eventBus, technologyEngine: technology });

  const gameEngine = new GameEngine({ eventBus, simulationEngine: simulation, technologyEngine: technology });

  const renderer = new Renderer({ eventBus });
  const toolbox = new ToolboxController({ eventBus });
  if (renderer && renderer._placementController && typeof renderer._placementController.setRuntimeEventConsumerInstalled === 'function') {
    renderer._placementController.setRuntimeEventConsumerInstalled(true);
  }

  const uiManager = new UIManager({ eventBus, renderer, toolbox, statusProviders: { eventBus, api, dataLoader, technology, simulation, game: gameEngine, scenarioLoader } });

  // Create app and let App lifecycle own startup loading via ScenarioLoader.
  const app = new App({ eventBus, renderer, gameEngine, uiManager, scenario: null, scenarioLoader, dataLoader });
  await app.start();
}

// Auto-run in browser environment only. Exported for tests.
if (typeof document !== 'undefined') {
  run().catch((err) => {
    // Surface bootstrap failures into the V2 root element for Stage 0 visibility.
    // eslint-disable-next-line no-console
    console.error('V2 bootstrap failed', err);
    try {
      const root = document.getElementById('closed-loop-v2-root');
      if (root) root.innerText = `Stage 0 boot error: ${err && err.message ? err.message : String(err)}`;
    } catch (e) {
      // If DOM is not available, fallback to console only.
    }
  });
}

export default run;
