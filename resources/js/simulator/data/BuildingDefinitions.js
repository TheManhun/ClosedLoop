// Plain JS class to manage building definitions and API loading
import MachineRepository from './MachineRepository.js';

export default class BuildingDefinitions {
    constructor() {
        // Default hardcoded definitions (kept small so Laravel can inject JSON later)
        this._defs = {
            municipalWaste: {
                name: 'Municipal Waste',
                image: 'trash',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'MW',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            technologyWaste: {
                name: 'Technology Waste',
                image: 'src_tw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'TW',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            scrapTyres: {
                name: 'Scrap Tyres',
                image: 'src_st',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'ST',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            farmWaste: {
                name: 'Farm Waste',
                image: 'src_fw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'FW',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            industrialWaste: {
                name: 'Industrial Waste',
                image: 'src_iw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'IW',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            buildingWaste: {
                name: 'Building Waste',
                image: 'src_bw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'BW',
                provides: ['conveyor'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            sewerage: {
                name: 'Sewerage',
                image: 'src_sw',
                category: 'source',
                footprint: [4, 4],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'SW',
                provides: ['water', 'wastewater'],
                accepts: [],
                suggestedNext: [ { defKey: 'sortingFacility', name: 'Sorting Facility' } ]
            },
            processUnit: {
                name: 'Process Unit',
                image: 'processingPlant',
                category: 'process',
                footprint: [2, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['power', 'water', 'gas'],
                provides: ['power'],
                suggestedNext: []
            },
            sortingFacility: {
                name: 'Sorting Facility',
                image: 'sorting_facility',
                category: 'process',
                footprint: [3, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['power', 'conveyor'],
                provides: ['conveyor'],
                suggestedNext: []
            },
            distributionBoard: {
                name: 'Distribution Board',
                image: 'Distribution_Board.png',
                textureKey: 'distribution_board',
                category: 'Electrical Infrastructure',
                type: 'power_distribution',
                footprint: [3, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['power', 'water', 'gas'],
                provides: ['power'],
                generatesPower: false,
                consumesPower: false,
                ratedCapacity: 20,
                maxInputConnections: 1,
                maxOutputConnections: 4,
                description: 'Receives electrical power and distributes it to up to four connected machines.',
                suggestedNext: []
            },
            anaerobicDigester: {
                name: 'Anaerobic Digester',
                image: 'placeholder_digester',
                category: 'process',
                footprint: [3, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['power', 'conveyor'],
                provides: ['gas'],
                suggestedNext: []
            },
            biogasTank: {
                name: 'Biogas Tank',
                image: 'biogas_tank',
                category: 'storage',
                footprint: [2, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['gas'],
                provides: ['gas'],
                suggestedNext: []
            },
            gasGenerator: {
                name: 'Gas Generator',
                image: 'gas_generator',
                category: 'energy',
                footprint: [2, 2],
                permanent: false,
                deletable: true,
                movable: true,
                placeable: true,
                accepts: ['gas'],
                provides: ['power'],
                suggestedNext: []
            },
            externalGrid: {
                name: 'External Grid',
                image: 'external_grid',
                category: 'energy',
                type: 'boundary',
                resourceId: 'electricity',
                accepts: [],
                provides: ['power'],
                supportsImport: true,
                supportsExport: true,
                importCapacity: 1000,
                exportCapacity: 1000,
                importCost: 50,
                exportRate: 10,
                footprint: [3, 2],
                permanent: true,
                deletable: false,
                movable: true,
                placeable: false,
                shortCode: 'GRID',
                suggestedNext: []
            }
        };

        this._loaded = false;
        this._machines = [];
        this._repo = new MachineRepository();
    }

    async init() {
        try {
            // Prefer a direct API fetch for authoritative machine records.
            let machines = [];
            try {
                const res = await fetch('/api/machines', { credentials: 'same-origin' });
                if (res && res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json) && json.length > 0) {
                        machines = json;
                        console.debug('machine_source: supabase_direct');
                    }
                }
            } catch (e) {
                // network fetch failed; fall back to repository
            }

            if (!Array.isArray(machines) || machines.length === 0) {
                // Fall back to the repository (local JSON or builtin) if direct fetch yielded nothing
                machines = await this._repo.getAll();
            }

            if (!Array.isArray(machines) || machines.length === 0) {
                this._loaded = true;
                return machines;
            }

            // If the initial set looks sparse or lacks stable_key values, schedule
            // a background refresh to pull authoritative records from the API and
            // merge engineering fields into existing definitions. This avoids
            // blocking initialization while ensuring fields appear shortly after load.
            const looksSparseAfter = !Array.isArray(machines) || machines.length < 3 || !machines.some(m => m && m.stable_key);
            if (looksSparseAfter) {
                setTimeout(async () => {
                    try {
                        const res = await fetch('/api/machines', { credentials: 'same-origin' });
                        if (!res || !res.ok) return;
                        const json = await res.json();
                        if (!Array.isArray(json) || json.length === 0) return;
                        // Merge returned API records into _defs
                        for (const m of json) {
                            const id = String(m.id);
                            const existing = this._defs[id] || this._defs[m.defKey] || {};
                            const merged = Object.assign({}, existing, {
                                name: m.name || existing.name,
                                image: m.image || existing.image,
                                category: m.category || existing.category,
                                footprint: m.footprint || existing.footprint,
                                permanent: (m.permanent !== undefined) ? !!m.permanent : existing.permanent,
                                deletable: (m.deletable !== undefined) ? m.deletable !== false : existing.deletable,
                                movable: (m.movable !== undefined) ? m.movable !== false : existing.movable,
                                placeable: (m.placeable !== undefined) ? m.placeable !== false : existing.placeable
                            });
                            if (m.stable_key) merged.stable_key = m.stable_key;
                            if (m.annual_capacity !== undefined) merged.annual_capacity = m.annual_capacity;
                            if (m.default_operating_level !== undefined) merged.default_operating_level = m.default_operating_level;
                            this._defs[id] = merged;
                            if (m.defKey) this._defs[m.defKey] = Object.assign({}, merged);
                            if (m.stable_key) {
                                this._defs[m.stable_key] = Object.assign({}, merged);
                                const camel = String(m.stable_key).replace(/[_-](.)/g, (s, c) => c ? c.toUpperCase() : '');
                                if (camel) this._defs[camel] = Object.assign({}, merged);
                            }
                        }
                        this._machines = json;
                        console.debug('machine_source: supabase_background_update');
                    } catch (e) {
                        // ignore background failures
                    }
                }, 250);
            }

            // Normalize and merge machine records into definitions (but do not perform any DOM or Phaser operations)
            for (const m of machines) {
                const id = String(m.id);
                const textureKey = m.defKey ? `machine-${m.defKey}` : `machine-${id}`;
                const baseDef = this._defs[id] || this._defs[m.defKey] || {};
                const powerValue = Number(m.powerRequired ?? m.powerUsage ?? m.electricityRequired ?? m.powerConsumption ?? 0);
                const needsPower = Number.isFinite(powerValue) && powerValue > 0;
                const producesPower = Number.isFinite(Number(m.powerProduced ?? m.powerGeneration ?? m.powerGenerated ?? m.electricityProduced ?? 0)) && Number(m.powerProduced ?? m.powerGeneration ?? m.powerGenerated ?? m.electricityProduced ?? 0) > 0;
                const waterValue = Number(m.waterRequired ?? m.waterDemand ?? m.waterUsage ?? 0);
                const producesWater = Number.isFinite(Number(m.waterProduced ?? m.waterGenerated ?? 0)) && Number(m.waterProduced ?? m.waterGenerated ?? 0) > 0;
                const accepts = Array.isArray(baseDef.accepts) ? baseDef.accepts.slice() : [];
                const provides = Array.isArray(baseDef.provides) ? baseDef.provides.slice() : [];

                if (needsPower && !accepts.includes('power')) {
                    accepts.push('power');
                }
                if (producesPower && !provides.includes('power')) {
                    provides.push('power');
                }
                if ((waterValue > 0 || producesWater) && !accepts.includes('water')) {
                    accepts.push('water');
                }
                if (producesWater && !provides.includes('water')) {
                    provides.push('water');
                }

                const defObj = Object.assign({}, baseDef, {
                    name: m.name || ('Machine ' + id),
                    image: m.image || null,
                    textureKey: textureKey,
                    category: m.category || 'process',
                    footprint: m.footprint || [2, 2],
                    permanent: !!m.permanent,
                    deletable: m.deletable !== false,
                    movable: m.movable !== false,
                    placeable: m.placeable !== false,
                    suggestedNext: [],
                    accepts,
                    provides
                });

                // Preserve reference engineering fields from API where available
                if (m.stable_key) defObj.stable_key = m.stable_key;
                if (m.annual_capacity !== undefined) defObj.annual_capacity = m.annual_capacity;
                if (m.default_operating_level !== undefined) defObj.default_operating_level = m.default_operating_level;

                // Preserve explicit capability arrays from the base definition; only add power when needed.
                if (needsPower && !Array.isArray(defObj.accepts)) {
                    defObj.accepts = ['power'];
                } else if (needsPower && !defObj.accepts.includes('power')) {
                    defObj.accepts = Array.from(new Set([...(defObj.accepts || []), 'power']));
                }
                if (!Array.isArray(defObj.provides)) {
                    defObj.provides = [];
                }
                // Store under numeric id and also under defKey if provided, to keep compatibility
                this._defs[id] = defObj;
                if (m.defKey) {
                    this._defs[m.defKey] = Object.assign({}, defObj);
                }

                // Also expose server `stable_key` and a camelCase variant so
                // lookups that use built-in defKeys (e.g. anaerobicDigester)
                // will find the API-provided engineering fields.
                if (m.stable_key) {
                    // raw stable_key (snake_case)
                    this._defs[m.stable_key] = Object.assign({}, defObj);
                    // camelCase variant: anaerobic_digester -> anaerobicDigester
                    const camel = String(m.stable_key).replace(/[_-](.)/g, (s, c) => c ? c.toUpperCase() : '');
                    if (camel) {
                        // Overwrite existing camel entry if it doesn't contain engineering fields
                        const existing = this._defs[camel];
                        if (!existing || !existing.hasOwnProperty('annual_capacity')) {
                            this._defs[camel] = Object.assign({}, defObj);
                        }
                    }
                }
            }

            this._machines = machines;
            this._loaded = true;
            // Ensure camelCase keys point to API-backed defs when available.
            try {
                for (const m of machines) {
                    if (!m || !m.id) continue;
                    const id = String(m.id);
                    const stable = m.stable_key;
                    if (!stable) continue;
                    const camel = String(stable).replace(/[_-](.)/g, (s, c) => c ? c.toUpperCase() : '');
                    const apiDef = this._defs[id];
                    if (apiDef) {
                        // Unconditionally set the stable and camel keys to reference
                        // the API-backed object so runtime lookups (e.g. 'anaerobicDigester')
                        // see the same engineering fields (`annual_capacity`, etc.).
                        this._defs[stable] = apiDef;
                        if (camel) this._defs[camel] = apiDef;
                        // Also ensure any defKey mapping references the same object
                        if (m.defKey) this._defs[m.defKey] = apiDef;
                    }
                }
            } catch (e) { /* non-fatal */ }

            return machines;
        } catch (err) {
            this._loaded = false;
            throw err;
        }
    }

    get(id) {
        if (id === undefined || id === null) return undefined;
        const key = String(id);
        // No special-case shortcuts here; rely on canonical aliases populated during init().
        if (Object.prototype.hasOwnProperty.call(this._defs, key)) {
            // If we have a base def but it's missing engineering fields, try to augment
            // it from loaded API machines so callers receive `annual_capacity` etc.
            const base = this._defs[key];
            const needsAugment = (!base.hasOwnProperty('annual_capacity') || !base.hasOwnProperty('default_operating_level')) && Array.isArray(this._machines) && this._machines.length > 0;
            if (needsAugment) {
                // Try multiple matching strategies: numeric id, defKey, exact stable_key,
                // and camel->snake conversion (e.g. anaerobicDigester -> anaerobic_digester).
                const camelToSnake = (s) => String(s).replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
                const snake = camelToSnake(key);
                const found = this._machines.find(m => String(m.id) === key || m.defKey === key || m.stable_key === key || m.stable_key === snake || (typeof m.stable_key === 'string' && m.stable_key.replace(/[_-](.)/g, (s,c)=>c?c.toUpperCase():'' ) === key));
                if (found) {
                    const merged = Object.assign({}, base);
                    if (found.stable_key) merged.stable_key = found.stable_key;
                    if (found.annual_capacity !== undefined) merged.annual_capacity = found.annual_capacity;
                    if (found.default_operating_level !== undefined) merged.default_operating_level = found.default_operating_level;
                    // persist augmentation so next calls are fast
                    this._defs[key] = merged;
                    return merged;
                }
            }
            return base;
        }

        // Fallback: if machines were loaded from the API or local JSON, attempt
        // to find a matching machine record by stable_key, defKey or numeric id
        if (Array.isArray(this._machines) && this._machines.length > 0) {
            const found = this._machines.find(m => String(m.id) === key || m.defKey === key || m.stable_key === key || (typeof m.stable_key === 'string' && m.stable_key.replace(/[_-](.)/g, (s,c)=>c?c.toUpperCase():'') === key));
            if (found) {
                const def = Object.assign({}, this._defs[key] || {}, {
                    name: found.name || ('Machine ' + found.id),
                    image: found.image || null,
                    stable_key: found.stable_key || undefined,
                    annual_capacity: found.annual_capacity !== undefined ? found.annual_capacity : undefined,
                    default_operating_level: found.default_operating_level !== undefined ? found.default_operating_level : undefined
                });
                return def;
            }
        }

        return undefined;
    }

    getAll() {
        return this._defs;
    }

    has(id) {
        return Object.prototype.hasOwnProperty.call(this._defs, String(id));
    }

    isLoaded() {
        return Boolean(this._loaded);
    }
}
