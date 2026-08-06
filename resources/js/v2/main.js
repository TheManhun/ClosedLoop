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

export async function run() {
  // Bootstrap sequence (Stage 0) — no gameplay or simulation implementation here.
  const eventBus = new EventBus();

  const api = new ApiCoordinator({ eventBus });
  const dataLoader = new DataLoader({ apiCoordinator: api });

  const technology = new TechnologyEngine({ eventBus, dataLoader });
  const simulation = new SimulationEngine({ eventBus, technologyEngine: technology });

  const gameEngine = new GameEngine({ eventBus, simulationEngine: simulation, technologyEngine: technology });

  const renderer = new Renderer({ eventBus });
  const toolbox = new ToolboxController({ eventBus });

  const scenarioLoader = new ScenarioLoader({ dataLoader, eventBus });
  const uiManager = new UIManager({ eventBus, renderer, toolbox, statusProviders: { eventBus, api, dataLoader, technology, simulation, game: gameEngine, scenarioLoader } });

  // Load a scenario (bootstrap only)
  // Scenario load intentionally not required for Stage 0 verification.
  const app = new App({ eventBus, renderer, gameEngine, uiManager, scenario: null });
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
