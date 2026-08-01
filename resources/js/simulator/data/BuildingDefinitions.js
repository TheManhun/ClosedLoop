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
            const machines = await this._repo.getAll();
            if (!Array.isArray(machines) || machines.length === 0) {
                this._loaded = true;
                return machines;
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
            }

            this._machines = machines;
            this._loaded = true;
            return machines;
        } catch (err) {
            this._loaded = false;
            throw err;
        }
    }

    get(id) {
        if (id === undefined || id === null) return undefined;
        return this._defs[String(id)];
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
