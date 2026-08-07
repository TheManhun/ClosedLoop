export default class ApiCoordinator {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
  }

  initialise() {
    // Prepare any API related configuration here.
  }

  async fetchScenario(id) {
    // Centralised data access for V2. Implementation deferred.
    // Returns a minimal scenario object so bootstrap can proceed.
    return Promise.resolve({ id: id ?? 'default', name: 'Empty V2 Scenario' });
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

  destroy() {
    // Clean up network resources if any.
  }
}
