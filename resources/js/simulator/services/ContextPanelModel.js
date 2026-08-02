// ContextPanelModel.js
// Pure logic for the Context-aware build panel. Depends on TechnologyGraphService.
export default class ContextPanelModel {
    constructor({ graphService, options = {} } = {}) {
        if (!graphService) throw new Error('graphService required');
        this.graph = graphService;
        // resources to exclude from buildable catalogue (stable_keys)
        this.excludedResources = new Set(options.excludedResources || ['farm_waste','food_waste','scrap_metal','electricity']);
    }

    // selection: null | { type: 'resource', stable_key } | { type: 'machine', stable_key }
    // mode: 'suggested' | 'all'
    getPanelData(selection = null, mode = 'suggested') {
        if (!selection) {
            return {
                state: 'empty',
                message: 'Select a resource or machine to begin.',
                recent: [],
                favourites: [],
                mode
            };
        }

        if (mode === 'all') {
            // Return all machines grouped by category
            const all = this.graph.machines || [];
            const groups = {};
            for (const m of all) {
                if (!m) continue;
                const key = m.category || 'Uncategorised';
                if (!groups[key]) groups[key] = [];
                // Exclude raw resources accidentally represented as machines
                if (m.stable_key && this.excludedResources.has(m.stable_key)) continue;
                // Avoid duplicates by stable_key
                if (!groups[key].find(x => x.stable_key === m.stable_key)) groups[key].push(m);
            }
            return { state: 'all', groups, mode };
        }

        // Suggested mode
        if (selection.type === 'resource') {
            const resKey = selection.stable_key;
            const machines = this.graph.getMachinesAcceptingResource(resKey) || [];
            const unique = [];
            const seen = new Set();
            for (const m of machines) {
                if (!m || !m.stable_key) continue;
                if (seen.has(m.stable_key)) continue;
                seen.add(m.stable_key);
                const reasons = this.graph.getConnectionReasons(resKey, m.stable_key) || [];
                unique.push({ machine: m, reasons });
            }
            return { state: 'resource', resource: resKey, machines: unique, mode };
        }

        if (selection.type === 'machine') {
            const key = selection.stable_key;
            const inputs = this.graph.getInputsForMachine(key) || [];
            const outputs = this.graph.getOutputsForMachine(key) || [];
            const next = this.graph.getNextMachines(key) || [];
            // attach reasons for next
            const nextWithReasons = next.map(m => ({ machine: m, reasons: this.graph.getConnectionReasons(key, m.stable_key) }));
            return { state: 'machine', machine: key, inputs, outputs, next: nextWithReasons, mode };
        }

        return { state: 'unknown' };
    }
}
