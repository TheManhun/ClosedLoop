import calculateAnnualFlow from '../resources/js/simulator/services/AnnualFlowCalculator.js';
import assert from 'assert';

// 1. No valid connection
{
    const res = calculateAnnualFlow({ resource: { stable_key: 'farm_waste', annual_available: 32000 }, machine: { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 }, connectedAnnualResourceAvailability: 32000, connectionExists: false });
    assert.strictEqual(res.annualProcessed, 0);
    assert.strictEqual(res.annualUnprocessed, 32000);
    assert.strictEqual(Math.round(res.unresolvedPercent), 100);
}

// 2. Valid connection: available 32000, capacity 40000, operatingLevel 0.8
{
    const res = calculateAnnualFlow({ resource: { stable_key: 'farm_waste', annual_available: 32000 }, machine: { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 }, connectedAnnualResourceAvailability: 32000, connectionExists: true });
    assert.strictEqual(res.effectiveAnnualCapacity, 40000 * 0.8);
    assert.strictEqual(res.annualProcessed, 32000);
    assert.strictEqual(res.annualUnprocessed, 0);
    assert.strictEqual(Math.round(res.unresolvedPercent), 0);
    assert.strictEqual(Math.round(res.machineUtilisationPercent), 80);
}

// 3. Resource exceeds capacity
{
    const res = calculateAnnualFlow({ resource: { stable_key: 'farm_waste', annual_available: 50000 }, machine: { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 }, connectedAnnualResourceAvailability: 50000, connectionExists: true });
    assert.strictEqual(res.effectiveAnnualCapacity, 40000 * 0.8);
    assert.strictEqual(res.annualProcessed, 40000 * 0.8);
    assert.strictEqual(res.annualUnprocessed, 50000 - (40000 * 0.8));
    assert.strictEqual(Math.round(res.unresolvedPercent), Math.round(((50000 - (40000 * 0.8)) / 50000) * 100));
    assert.strictEqual(Math.round(res.machineUtilisationPercent), 80);
}

// 4. Resource below capacity
{
    const res = calculateAnnualFlow({ resource: { stable_key: 'farm_waste', annual_available: 20000 }, machine: { stable_key: 'anaerobic_digester', annual_capacity: 40000, default_operating_level: 0.8 }, connectedAnnualResourceAvailability: 20000, connectionExists: true });
    assert.strictEqual(res.annualProcessed, 20000);
    assert.strictEqual(res.annualUnprocessed, 0);
    assert.strictEqual(Math.round(res.machineUtilisationPercent), 50);
}

// 5. Invalid or missing numeric values
{
    const res = calculateAnnualFlow({ resource: { stable_key: 'farm_waste', annual_available: 'notanumber' }, machine: { stable_key: 'anaerobic_digester', annual_capacity: null, default_operating_level: null }, connectedAnnualResourceAvailability: null, connectionExists: true });
    // Must not be NaN or Infinity
    assert.strictEqual(Number.isFinite(res.annualProcessed), true);
    assert.strictEqual(Number.isFinite(res.annualUnprocessed), true);
    assert.strictEqual(Number.isFinite(res.unresolvedPercent), true);
}

// tests complete
