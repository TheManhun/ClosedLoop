import assert from 'assert';
import TechnologyGraphService from '../resources/js/simulator/services/TechnologyGraphService.js';
import ContextPanelModel from '../resources/js/simulator/services/ContextPanelModel.js';

const machines = [
    { stable_key: 'anaerobic_digester', name: 'Anaerobic Digester', category: 'Processing', resources: [ { direction: 'input', resource: { stable_key: 'farm_waste' } }, { direction: 'output', resource: { stable_key: 'biogas' } }, { direction: 'output', resource: { stable_key: 'digestate' } } ] },
    { stable_key: 'biogas_tank', name: 'Biogas Tank', category: 'Storage', resources: [ { direction: 'input', resource: { stable_key: 'biogas' } } ] },
    { stable_key: 'gas_generator', name: 'Gas Generator', category: 'Energy', resources: [ { direction: 'input', resource: { stable_key: 'biogas' } }, { direction: 'output', resource: { stable_key: 'electricity' } }, { direction: 'output', resource: { stable_key: 'waste_heat' } } ] },
    { stable_key: 'fertiliser_plant', name: 'Fertiliser Plant', category: 'Processing', resources: [ { direction: 'input', resource: { stable_key: 'digestate' } }, { direction: 'output', resource: { stable_key: 'fertiliser' } } ] }
];

const graph = new TechnologyGraphService({ machines });
const model = new ContextPanelModel({ graphService: graph });

// No selection
const empty = model.getPanelData(null);
assert.strictEqual(empty.state, 'empty');

// Resource selected
const r = model.getPanelData({ type: 'resource', stable_key: 'farm_waste' });
assert.strictEqual(r.state, 'resource');
assert.ok(r.machines.find(it => it.machine.stable_key === 'anaerobic_digester'));
assert.ok(r.machines[0].reasons && r.machines[0].reasons.length > 0);

// Machine selected
const m = model.getPanelData({ type: 'machine', stable_key: 'anaerobic_digester' });
assert.strictEqual(m.state, 'machine');
assert.deepStrictEqual(new Set(m.inputs), new Set(['farm_waste']));
assert.deepStrictEqual(new Set(m.outputs), new Set(['biogas','digestate']));
const nextKeys = m.next.map(n => n.machine.stable_key).sort();
assert.deepStrictEqual(nextKeys.sort(), ['biogas_tank','gas_generator','fertiliser_plant'].sort());

// Show All mode
const all = model.getPanelData({ type: 'resource', stable_key: 'farm_waste' }, 'all');
assert.strictEqual(all.state, 'all');
assert.ok(Object.keys(all.groups).length > 0);

// Excluded resources not present as machines
assert.ok(!graph.machines.some(mm => ['farm_waste','electricity','scrap_metal'].includes(mm.stable_key)));

console.log('ContextPanelModel tests passed');
