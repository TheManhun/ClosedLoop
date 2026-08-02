export default class ResourceRepository {
    constructor() {
        this._loaded = false;
        this._resources = null;
    }

    async loadAll() {
        if (this._loaded && Array.isArray(this._resources)) return this._resources;
        try {
            const res = await fetch('/api/resources', { credentials: 'same-origin' });
            if (res.ok) {
                const resources = await res.json();
                if (Array.isArray(resources) && resources.length > 0) {
                    console.info('resource_source: supabase');
                    this._resources = resources;
                    this._loaded = true;
                    return this._resources;
                }
            }
        } catch (e) {
            // ignore
        }

        // Fallback: empty array (built-ins handled by BuildingDefinitions)
        console.info('resource_source: fallback_empty');
        this._resources = [];
        this._loaded = true;
        return this._resources;
    }

    async getAll() {
        return this.loadAll();
    }
}
