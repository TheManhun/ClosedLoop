import assert from 'assert';
import TechnologyGraphService from '../resources/js/simulator/services/TechnologyGraphService.js';

// Minimal machine/resource fixtures matching Golden Demo
const machines = [
    {
        stable_key: 'anaerobic_digester',
        resources: [
            { direction: 'input', resource: { stable_key: 'farm_waste' } },
            { direction: 'output', resource: { stable_key: 'biogas' } },
            { direction: 'output', resource: { stable_key: 'digestate' } }
        ]
    },
    {
        stable_key: 'biogas_tank',
        resources: [
            { direction: 'input', resource: { stable_key: 'biogas' } },
            { direction: 'output', resource: { stable_key: 'biogas' } }
        ]
    },
    {
        stable_key: 'gas_generator',
        resources: [
            { direction: 'input', resource: { stable_key: 'biogas' } },
            { direction: 'output', resource: { stable_key: 'electricity' } },
            { direction: 'output', resource: { stable_key: 'waste_heat' } }
        ]
    },
    {
        stable_key: 'fertiliser_plant',
        resources: [
            { direction: 'input', resource: { stable_key: 'digestate' } },
            { direction: 'output', resource: { stable_key: 'fertiliser' } }
        ]
    }
];

const svc = new TechnologyGraphService({ machines });

assert.strictEqual(typeof svc.getMachinesAcceptingResource, 'function');

// resource -> compatible machines
const accepting = svc.getMachinesAcceptingResource('farm_waste');
assert.ok(Array.isArray(accepting), 'accepting should be array');
assert.ok(accepting.find(m => m.stable_key === 'anaerobic_digester'), 'Anaerobic Digester should accept farm_waste');

// machine -> outputs
const outputs = svc.getOutputsForMachine('anaerobic_digester');
assert.deepStrictEqual(new Set(outputs), new Set(['biogas','digestate']));

// machine -> next machines (from anaerobic_digester)
const next = svc.getNextMachines('anaerobic_digester').map(m => m.stable_key).sort();
assert.deepStrictEqual(next.sort(), ['biogas_tank','gas_generator','fertiliser_plant'].sort(), 'Next machines should include biogas tank, gas generator and fertiliser plant');

// multiple outputs preserved
assert.ok(outputs.includes('biogas') && outputs.includes('digestate'));

// duplicate suggestions removed: make sure getNextMachines returns unique keys
const dupTestSvc = new TechnologyGraphService({ machines: machines.concat([machines[2]]) });
const dupNext = dupTestSvc.getNextMachines('anaerobic_digester').map(m => m.stable_key);
const uniq = Array.from(new Set(dupNext));
assert.strictEqual(uniq.length, dupNext.length, 'duplicates should be removed');

// no suggestion when relationship missing
const none = svc.getMachinesAcceptingResource('nonexistent_resource');
assert.strictEqual(none.length, 0);

// stable_key matching
assert.deepStrictEqual(svc.getInputsForMachine('fertiliser_plant'), ['digestate']);

// connection reasons: machine -> target
const reasons = svc.getConnectionReasons('anaerobic_digester', 'gas_generator');
assert.ok(reasons.some(r => r.relation === 'produced_by' && r.resource === 'biogas'));

console.log('TechnologyGraphService tests passed');
