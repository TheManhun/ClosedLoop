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
                suggestedNext: []
            },
            externalGrid: {
                name: 'External Grid',
                image: 'external_grid',
                category: 'infrastructure',
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
                const defObj = Object.assign({
                    name: m.name || ('Machine ' + id),
                    image: m.image || null,
                    category: 'process',
                    footprint: m.footprint || [2, 2],
                    permanent: !!m.permanent,
                    deletable: m.deletable !== false,
                    movable: m.movable !== false,
                    placeable: m.placeable !== false,
                    suggestedNext: []
                }, this._defs[id] || {});
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
