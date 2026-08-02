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

    // Merge API definition into builtin definition without overwriting
    // useful simulator metadata. Rules:
    // - preserve builtin visual/renderer metadata (accepts/provides/footprint/textureKey/image)
    // - overlay authoritative API engineering fields when defined (annual_capacity, default_operating_level, stable_key, power_required, etc.)
    // - do not let null/undefined/empty-array/empty-object from API wipe useful builtin values
    _mergeDefs(builtin, api) {
        const base = Object.assign({}, builtin || {});
        if (!api || typeof api !== 'object') return base;

        const merged = Object.assign({}, base);

        const skipEmpty = (v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

        // Copy API fields only when meaningful
        for (const k of Object.keys(api)) {
            const val = api[k];
            if (skipEmpty(val)) continue;
            // Do not let API arrays/objects replace builtin arrays/objects when builtin has meaningful values
            if ((k === 'accepts' || k === 'provides' || k === 'footprint') && (base[k] && (Array.isArray(base[k]) ? base[k].length > 0 : true))) {
                // keep builtin
                continue;
            }
            // texture/image preference: keep builtin if it has textureKey or image
            if ((k === 'textureKey' || k === 'image') && (base.textureKey || base.image)) continue;
            merged[k] = val;
        }

        return merged;
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
                        // Merge returned API records into _defs using generic policy
                        for (const m of json) {
                            const id = String(m.id);
                            const existing = this._defs[id] || this._defs[m.defKey] || {};
                            // Create a merged canonical object preserving builtin metadata
                            const canonical = this._mergeDefs(existing, m);
                            // Ensure API engineering fields are present when defined
                            if (m.stable_key) canonical.stable_key = m.stable_key;
                            if (m.annual_capacity !== undefined) canonical.annual_capacity = m.annual_capacity;
                            if (m.default_operating_level !== undefined) canonical.default_operating_level = m.default_operating_level;
                            // Store canonical under numeric id and all aliases
                            this._defs[id] = canonical;
                            if (m.defKey) this._defs[m.defKey] = canonical;
                            if (m.stable_key) {
                                this._defs[m.stable_key] = canonical;
                                const camel = String(m.stable_key).replace(/[_-](.)/g, (s, c) => c ? c.toUpperCase() : '');
                                if (camel) this._defs[camel] = canonical;
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
                // Find any existing builtin def to preserve renderer/compatibility metadata
                const baseDef = this._defs[id] || this._defs[m.defKey] || {};
                // Start with a merged canonical object that overlays API engineering fields
                const canonicalBase = this._mergeDefs(baseDef, m);
                const powerValue = Number(m.powerRequired ?? m.powerUsage ?? m.electricityRequired ?? m.powerConsumption ?? canonicalBase.powerRequired ?? canonicalBase.power_required ?? 0);
                const needsPower = Number.isFinite(powerValue) && powerValue > 0;
                const producesPower = Number.isFinite(Number(m.powerProduced ?? m.powerGeneration ?? m.powerGenerated ?? m.electricityProduced ?? canonicalBase.powerProduced ?? canonicalBase.power_produced ?? 0)) && Number(m.powerProduced ?? m.powerGeneration ?? m.powerGenerated ?? m.electricityProduced ?? canonicalBase.powerProduced ?? canonicalBase.power_produced ?? 0) > 0;
                const waterValue = Number(m.waterRequired ?? m.waterDemand ?? m.waterUsage ?? canonicalBase.waterRequired ?? canonicalBase.water_required ?? 0);
                const producesWater = Number.isFinite(Number(m.waterProduced ?? m.waterGenerated ?? canonicalBase.waterProduced ?? canonicalBase.water_produced ?? 0)) && Number(m.waterProduced ?? m.waterGenerated ?? canonicalBase.waterProduced ?? canonicalBase.water_produced ?? 0) > 0;
                const accepts = Array.isArray(canonicalBase.accepts) ? canonicalBase.accepts.slice() : [];
                const provides = Array.isArray(canonicalBase.provides) ? canonicalBase.provides.slice() : [];

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

                const defObj = Object.assign({}, canonicalBase, {
                    name: m.name || canonicalBase.name || ('Machine ' + id),
                    image: m.image || canonicalBase.image || null,
                    textureKey: canonicalBase.textureKey || textureKey,
                    category: m.category || canonicalBase.category || 'process',
                    footprint: canonicalBase.footprint || m.footprint || [2, 2],
                    permanent: (m.permanent !== undefined) ? !!m.permanent : canonicalBase.permanent === true,
                    deletable: (m.deletable !== undefined) ? m.deletable !== false : canonicalBase.deletable !== false,
                    movable: (m.movable !== undefined) ? m.movable !== false : canonicalBase.movable !== false,
                    placeable: (m.placeable !== undefined) ? m.placeable !== false : canonicalBase.placeable !== false,
                    suggestedNext: canonicalBase.suggestedNext || [],
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
                // Store canonical merged object under id and aliases so all keys
                // point to the same object and retain simulator metadata.
                const canonical = defObj;
                this._defs[id] = canonical;
                if (m.defKey) this._defs[m.defKey] = canonical;
                if (m.stable_key) {
                    this._defs[m.stable_key] = canonical;
                    const camel = String(m.stable_key).replace(/[_-](.)/g, (s, c) => c ? c.toUpperCase() : '');
                    if (camel) this._defs[camel] = canonical;
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
