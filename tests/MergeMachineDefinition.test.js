import BuildingDefinitions from '../resources/js/simulator/data/BuildingDefinitions.js';
import assert from 'assert';

// Test merge policy preserves builtin metadata and overlays API engineering fields
{
    const bd = new BuildingDefinitions();

    const builtin = {
        name: 'Anaerobic Digester',
        image: 'placeholder_digester',
        textureKey: 'digester_tex',
        accepts: ['power', 'conveyor'],
        provides: ['gas'],
        footprint: [3,2]
    };

    const api = {
        id: 3,
        defKey: 'anaerobicDigester',
        stable_key: 'anaerobic_digester',
        name: 'Anaerobic Digester (API)',
        image: 'api_digester.png',
        annual_capacity: 40000,
        default_operating_level: 0.8,
        powerRequired: 120
    };

    const merged = bd._mergeDefs(builtin, api);
    // builtin visual metadata preserved
    assert.strictEqual(merged.textureKey, 'digester_tex');
    assert.strictEqual(merged.image, 'placeholder_digester');
    assert.deepStrictEqual(merged.accepts, ['power','conveyor']);
    assert.deepStrictEqual(merged.provides, ['gas']);
    // api engineering fields present
    assert.strictEqual(merged.annual_capacity, 40000);
    assert.strictEqual(merged.default_operating_level, 0.8);
    assert.strictEqual(merged.stable_key, 'anaerobic_digester');

    // simulate storing canonical under aliases
    const id = String(api.id);
    const canonical = Object.assign({}, merged);
    bd._defs[id] = canonical;
    bd._defs[api.defKey] = canonical;
    bd._defs[api.stable_key] = canonical;
    const camel = api.stable_key.replace(/[_-](.)/g, (s,c)=>c?c.toUpperCase():'');
    bd._defs[camel] = canonical;

    // All aliases must reference the same object
    assert.strictEqual(bd._defs[id], bd._defs[api.defKey]);
    assert.strictEqual(bd._defs[id], bd._defs[api.stable_key]);
    assert.strictEqual(bd._defs[id], bd._defs[camel]);
}

// Test API empty arrays do not wipe builtin accepts/provides
{
    const bd = new BuildingDefinitions();
    const builtin = { accepts: ['power'], provides: ['power'], image: 'x.png' };
    const api = { id: 4, defKey: 'gen', stable_key: 'gas_generator', accepts: [], provides: [] };
    const merged = bd._mergeDefs(builtin, api);
    assert.deepStrictEqual(merged.accepts, ['power']);
    assert.deepStrictEqual(merged.provides, ['power']);
}

// Tests complete
