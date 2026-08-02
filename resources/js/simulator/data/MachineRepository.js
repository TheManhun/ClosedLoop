// MachineRepository: loads machine definitions from JSON for now.
// Later this can be switched to load from MySQL/Supabase without changing callers.
export default class MachineRepository {
    constructor() {
        this._loaded = false;
        this._machines = null;
    }

    async loadAll() {
        if (this._loaded && Array.isArray(this._machines)) return this._machines;
        // Try Supabase-backed API first, then fallback to local JSON, then built-in
        try {
            // Fetch authoritative machine list from API
            const res = await fetch('/api/machines', { credentials: 'same-origin' });
            if (res.ok) {
                const machines = await res.json();
                if (Array.isArray(machines) && machines.length > 0) {
                    console.debug('machine_source: supabase');
                    this._machines = machines;
                    this._loaded = true;
                    return this._machines;
                }
            }
        } catch (e) {
            // ignore and fall back
        }

        try {
            // Relative import of JSON file under resources/data
            const mod = await import('../../../data/machines.json');
            // Vite exposes JSON as the default export
            const machines = mod.default || mod;
            if (Array.isArray(machines) && machines.length > 0) {
                console.debug('machine_source: local_json');
                this._machines = machines;
                this._loaded = true;
                return this._machines;
            }
        } catch (err) {
            // ignore
        }

        // Final fallback: empty list (building definitions will supply built-ins)
        console.debug('machine_source: builtin');
        this._machines = [];
        this._loaded = true;
        return this._machines;
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
