// MachineRepository: loads machine definitions from JSON for now.
// Later this can be switched to load from MySQL/Supabase without changing callers.
export default class MachineRepository {
    constructor() {
        this._loaded = false;
        this._machines = null;
    }

    async loadAll() {
        if (this._loaded && Array.isArray(this._machines)) return this._machines;
        try {
            // Relative import of JSON file under resources/data
            const mod = await import('../../../data/machines.json');
            // Vite exposes JSON as the default export
            const machines = mod.default || mod;
            if (!Array.isArray(machines)) throw new Error('machines.json must export an array');
            this._machines = machines;
            this._loaded = true;
            return this._machines;
        } catch (err) {
            this._machines = [];
            this._loaded = false;
            throw err;
        }
    }

    async getAll() {
        return this.loadAll();
    }

    isLoaded() { return this._loaded; }

    // Return a URL path to use as an icon for the machine. Prefer `icon` but fall back to `image`.
    iconPath(machine) {
        if (!machine) return null;
        const name = machine.icon || machine.image || null;
        return name ? ('/' + name) : null;
    }
}
