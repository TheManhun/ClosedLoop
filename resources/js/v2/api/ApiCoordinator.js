export default class ApiCoordinator {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
  }

  _getCsrfToken() {
    try {
      if (typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) {
          return meta.content;
        }
        if (document.cookie) {
          const match = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('XSRF-TOKEN='));
          if (match) {
            return decodeURIComponent(match.split('=').slice(1).join('='));
          }
          const fallback = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('csrf_token='));
          if (fallback) {
            return decodeURIComponent(fallback.split('=').slice(1).join('='));
          }
        }
      }
    } catch (e) {
      // No browser document available in tests or non-browser runtimes.
    }
    return null;
  }

  _buildJsonOptions(method, body, extraHeaders = {}) {
    const csrfToken = this._getCsrfToken();
    const headers = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    return {
      method,
      credentials: 'same-origin',
      headers,
      ...(body !== undefined && body !== null ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    };
  }

  initialise() {
    // Prepare any API related configuration here.
  }

  async fetchScenario(id) {
    const url = `/api/scenarios/${encodeURIComponent(id)}`;
    let resp;
    try {
      resp = await fetch(url, this._buildJsonOptions('GET'));
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchScenario network error: ${e.message}`);
      err.cause = e;
      throw err;
    }
    if (!resp || !resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch (e) { body = '<unreadable body>'; }
      const msg = `ApiCoordinator.fetchScenario HTTP ${resp ? resp.status : 'ERR'}: ${resp ? resp.statusText : ''} ${body}`;
      const err = new Error(msg);
      err.status = resp ? resp.status : null;
      throw err;
    }
    try {
      return await resp.json();
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchScenario invalid JSON: ${e.message}`);
      err.cause = e;
      throw err;
    }
  }

  /**
   * Fetch the machines list from the backend Laravel API.
   * Returns the parsed JSON body or throws a descriptive error on failure.
   */
  async fetchMachines() {
    const url = '/api/machines';
    let resp;
    try {
      resp = await fetch(url, this._buildJsonOptions('GET'));
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchMachines network error: ${e.message}`);
      err.cause = e;
      throw err;
    }
    if (!resp || !resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch (e) { body = '<unreadable body>'; }
      const msg = `ApiCoordinator.fetchMachines HTTP ${resp ? resp.status : 'ERR'}: ${resp ? resp.statusText : ''} ${body}`;
      const err = new Error(msg);
      err.status = resp ? resp.status : null;
      throw err;
    }
    try {
      return await resp.json();
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchMachines invalid JSON: ${e.message}`);
      err.cause = e;
      throw err;
    }
  }

  /**
   * Fetch the resources list from the backend Laravel API.
   * Returns the parsed JSON body (expected to be an array) or throws a descriptive error on failure.
   */
  async fetchResources() {
    const url = '/api/resources';
    let resp;
    try {
      resp = await fetch(url, this._buildJsonOptions('GET'));
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchResources network error: ${e.message}`);
      err.cause = e;
      throw err;
    }
    if (!resp || !resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch (e) { body = '<unreadable body>'; }
      const msg = `ApiCoordinator.fetchResources HTTP ${resp ? resp.status : 'ERR'}: ${resp ? resp.statusText : ''} ${body}`;
      const err = new Error(msg);
      err.status = resp ? resp.status : null;
      throw err;
    }
    try {
      return await resp.json();
    } catch (e) {
      const err = new Error(`ApiCoordinator.fetchResources invalid JSON: ${e.message}`);
      err.cause = e;
      throw err;
    }
  }

  async createScenarioObject(scenarioIdOrPayload, maybePayload) {
    const payload = arguments.length >= 2 ? (maybePayload || {}) : (scenarioIdOrPayload && typeof scenarioIdOrPayload === 'object' ? scenarioIdOrPayload : {});
    const scenarioId = arguments.length >= 2 ? scenarioIdOrPayload : (payload && Number.isFinite(Number(payload.scenario_id)) ? Number(payload.scenario_id) : null);
    if (!scenarioId) {
      throw new Error('ApiCoordinator.createScenarioObject requires a scenario id');
    }
    const url = `/api/scenarios/${encodeURIComponent(scenarioId)}/scenario-objects`;
    let resp;
    try {
      resp = await fetch(url, this._buildJsonOptions('POST', payload));
    } catch (e) {
      const err = new Error(`ApiCoordinator.createScenarioObject network error: ${e.message}`);
      err.cause = e;
      throw err;
    }
    if (!resp || !resp.ok) {
      let bodyText = '';
      try { bodyText = await resp.text(); } catch (e) { bodyText = '<unreadable body>'; }
      const msg = `ApiCoordinator.createScenarioObject HTTP ${resp ? resp.status : 'ERR'}: ${resp ? resp.statusText : ''} ${bodyText}`;
      const err = new Error(msg);
      err.status = resp ? resp.status : null;
      throw err;
    }
    try {
      return await resp.json();
    } catch (e) {
      const err = new Error(`ApiCoordinator.createScenarioObject invalid JSON: ${e.message}`);
      err.cause = e;
      throw err;
    }
  }

  destroy() {
    // Clean up network resources if any.
  }
}
