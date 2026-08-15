export default class LocalScenarioStore {
  constructor({ eventBus = null, templateId = null, dbName = 'closed-loop-v2', storeName = 'local_saves' } = {}) {
    this.eventBus = eventBus;
    this.templateId = Number.isFinite(Number(templateId)) ? Number(templateId) : templateId ?? null;
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.state = {
      closed_loop_save_version: 1,
      template_id: this.templateId,
      name: '',
      created_at: null,
      updated_at: null,
      objects: [],
      connections: [],
    };
    this._initialised = false;
    this._pendingAutosave = null;
  }

  async initialise({ templateId = this.templateId, canonicalScenario = null } = {}) {
    if (this._initialised) {
      if (templateId != null) this.templateId = Number.isFinite(Number(templateId)) ? Number(templateId) : templateId;
      return this.state;
    }

    if (templateId != null) this.templateId = Number.isFinite(Number(templateId)) ? Number(templateId) : templateId;

    const record = await this._loadFromIndexedDb();
    if (record) {
      this.state = this._normaliseRecord(record);
      this.templateId = this.state.template_id ?? this.templateId;
    } else {
      const base = this._buildInitialRecord(canonicalScenario);
      this.state = this._normaliseRecord(base);
      await this.autosave({ emit: false });
    }

    this._initialised = true;
    return this.state;
  }

  _buildInitialRecord(canonicalScenario = null) {
    const scenarioId = this.templateId ?? (canonicalScenario && canonicalScenario.id != null ? Number(canonicalScenario.id) : null);
    const now = new Date().toISOString();
    const templateObjects = Array.isArray(canonicalScenario && canonicalScenario.scenario_objects) ? canonicalScenario.scenario_objects : [];
    const initialObjects = templateObjects
      .filter((obj) => obj && obj.object_type !== 'resource' && obj.machine_id != null)
      .map((obj) => ({
        id: this._makeLocalUuid(),
        machine_id: Number(obj.machine_id),
        grid_x: Number(obj.grid_x ?? obj.gridX ?? 0),
        grid_y: Number(obj.grid_y ?? obj.gridY ?? 0),
        rotation: Number(obj.rotation ?? 0),
        object_config: obj.object_config ? { ...obj.object_config } : {},
        name: obj.name || `Machine ${obj.machine_id}`,
      }));

    return {
      closed_loop_save_version: 1,
      template_id: scenarioId,
      name: canonicalScenario && canonicalScenario.name ? `${canonicalScenario.name} Local Design` : 'Local Design',
      created_at: now,
      updated_at: now,
      objects: initialObjects,
      connections: [],
    };
  }

  _normaliseRecord(record = {}) {
    const state = {
      closed_loop_save_version: 1,
      template_id: this.templateId,
      name: record && record.name ? String(record.name) : 'Local Design',
      created_at: record && record.created_at ? String(record.created_at) : new Date().toISOString(),
      updated_at: record && record.updated_at ? String(record.updated_at) : new Date().toISOString(),
      objects: Array.isArray(record && record.objects) ? record.objects.map((obj) => this._normaliseObject(obj)).filter(Boolean) : [],
      connections: Array.isArray(record && record.connections) ? record.connections.map((conn) => this._normaliseConnection(conn)).filter(Boolean) : [],
    };

    if (record && record.closed_loop_save_version != null) {
      state.closed_loop_save_version = Number(record.closed_loop_save_version) || 1;
    }
    if (record && record.template_id != null) {
      state.template_id = Number.isFinite(Number(record.template_id)) ? Number(record.template_id) : record.template_id;
    }
    if (this.templateId != null && state.template_id == null) {
      state.template_id = this.templateId;
    }
    return state;
  }

  _normaliseObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const id = obj.id ? String(obj.id) : this._makeLocalUuid();
    const machineId = Number(obj.machine_id ?? obj.machineId ?? null);
    if (!Number.isFinite(machineId) || machineId <= 0) return null;
    const gridX = Number(obj.grid_x ?? obj.gridX ?? 0);
    const gridY = Number(obj.grid_y ?? obj.gridY ?? 0);
    const rotation = Number(obj.rotation ?? 0);
    return {
      id,
      machine_id: machineId,
      grid_x: Number.isFinite(gridX) ? gridX : 0,
      grid_y: Number.isFinite(gridY) ? gridY : 0,
      rotation: Number.isFinite(rotation) ? (rotation % 360 + 360) % 360 : 0,
      object_config: obj.object_config && typeof obj.object_config === 'object' ? obj.object_config : {},
      name: obj.name ? String(obj.name) : `Machine ${machineId}`,
    };
  }

  _normaliseConnection(connection) {
    if (!connection || typeof connection !== 'object') return null;
    const sourceId = connection.source_object_id ?? connection.sourceObjectId ?? null;
    const targetId = connection.target_object_id ?? connection.targetObjectId ?? null;
    if (!sourceId || !targetId) return null;
    return {
      id: connection.id ? String(connection.id) : this._makeLocalUuid(),
      source_object_id: String(sourceId),
      target_object_id: String(targetId),
      resource_id: connection.resource_id != null ? Number(connection.resource_id) : null,
      transport_class: connection.transport_class ?? connection.transportClass ?? null,
      status: connection.status ?? 'active',
    };
  }

  _makeLocalUuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  _ensureStoreSchema(db) {
    if (!db || typeof db !== 'object') return;

    const hasStore = db.objectStoreNames && typeof db.objectStoreNames.contains === 'function'
      ? db.objectStoreNames.contains(this.storeName)
      : false;

    if (!hasStore && typeof db.createObjectStore === 'function') {
      db.createObjectStore(this.storeName, { keyPath: 'template_id' });
    }
  }

  async _loadFromIndexedDb() {
    if (typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event?.target?.result || request.result;
        this._ensureStoreSchema(db);
      };
      request.onsuccess = (event) => {
        const db = event?.target?.result || request.result;
        try {
          db.close?.();
          const transaction = db.transaction(this.storeName, 'readonly');
          const store = transaction.objectStore(this.storeName);
          const getRequest = store.get(this.templateId);
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          getRequest.onerror = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      };
      request.onerror = () => {
        reject(new Error('IndexedDB failed to open local save store'));
      };
    });
  }

  async _saveToIndexedDb(record) {
    if (typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
      return record;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event?.target?.result || request.result;
        this._ensureStoreSchema(db);
      };
      request.onsuccess = (event) => {
        const db = event?.target?.result || request.result;
        try {
          const transaction = db.transaction(this.storeName, 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const writeRequest = store.put(record);
          writeRequest.onsuccess = () => {
            db.close?.();
            resolve(record);
          };
          writeRequest.onerror = () => {
            db.close?.();
            reject(new Error('IndexedDB failed to persist local save'));
          };
        } catch (error) {
          db.close?.();
          resolve(record);
        }
      };
      request.onerror = () => {
        reject(new Error('IndexedDB failed to open local save store for write'));
      };
    });
  }

  getState() {
    return {
      ...this.state,
      objects: this.state.objects.slice(),
      connections: this.state.connections.slice(),
    };
  }

  getSaveRecord() {
    return {
      ...this.state,
      objects: this.state.objects.map((obj) => ({ ...obj, object_config: { ...(obj.object_config || {}) } })),
      connections: this.state.connections.map((conn) => ({ ...conn })),
    };
  }

  async autosave({ emit = false } = {}) {
    const draft = this.getSaveRecord();
    draft.template_id = this.templateId;
    draft.closed_loop_save_version = 1;
    draft.updated_at = new Date().toISOString();
    this.state.updated_at = draft.updated_at;
    await this._saveToIndexedDb(draft);
    if (emit) {
      this._emitScenarioChanged();
    }
    return draft;
  }

  _emitScenarioChanged() {
    if (!this.eventBus || typeof this.eventBus.emit !== 'function') return;
    this.eventBus.emit('scenario:local:changed', this.getRuntimeScenario());
  }

  getRuntimeScenario(canonicalScenario = null) {
    const base = canonicalScenario || { id: this.templateId, name: this.state.name, scenario_objects: [], scenario_connections: [] };
    const runtime = {
      ...base,
      id: base.id ?? this.templateId,
      template_id: this.templateId,
      local_save: {
        name: this.state.name,
        updated_at: this.state.updated_at,
      },
      scenario_objects: [
        ...(Array.isArray(base.scenario_objects) ? base.scenario_objects : []),
        ...this.state.objects.map((obj) => ({
          id: obj.id,
          local_id: obj.id,
          machine_id: obj.machine_id,
          grid_x: obj.grid_x,
          grid_y: obj.grid_y,
          rotation: obj.rotation,
          object_config: obj.object_config || {},
          object_type: 'machine',
          fixed: true,
          selectable: true,
          source: 'local',
          name: obj.name,
        })),
      ],
      scenario_connections: [
        ...(Array.isArray(base.scenario_connections) ? base.scenario_connections : []),
        ...this.state.connections.map((conn) => ({ ...conn, source_object_id: String(conn.source_object_id), target_object_id: String(conn.target_object_id) })),
      ],
    };
    return runtime;
  }

  addObject({ machine_id, grid_x, grid_y, rotation = 0, object_config = {}, name = null, id = null } = {}) {
    const localId = id || this._makeLocalUuid();
    const object = this._normaliseObject({
      id: localId,
      machine_id,
      grid_x,
      grid_y,
      rotation,
      object_config,
      name: name || `Machine ${machine_id}`,
    });

    if (!object) {
      throw new Error('LocalScenarioStore.addObject requires a valid machine_id and grid position');
    }

    const alreadyExists = this.state.objects.some((entry) => entry.id === object.id);
    if (alreadyExists) {
      return object;
    }

    this.state.objects.push(object);
    this.state.updated_at = new Date().toISOString();
    this._emitScenarioChanged();
    return object;
  }

  updateObject(localId, patch = {}) {
    const index = this.state.objects.findIndex((entry) => entry.id === String(localId));
    if (index === -1) return null;

    const next = this._normaliseObject({ ...this.state.objects[index], ...patch, id: String(localId) });
    if (!next) return null;

    this.state.objects[index] = next;
    this.state.updated_at = new Date().toISOString();
    this._emitScenarioChanged();
    return next;
  }

  removeObject(localId) {
    const id = String(localId);
    const beforeCount = this.state.objects.length;
    this.state.objects = this.state.objects.filter((entry) => entry.id !== id);
    this.state.connections = this.state.connections.filter((connection) => {
      return String(connection.source_object_id) !== id && String(connection.target_object_id) !== id;
    });
    if (beforeCount !== this.state.objects.length) {
      this.state.updated_at = new Date().toISOString();
      this._emitScenarioChanged();
      return true;
    }
    return false;
  }

  addConnection(connection = {}) {
    const normalized = this._normaliseConnection(connection);
    if (!normalized) {
      throw new Error('LocalScenarioStore.addConnection requires source_object_id and target_object_id');
    }

    const duplicate = this.state.connections.some((entry) => {
      return entry.source_object_id === normalized.source_object_id && entry.target_object_id === normalized.target_object_id && (entry.resource_id ?? null) === (normalized.resource_id ?? null);
    });
    if (duplicate) return normalized;

    this.state.connections.push(normalized);
    this.state.updated_at = new Date().toISOString();
    this._emitScenarioChanged();
    return normalized;
  }

  removeConnection(localIdOrPredicate) {
    const before = this.state.connections.length;
    if (typeof localIdOrPredicate === 'function') {
      this.state.connections = this.state.connections.filter((connection) => !localIdOrPredicate(connection));
    } else {
      const target = String(localIdOrPredicate);
      this.state.connections = this.state.connections.filter((connection) => String(connection.id) !== target && String(connection.source_object_id) !== target && String(connection.target_object_id) !== target);
    }
    if (this.state.connections.length !== before) {
      this.state.updated_at = new Date().toISOString();
      this._emitScenarioChanged();
      return true;
    }
    return false;
  }

  removeConnectionsForObject(localId) {
    const id = String(localId);
    const before = this.state.connections.length;
    this.state.connections = this.state.connections.filter((connection) => {
      return String(connection.source_object_id) !== id && String(connection.target_object_id) !== id;
    });
    if (this.state.connections.length !== before) {
      this.state.updated_at = new Date().toISOString();
      this._emitScenarioChanged();
      return true;
    }
    return false;
  }

  async exportDesign() {
    const record = this.getSaveRecord();
    return {
      ...record,
      closed_loop_save_version: 1,
      template_id: this.templateId,
    };
  }

  async importDesign(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('LocalScenarioStore.importDesign requires an object payload');
    }

    const record = this._validateDesign(json);
    this.state = this._normaliseRecord(record);
    this.templateId = this.state.template_id ?? this.templateId;
    this.state.updated_at = new Date().toISOString();
    await this.autosave();
    return this.getSaveRecord();
  }

  _validateDesign(json) {
    const version = Number(json.closed_loop_save_version ?? 1);
    if (!Number.isFinite(version) || version !== 1) {
      throw new Error('Invalid save version: expected closed_loop_save_version 1');
    }

    const templateId = json.template_id ?? this.templateId;
    if (templateId == null || templateId === '') {
      throw new Error('Invalid save: missing template_id');
    }

    const objects = Array.isArray(json.objects) ? json.objects : [];
    const seenIds = new Set();
    const normalisedObjects = [];

    for (const object of objects) {
      const normalized = this._normaliseObject(object);
      if (!normalized) {
        throw new Error('Invalid save: object is missing a valid machine_id or grid position');
      }
      if (seenIds.has(normalized.id)) {
        throw new Error('Invalid save: duplicate local object id detected');
      }
      seenIds.add(normalized.id);
      normalisedObjects.push(normalized);
    }

    const validRotations = new Set([0, 90, 180, 270]);
    for (const object of normalisedObjects) {
      if (!validRotations.has(object.rotation)) {
        throw new Error('Invalid save: object rotation must be 0, 90, 180, or 270');
      }
    }

    return {
      closed_loop_save_version: 1,
      template_id: templateId,
      name: json.name ? String(json.name) : 'Imported Design',
      created_at: json.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      objects: normalisedObjects,
      connections: Array.isArray(json.connections) ? json.connections.map((connection) => this._normaliseConnection(connection)).filter(Boolean) : [],
    };
  }
}
