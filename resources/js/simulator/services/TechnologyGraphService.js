// TechnologyGraphService.js
// Pure graph/index helper for machines and resources
export default class TechnologyGraphService {
    constructor({ machines = [], resources = [] } = {}) {
        // machines: array of machine records (prefer stable_key + resources[])
        // resources: array of resource records (stable_key, name...)
        this.machines = Array.isArray(machines) ? machines : [];
        this.resources = Array.isArray(resources) ? resources : [];
        // Build quick lookup maps
        this._machinesByStable = new Map();
        for (const m of this.machines) {
            if (m && m.stable_key) this._machinesByStable.set(m.stable_key, m);
            if (m && m.defKey && !this._machinesByStable.has(m.defKey)) this._machinesByStable.set(m.defKey, m);
        }
    }

    _ensureResourceObj(entry) {
        // entry may be { resource: { stable_key } } or { resourceId } or { stable_key }
        if (!entry) return null;
        if (entry.resource && entry.resource.stable_key) return entry.resource;
        if (entry.resource && entry.resourceId && entry.resource.stable_key) return entry.resource;
        if (entry.stable_key) return entry;
        if (entry.resourceId) return { stable_key: entry.resourceId };
        return null;
    }

    getMachinesAcceptingResource(resourceStableKey) {
        if (!resourceStableKey) return [];
        const out = [];
        for (const m of this.machines) {
            if (!m || !Array.isArray(m.resources)) continue;
            const accepts = m.resources.find(r => (r.direction === 'input' || r.direction === 'in') && (() => {
                const res = this._ensureResourceObj(r.resource || r);
                return res && res.stable_key === resourceStableKey;
            })());
            if (accepts) out.push(m);
        }
        return out;
    }

    getInputsForMachine(machineStableKey) {
        const m = this._machinesByStable.get(machineStableKey) || this.machines.find(x => x.stable_key === machineStableKey || x.defKey === machineStableKey);
        if (!m || !Array.isArray(m.resources)) return [];
        return m.resources
            .filter(r => r.direction === 'input' || r.direction === 'in')
            .map(r => this._ensureResourceObj(r.resource || r))
            .filter(Boolean)
            .map(r => r.stable_key);
    }

    getOutputsForMachine(machineStableKey) {
        const m = this._machinesByStable.get(machineStableKey) || this.machines.find(x => x.stable_key === machineStableKey || x.defKey === machineStableKey);
        if (!m || !Array.isArray(m.resources)) return [];
        return m.resources
            .filter(r => r.direction === 'output' || r.direction === 'out')
            .map(r => this._ensureResourceObj(r.resource || r))
            .filter(Boolean)
            .map(r => r.stable_key);
    }

    getNextMachines(machineStableKey) {
        const outputs = this.getOutputsForMachine(machineStableKey);
        const next = new Map();
        for (const outRes of outputs) {
            const targets = this.getMachinesAcceptingResource(outRes);
            for (const t of targets) {
                if (!t || !t.stable_key) continue;
                if (t.stable_key === machineStableKey) continue;
                next.set(t.stable_key, t);
            }
        }
        return Array.from(next.values());
    }

    // Returns array of reasons objects describing why source -> target is connected
    // sourceStableKey may be a resource stable_key or a machine stable_key
    getConnectionReasons(sourceStableKey, targetMachineStableKey) {
        const reasons = [];
        if (!sourceStableKey || !targetMachineStableKey) return reasons;

        // if source is a resource
        // target accepts resource
        const inputs = this.getInputsForMachine(targetMachineStableKey);
        if (inputs.includes(sourceStableKey)) {
            reasons.push({ relation: 'accepts', resource: sourceStableKey });
        }

        // if source is a machine, check if it produces resources the target accepts
        const sourceMachine = this._machinesByStable.get(sourceStableKey) || this.machines.find(x => x.stable_key === sourceStableKey || x.defKey === sourceStableKey);
        if (sourceMachine) {
            const produced = this.getOutputsForMachine(sourceStableKey);
            for (const p of produced) {
                if (inputs.includes(p)) {
                    reasons.push({ relation: 'produced_by', resource: p, producer: sourceStableKey });
                }
            }
        }

        return reasons;
    }
}
