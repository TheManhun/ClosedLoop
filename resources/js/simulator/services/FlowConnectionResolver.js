// FlowConnectionResolver: helper to resolve stable keys and check valid conveyor connections
export default class FlowConnectionResolver {
    constructor(buildingManager, buildingDefinitions, connectionManager) {
        this.buildingManager = buildingManager;
        this.buildingDefinitions = buildingDefinitions;
        this.connectionManager = connectionManager;
    }

    // Try to determine a stable_key for a placed record
    getStableKeyForRecord(record) {
        if (!record) return null;
        // If record has an explicit stable_key (future-proof)
        if (record.stable_key) return record.stable_key;

        // Look up in building definitions by defKey
        const defKey = record.defKey;
        if (defKey !== undefined && defKey !== null) {
            // If defKey matches a loaded def that includes a stable_key, prefer it
            const def = this.buildingDefinitions && this.buildingDefinitions.get ? this.buildingDefinitions.get(defKey) : null;
            if (def && def.stable_key) return def.stable_key;

            // If buildingDefinitions has a machines array, try to find a machine by defKey or id
            const machines = this.buildingDefinitions && this.buildingDefinitions._machines ? this.buildingDefinitions._machines : null;
            if (Array.isArray(machines)) {
                const byDef = machines.find((m) => (m.defKey && String(m.defKey) === String(defKey)) || String(m.id) === String(defKey));
                if (byDef && byDef.stable_key) return byDef.stable_key;
            }

            // Fallback: normalize camelCase defKey to snake_case (farmWaste -> farm_waste)
            if (typeof defKey === 'string') {
                const snake = defKey.replace(/([A-Z])/g, '_$1').replace(/[-\s]+/g, '_').toLowerCase();
                return snake;
            }
        }

        return null;
    }

    // Check whether a valid conveyor connection exists from sourceRecord to targetRecord
    hasValidConveyorConnection(sourceRecord, targetRecord) {
        if (!this.connectionManager || !sourceRecord || !targetRecord) return { connectionExists: false, connection: null };
        const conns = this.connectionManager.getAll();
        for (const c of conns) {
            if (!c) continue;
            // exact direction: source -> target
            if ((c.sourceBuildingId === sourceRecord.id || c.fromMachineId === sourceRecord.id) && (c.targetBuildingId === targetRecord.id || c.toMachineId === targetRecord.id)) {
                if (String(c.type || '').toLowerCase() === 'conveyor') return { connectionExists: true, connection: c };
                return { connectionExists: false, connection: c };
            }
        }
        return { connectionExists: false, connection: null };
    }

    // High-level resolver combining stable keys and connection check
    resolve(sourceRecord, targetRecord) {
        const resourceKey = this.getStableKeyForRecord(sourceRecord);
        const machineKey = this.getStableKeyForRecord(targetRecord);
        const conn = this.hasValidConveyorConnection(sourceRecord, targetRecord);
        return {
            resourceKey,
            machineKey,
            connectionExists: !!conn.connectionExists,
            connection: conn.connection
        };
    }
}
