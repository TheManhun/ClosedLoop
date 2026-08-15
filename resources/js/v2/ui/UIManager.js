export default class UIManager {
  constructor({ eventBus, renderer, toolbox, statusProviders } = {}) {
    this.eventBus = eventBus;
    this.renderer = renderer;
    this.toolbox = toolbox;
    // statusProviders: { eventBus, api, dataLoader, technology, simulation, game, scenarioLoader }
    this.statusProviders = statusProviders || {};
    this.mounted = false;
    this._initialised = false;
    this._currentScenario = null;
    this._bound = {};
    this._statusEl = null;
    this._contextBootState = 'idle';
    this._contextBootDetail = '';
  }

  _getOrCreateStatusBlock(root) {
    if (!root) return null;

    if (root.querySelector && typeof root.querySelector === 'function') {
      const existing = root.querySelector('.v2-status-block');
      if (existing) {
        this._statusEl = existing;
        return existing;
      }

      const block = document.createElement('div');
      block.className = 'v2-status-block';
      block.setAttribute('aria-live', 'polite');
      block.style.position = 'relative';
      block.style.width = 'min(320px, calc(100vw - 32px))';
      block.style.maxWidth = '320px';
      block.style.padding = '8px 10px';
      block.style.background = 'rgba(9, 12, 18, 0.75)';
      block.style.color = '#dfeaf7';
      block.style.borderRadius = '8px';
      block.style.boxSizing = 'border-box';
      block.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      block.style.pointerEvents = 'none';
      block.style.zIndex = '21';
      block.style.margin = '0';
      root.appendChild(block);
      this._statusEl = block;
      return block;
    }

    if (!this._statusEl) {
      this._statusEl = { className: 'v2-status-block', innerText: '' };
    }
    return this._statusEl;
  }

  _renderStatus() {
    const root = typeof document !== 'undefined' ? document.getElementById('closed-loop-v2-ui') : null;
    if (!root) return;

    const statusEl = this._getOrCreateStatusBlock(root);
    if (!statusEl) return;

    const dl = this.statusProviders.dataLoader;
    const currentScenario = this._currentScenario || (dl && typeof dl.getScenarioById === 'function' ? dl.getScenarioById(2) : null);

    const lines = [];
    if (currentScenario && currentScenario.name) {
      lines.push(currentScenario.name);
    } else {
      lines.push('Closed Loop V2');
    }

    if (currentScenario && currentScenario.population != null) {
      lines.push(`Population: ${Number(currentScenario.population).toLocaleString()}`);
    }

    if (Array.isArray(currentScenario && currentScenario.scenario_resources)) {
      lines.push(`${currentScenario.scenario_resources.length} regional resource streams`);
    }

    if (this._contextBootState && this._contextBootState !== 'idle') {
      lines.push(`Context: ${this._contextBootState}`);
      if (this._contextBootDetail) {
        lines.push(this._contextBootDetail);
      }
    }

    const text = lines.join('\n');
    if ('textContent' in statusEl) statusEl.textContent = text;
    if ('innerText' in statusEl) statusEl.innerText = text;

    // Backward compatibility for legacy plain-object test roots.
    if (!root.querySelector && typeof root === 'object') {
      root.innerText = text;
    }
  }

  _onScenarioLoaded = (scenario) => {
    this._currentScenario = scenario || null;
    this._renderStatus();
  };

  initialise() {
    if (this._initialised) return;
    this._initialised = true;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      if (!this._bound.onScenarioLoaded) {
        this._bound.onScenarioLoaded = this._onScenarioLoaded;
        this.eventBus.on('scenario:loaded', this._bound.onScenarioLoaded);
      }
    }

    this._renderStatus();

    // Initialise selection inspector (small read-only panel) if available
    try {
      if (typeof require === 'function') {
        const SelectionInspector = require('../ui/SelectionInspector.js').default;
        if (SelectionInspector && this.eventBus && !this._selectionInspector) {
          try {
            this._selectionInspector = new SelectionInspector({ eventBus: this.eventBus });
            this._selectionInspector.initialise();
          } catch (e) {}
        }
      } else {
        // Browser: dynamic import so UI panels mount at runtime
        if (!this._selectionInspector) {
          import('../ui/SelectionInspector.js').then((mod) => {
            try {
              const SelectionInspector = mod && mod.default;
              if (SelectionInspector && this.eventBus) {
                this._selectionInspector = new SelectionInspector({ eventBus: this.eventBus });
                this._selectionInspector.initialise();
              }
            } catch (e) {}
          }).catch(() => {});
        }
      }
    } catch (e) {}

    // Initialise context panel (shows compatible machines) if available
    try {
      if (typeof require === 'function') {
        const ContextPanel = require('../ui/ContextPanel.js').default;
        if (ContextPanel && this.eventBus && this.statusProviders.technology && !this._contextPanel) {
          try {
            this._contextPanel = new ContextPanel({ eventBus: this.eventBus, technology: this.statusProviders.technology });
            this._contextPanel.initialise();
          } catch (e) {
            // Ignore runtime-mount construction failures; the UI will continue to render without the panel.
          }
        }
      } else {
        // Browser: dynamic import for runtime mount
        if (!this._contextPanel) {
          this._contextBootState = 'CONTEXT_IMPORT_START';
          this._contextBootDetail = 'dynamic import';
          this._renderStatus();
          import('../ui/ContextPanel.js').then((mod) => {
            try {
              const ContextPanel = mod && mod.default;
              this._contextBootState = 'CONTEXT_IMPORT_OK';
              this._contextBootDetail = 'import resolved';
              this._renderStatus();
              if (ContextPanel && this.eventBus && this.statusProviders.technology) {
                this._contextBootState = 'CONTEXT_CONSTRUCTOR_START';
                this._contextBootDetail = 'new ContextPanel';
                this._renderStatus();
                try {
                  this._contextPanel = new ContextPanel({ eventBus: this.eventBus, technology: this.statusProviders.technology });
                  this._contextBootState = 'CONTEXT_CONSTRUCTOR_OK';
                  this._contextBootDetail = 'constructor ok';
                  this._renderStatus();
                } catch (e) {
                  const message = (e && e.message) ? e.message : String(e);
                  const stack = (e && e.stack) ? e.stack : '';
                  this._contextBootState = 'CONTEXT_CONSTRUCTOR_FAILED';
                  this._contextBootDetail = `${message}\n${stack}`;
                  this._renderStatus();
                  return;
                }
                try {
                  this._contextBootState = 'CONTEXT_INITIALISE_START';
                  this._contextBootDetail = 'initialise()';
                  this._renderStatus();
                  this._contextPanel.initialise();
                  this._contextBootState = 'CONTEXT_INITIALISE_OK';
                  this._contextBootDetail = 'initialise() ok';
                  this._renderStatus();
                } catch (e) {
                  const message = (e && e.message) ? e.message : String(e);
                  const stack = (e && e.stack) ? e.stack : '';
                  this._contextBootState = 'CONTEXT_INITIALISE_FAILED';
                  this._contextBootDetail = `${message}\n${stack}`;
                  this._renderStatus();
                }
                const root = typeof document !== 'undefined' ? document.getElementById('closed-loop-v2-ui') : null;
                if (root && root.querySelector && root.querySelector('.v2-context-panel')) {
                  this._contextBootState = 'CONTEXT_DOM_MOUNTED';
                  this._contextBootDetail = 'panel mounted';
                  this._renderStatus();
                } else {
                  this._contextBootState = 'CONTEXT_DOM_NOT_MOUNTED';
                  this._contextBootDetail = 'panel not mounted';
                  this._renderStatus();
                }
              } else {
                this._contextBootState = 'CONTEXT_IMPORT_OK_BUT_DEPENDENCIES_MISSING';
                this._contextBootDetail = JSON.stringify({ hasCtor: !!ContextPanel, hasBus: !!this.eventBus, hasTech: !!this.statusProviders.technology });
                this._renderStatus();
              }
            } catch (e) {
              const message = (e && e.message) ? e.message : String(e);
              const stack = (e && e.stack) ? e.stack : '';
              this._contextBootState = 'CONTEXT_BOOT_FAILED';
              this._contextBootDetail = `${message}\n${stack}`;
              this._renderStatus();
            }
          }).catch((e) => {
            const message = (e && e.message) ? e.message : String(e);
            const stack = (e && e.stack) ? e.stack : '';
            this._contextBootState = 'CONTEXT_IMPORT_FAILED';
            this._contextBootDetail = `${message}\n${stack}`;
            this._renderStatus();
          });
        }
      }
    } catch (e) {
      // Ignore runtime bootstrap errors for the optional context panel.
    }

    this.mounted = true;
  }

  destroy() {
    this.mounted = false;
    this._initialised = false;
    if (this.eventBus && this._bound.onScenarioLoaded && typeof this.eventBus.off === 'function') {
      this.eventBus.off('scenario:loaded', this._bound.onScenarioLoaded);
      if (this.eventBus.listeners && this.eventBus.listeners.has('scenario:loaded')) {
        const set = this.eventBus.listeners.get('scenario:loaded');
        if (set && set.size === 0) this.eventBus.listeners.delete('scenario:loaded');
      }
    }
    this._bound.onScenarioLoaded = null;
    this._currentScenario = null;

    const root = typeof document !== 'undefined' ? document.getElementById('closed-loop-v2-ui') : null;
    if (root && root.querySelector && typeof root.querySelector === 'function') {
      const owned = [
        root.querySelector('.v2-status-block'),
        root.querySelector('.v2-selection-inspector'),
        root.querySelector('.v2-context-panel'),
      ].filter(Boolean);
      for (const node of owned) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }
    } else if (root) {
      root.innerText = '';
    }

    try { if (this._selectionInspector && typeof this._selectionInspector.destroy === 'function') this._selectionInspector.destroy(); } catch (e) {}
    this._selectionInspector = null;
    try { if (this._contextPanel && typeof this._contextPanel.destroy === 'function') this._contextPanel.destroy(); } catch (e) {}
    this._contextPanel = null;
    this._statusEl = null;
  }
}
