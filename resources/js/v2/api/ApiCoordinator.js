export default class ApiCoordinator {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
  }

  initialise() {
    // Prepare any API related configuration here.
  }

  async fetchScenario(id) {
    const url = `/api/scenarios/${encodeURIComponent(id)}`;
    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
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
      resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
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
      resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
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

  destroy() {
    // Clean up network resources if any.
  }
}
