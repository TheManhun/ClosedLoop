export default class UIManager {
  constructor({ eventBus, renderer, toolbox, statusProviders } = {}) {
    this.eventBus = eventBus;
    this.renderer = renderer;
    this.toolbox = toolbox;
    // statusProviders: { eventBus, api, dataLoader, technology, simulation, game, scenarioLoader }
    this.statusProviders = statusProviders || {};
    this.mounted = false;
  }

  initialise() {
    // Minimal Stage 0 UI: render simple textual status block if root exists.
    const root = typeof document !== 'undefined' ? document.getElementById('closed-loop-v2-root') : null;
    if (root) {
      const lines = [];
      lines.push('Closed Loop V2');
      lines.push('Stage 0 — Architecture Booted');

      const mapStatus = (name, obj) => (obj ? 'OK' : 'Not available');

      lines.push(`EventBus: ${mapStatus('eventBus', this.statusProviders.eventBus)}`);
      lines.push(`ApiCoordinator: ${mapStatus('api', this.statusProviders.api)}`);
      lines.push(`DataLoader: ${mapStatus('dataLoader', this.statusProviders.dataLoader)}`);
      lines.push(`TechnologyEngine: ${mapStatus('technology', this.statusProviders.technology)}`);
      lines.push(`SimulationEngine: ${mapStatus('simulation', this.statusProviders.simulation)}`);
      lines.push(`GameEngine: ${mapStatus('game', this.statusProviders.game)}`);
      lines.push(`UIManager: ${mapStatus('ui', this)}`);
      lines.push(`ScenarioLoader: ${mapStatus('scenarioLoader', this.statusProviders.scenarioLoader)}`);
      // Scenario loaded status
      lines.push('Scenario: Not loaded');

      root.innerText = lines.join('\n');
    }

    this.mounted = true;
  }

  destroy() {
    this.mounted = false;
    const root = typeof document !== 'undefined' ? document.getElementById('closed-loop-v2-root') : null;
    if (root) root.innerText = '';
  }
}
