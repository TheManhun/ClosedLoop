import FlowConnectionResolver from '../resources/js/simulator/services/FlowConnectionResolver.js';
import calculateAnnualFlow from '../resources/js/simulator/services/AnnualFlowCalculator.js';
import assert from 'assert';

// Mock buildingDefinitions with machines array
const mockDefs = {
    _machines: [
        { id: 3, stable_key: 'anaerobic_digester', defKey: 'anaerobicDigester', annual_capacity: 40000, default_operating_level: 0.8 }
    ],
    get: (k) => ({ annual_capacity: 40000, default_operating_level: 0.8 })
};

// Mock buildingManager with placed machines
const sourceRecord = { id: 101, defKey: 'farmWaste' };
const targetRecord = { id: 102, defKey: 'anaerobicDigester' };

// 1. stable-key matching
{
    const resolver = new FlowConnectionResolver(null, mockDefs, { getAll: () => [] });
    assert.strictEqual(resolver.getStableKeyForRecord(sourceRecord), 'farm_waste');
    assert.strictEqual(resolver.getStableKeyForRecord(targetRecord), 'anaerobic_digester');
}

// 2. no connection
{
    const resolver = new FlowConnectionResolver(null, mockDefs, { getAll: () => [] });
    const info = resolver.hasValidConveyorConnection(sourceRecord, targetRecord);
    assert.strictEqual(info.connectionExists, false);
}

// 3. wrong connection type
{
    const conn = { sourceBuildingId: 101, targetBuildingId: 102, type: 'power' };
    const resolver = new FlowConnectionResolver(null, mockDefs, { getAll: () => [conn] });
    const info = resolver.hasValidConveyorConnection(sourceRecord, targetRecord);
    assert.strictEqual(info.connectionExists, false);
    assert.strictEqual(info.connection.type, 'power');
}

// 4. reversed direction
{
    const conn = { sourceBuildingId: 102, targetBuildingId: 101, type: 'conveyor' };
    const resolver = new FlowConnectionResolver(null, mockDefs, { getAll: () => [conn] });
    const info = resolver.hasValidConveyorConnection(sourceRecord, targetRecord);
    assert.strictEqual(info.connectionExists, false);
}

// 5. connected calculation result
{
    const conn = { sourceBuildingId: 101, targetBuildingId: 102, type: 'conveyor' };
    const resolver = new FlowConnectionResolver(null, mockDefs, { getAll: () => [conn] });
    const info = resolver.hasValidConveyorConnection(sourceRecord, targetRecord);
    assert.strictEqual(info.connectionExists, true);

    const resource = { stable_key: 'farm_waste', annual_available: 32000 };
    const machine = { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 };
    const calc = calculateAnnualFlow({ resource, machine, connectedAnnualResourceAvailability: 32000, connectionExists: true });
    assert.strictEqual(calc.annualProcessed, 32000);
    assert.strictEqual(calc.annualUnprocessed, 0);
}

// 6. disconnected result
{
    const resource = { stable_key: 'farm_waste', annual_available: 32000 };
    const machine = { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 };
    const calc = calculateAnnualFlow({ resource, machine, connectedAnnualResourceAvailability: 32000, connectionExists: false });
    assert.strictEqual(calc.annualProcessed, 0);
    assert.strictEqual(calc.annualUnprocessed, 32000);
}

// tests complete
