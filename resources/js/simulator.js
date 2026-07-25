import Phaser from 'phaser';
import { EventBus } from './simulator/core/EventBus.js';
import { GridSystem } from './simulator/core/GridSystem.js';
import { CameraController } from './simulator/core/CameraController.js';
import BuildingDefinitions from './simulator/data/BuildingDefinitions.js';
import MachineRepository from './simulator/data/MachineRepository.js';
import BuildingManager from './simulator/managers/BuildingManager.js';
import InputHandler from './simulator/core/InputHandler.js';
import MachineInfoPanel from './simulator/ui/MachineInfoPanel.js';
import ContextMenu from './simulator/ui/ContextMenu.js';
import ConnectionDefinitions from './simulator/data/ConnectionDefinitions.js';
import ConnectionManager from './simulator/managers/ConnectionManager.js';
import ConnectionController from './simulator/controllers/ConnectionController.js';

class PrototypeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PrototypeScene' });
    }

    preload() {
        // Load building and resource images from public/
        this.load.image('processingPlant', '/processingplant.png');
        this.load.image('trash', '/trash.png');
        this.load.image('sorting_facility', '/sorting.png');
        this.load.image('wastewater_headworks', '/waterwasteplant.png');
        // Specific sewerage plant and raw sewerage resource images
        this.load.image('sewerage_plant', '/sewerage.png');
        // Resource images provided by user
        this.load.image('src_mw', '/trash.png');
        this.load.image('src_tw', '/e-waste.png');
        // Scrap tyres placeholder — use corrected filename
        this.load.image('src_st', '/scraptyres.png');
        this.load.image('src_fw', '/farmwaste.png');
        this.load.image('src_iw', '/industrial_waste.png');
        this.load.image('src_bw', '/building_waste.png');
        this.load.image('src_sw', '/sewerage_waste.png');
        // External grid / substation
        this.load.image('external_grid', '/electricsubstation.png');
    }

    create() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, height / 2, 'Closed Loop Prototype', {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
        // Expose scene for debug hooks (used by chart/UI rendering)
        try { window.__simulatorScene = this; } catch (e) {}

        const cam = this.cameras.main;

        // Start camera centered on the scene
        cam.centerOn(width / 2, height / 2);

        // Do NOT reposition world objects on resize — camera will resize the viewport only.
        // Leave titleText at its initial world position.

        // CameraController encapsulates camera pan/zoom/reset behavior
        this._cameraController = new CameraController(this, { minZoom: 0.5, maxZoom: 2.0, zoomSensitivity: 0.0015 });
        // Keep compatibility reference used throughout the scene
        this._cameraControls = this._cameraController.controls;

        // Grid responsibilities moved to GridSystem (incremental refactor)
        this._eventBus = new EventBus();
        this._gridSystem = new GridSystem(this, this._eventBus);
        // Keep compatibility reference used throughout the scene
        this._gridConfig = this._gridSystem.config;
        // Graphics for hover and selection (reused objects)
        this._hoverGraphics = this.add.graphics({ x: 0, y: 0 });
        this._selectionGraphics = this.add.graphics({ x: 0, y: 0 });
        // Graphics for dragging preview
        this._dragGraphics = this.add.graphics({ x: 0, y: 0 });
        // Drag state separate from placement
        this._dragState = {
            active: false,       // pointer is down on a building and drag may start
            isDragging: false,    // true once threshold passed and moving
            startScreen: { x: 0, y: 0 },
            offsetWorld: { x: 0, y: 0 }, // pointer->container offset in world coords
            record: null,
            origGrid: { x: 0, y: 0 },
            threshold: 5 // pixels
        };
        this._hoverCell = null; // { ix, iy }
        this._selectedCell = null; // { ix, iy }
        // Building state managed by BuildingManager
        // BuildingManager owns building state; do not expose its internals here.
        // Building definitions handled by BuildingDefinitions (keeps defaults and loads API machines)
        this._buildingDefinitions = new BuildingDefinitions();
        // Expose a compatibility object used by the rest of the scene
        this._buildingDefs = this._buildingDefinitions.getAll();

        // Also attempt to populate the Toolbox immediately from the local JSON repository
        (async () => {
            try {
                // avoid double-population
                if (document.getElementById('toolbox-categories')) return;
            const repo = new MachineRepository();
            const machines = await repo.getAll();
            // expose simple icon helper used by UI code
            try { fetchScene._machineRepoIconPath = (m) => repo.iconPath(m); } catch (e) {}
                if (!Array.isArray(machines) || machines.length === 0) return;
                const toolbox = document.getElementById('toolbox');
                const toolboxBody = document.getElementById('toolbox-body');
                if (!toolbox || !toolboxBody) return;
                const search = document.createElement('input');
                search.type = 'search'; search.placeholder = 'Search machines...'; search.id = 'toolbox-search'; search.style.width = '100%'; search.style.boxSizing = 'border-box'; search.style.padding = '8px'; search.style.marginBottom = '8px';
                const container = document.createElement('div'); container.id = 'toolbox-categories';
                toolboxBody.innerHTML = ''; toolboxBody.appendChild(search); toolboxBody.appendChild(container);
                // Selection and tooltip helpers for toolbox UI
                let _selectedToolboxCard = null;
                const clearSelectedToolboxCard = () => {
                    if (_selectedToolboxCard) {
                        _selectedToolboxCard.classList.remove('selected');
                        _selectedToolboxCard = null;
                    }
                };
                const setSelectedToolboxCard = (card) => {
                    clearSelectedToolboxCard();
                    if (card) { card.classList.add('selected'); _selectedToolboxCard = card; }
                };
                // Tooltip element (singleton)
                let _toolboxTooltip = document.getElementById('toolbox-tooltip');
                if (!_toolboxTooltip) {
                    _toolboxTooltip = document.createElement('div'); _toolboxTooltip.id = 'toolbox-tooltip'; _toolboxTooltip.className = 'toolbox-tooltip'; _toolboxTooltip.style.display = 'none'; document.body.appendChild(_toolboxTooltip);
                }
                // group
                const groups = {};
                machines.forEach(m => { const cat = (m.category||'other').toString(); groups[cat]=groups[cat]||[]; groups[cat].push(m); });
                const categoryDisplay = (c)=>{ const map={
                    agriculture: '🌿 Agriculture',
                    process: '⚙ Processing',
                    infrastructure: '⚡ Energy',
                    manufacturing: '🏭 Manufacturing',
                    recycling: '♻ Recycling',
                    water: '💧 Water',
                    storage: '📦 Storage',
                    research: '🧪 Research',
                    source: '📦 Sources',
                    transport: '🚚 Transport',
                    other: '• Other'
                }; return map[c] || (c? (c.charAt(0).toUpperCase()+c.slice(1)) : 'Other'); };
                Object.keys(groups).sort().forEach(cat=>{
                    const section=document.createElement('div'); section.className='toolbox-category';
                    const header=document.createElement('div'); header.className='toolbox-category-header'; header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center'; header.style.padding='6px 4px'; header.style.cursor='pointer';
                    const title=document.createElement('div');
                    const titleName = document.createElement('span'); titleName.className = 'toolbox-category-title'; titleName.textContent = categoryDisplay(cat);
                    const titleCount = document.createElement('span'); titleCount.className = 'toolbox-category-count'; titleCount.textContent = ' ('+groups[cat].length+')';
                    title.appendChild(titleName); title.appendChild(titleCount);
                    title.style.fontWeight='700'; title.style.fontSize='13px';
                    const collapseBtn=document.createElement('button'); collapseBtn.textContent='▾'; collapseBtn.setAttribute('aria-expanded','true'); collapseBtn.style.background='transparent'; collapseBtn.style.border='0'; collapseBtn.style.color='#9ca3af'; collapseBtn.style.cursor='pointer'; collapseBtn.className='toolbox-collapse-btn';
                    header.appendChild(title); header.appendChild(collapseBtn);
                    const list=document.createElement('div'); list.className='toolbox-category-list'; list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px'; list.style.padding='6px 4px 12px 4px';
                    groups[cat].forEach(m=>{
                        const card=document.createElement('div'); card.className='toolbox-card'; card.style.display='flex'; card.style.alignItems='center'; card.style.gap='12px'; card.style.padding='10px'; card.style.borderRadius='8px'; card.style.cursor='pointer'; card.style.wordBreak='break-word'; card.setAttribute('data-defkey', m.defKey||String(m.id));
                        // icon wrapper
                        const iconWrap = document.createElement('div'); iconWrap.className = 'toolbox-card-icon';
                        const img=document.createElement('img'); img.src = (typeof fetchScene._machineRepoIconPath === 'function') ? (fetchScene._machineRepoIconPath(m) || (m.image ? ('/'+m.image) : '/processingplant.png')) : (m.icon ? ('/'+m.icon) : (m.image ? ('/'+m.image) : '/processingplant.png'));
                        img.alt = m.name || '';
                        img.style.width='56px'; img.style.height='56px'; img.style.objectFit='contain'; img.style.flex='0 0 56px';
                        iconWrap.appendChild(img);

                        const text=document.createElement('div'); text.style.flex='1'; text.style.minWidth='0';
                        const nm = document.createElement('div'); nm.className='toolbox-card-name'; nm.textContent = m.name || (m.defKey || m.id);
                        const catline=document.createElement('div'); catline.textContent = categoryDisplay(m.category||''); catline.className = 'toolbox-card-category';
                        text.appendChild(nm); text.appendChild(catline);

                        card.appendChild(iconWrap); card.appendChild(text);

                        // Tooltip handlers (use MachineRepository data already loaded)
                        card.addEventListener('mouseenter', (ev) => {
                            try {
                                const repo = new MachineRepository();
                                // build tooltip content from machine record `m`
                                const lines = [];
                                if (m.name) lines.push(`<div class="title">${m.name}</div>`);
                                if (m.description) lines.push(`<div class="meta">${m.description}</div>`);
                                const parts = [];
                                if (Array.isArray(m.inputs) && m.inputs.length) parts.push(`<div class="line"><strong>Inputs:</strong> ${m.inputs.map(i=> (i.quantity||i.amount||'') + (i.units?(' '+i.units):'') + ' ' + (i.resourceId||i.name||'')).join(', ')}</div>`);
                                if (Array.isArray(m.outputs) && m.outputs.length) parts.push(`<div class="line"><strong>Outputs:</strong> ${m.outputs.map(o=> (o.quantity||o.amount||'') + (o.units?(' '+o.units):'') + ' ' + (o.resourceId||o.name||'')).join(', ')}</div>`);
                                if (m.powerRequired !== undefined) parts.push(`<div class="line"><strong>Power Req:</strong> ${m.powerRequired}</div>`);
                                if (m.powerProduced !== undefined) parts.push(`<div class="line"><strong>Power Prod:</strong> ${m.powerProduced}</div>`);
                                const html = lines.concat(parts).join('');
                                _toolboxTooltip.innerHTML = html;
                                _toolboxTooltip.style.display = 'block';
                                const rect = card.getBoundingClientRect();
                                const left = Math.min(window.innerWidth - 340, rect.right + 8);
                                const top = Math.max(8, rect.top + (rect.height/2) - 40);
                                _toolboxTooltip.style.left = (left) + 'px';
                                _toolboxTooltip.style.top = (top) + 'px';
                            } catch (e) { /* ignore */ }
                        });
                        card.addEventListener('mouseleave', ()=>{ try {_toolboxTooltip.style.display='none'; } catch(e){} });

                        // Click: begin placement and mark selected
                        card.addEventListener('click', ev=>{ ev.preventDefault(); const controller = fetchScene._placementController; const key = m.defKey||String(m.id);
                            // Cancel any connection mode
                            try { if (fetchScene._connectionController && fetchScene._connectionController.isConnecting()) fetchScene._connectionController.cancelConnection(); } catch(e) {}
                            if (controller && typeof controller.beginPlacement === 'function') { try { controller.beginPlacement(key); } catch(e){} }
                            // update selected class
                            setSelectedToolboxCard(card);
                            // watch controller state to clear selection when placement ends
                            try {
                                const watcher = setInterval(()=>{
                                    try {
                                        if (!controller || typeof controller.isPlacing !== 'function' || !controller.isPlacing()) {
                                            clearSelectedToolboxCard(); clearInterval(watcher);
                                        }
                                    } catch(e){ clearSelectedToolboxCard(); clearInterval(watcher); }
                                }, 200);
                            } catch(e){}
                        });

                        list.appendChild(card);
                    });
                    header.addEventListener('click', ()=>{ const expanded = list.style.display !== 'none'; list.style.display = expanded ? 'none' : 'flex'; collapseBtn.textContent = expanded ? '▸' : '▾'; collapseBtn.setAttribute('aria-expanded', String(!expanded)); });
                    section.appendChild(header); section.appendChild(list); container.appendChild(section);
                });
                // Add Connections category
                try {
                    const connDefs = ConnectionDefinitions;
                    const connSection = document.createElement('div'); connSection.className = 'toolbox-category';
                    const connHeader = document.createElement('div'); connHeader.className = 'toolbox-category-header'; connHeader.style.display='flex'; connHeader.style.justifyContent='space-between'; connHeader.style.alignItems='center'; connHeader.style.padding='6px 4px'; connHeader.style.cursor='pointer';
                    const connTitle = document.createElement('div'); const connTitleName = document.createElement('span'); connTitleName.className='toolbox-category-title'; connTitleName.textContent='Connections'; const connTitleCount = document.createElement('span'); connTitleCount.className='toolbox-category-count'; connTitleCount.textContent=' (4)'; connTitle.appendChild(connTitleName); connTitle.appendChild(connTitleCount); connTitle.style.fontWeight='700'; connTitle.style.fontSize='13px';
                    const connCollapse = document.createElement('button'); connCollapse.textContent='▾'; connCollapse.setAttribute('aria-expanded','true'); connCollapse.style.background='transparent'; connCollapse.style.border='0'; connCollapse.style.color='#9ca3af'; connCollapse.style.cursor='pointer'; connCollapse.className='toolbox-collapse-btn';
                    connHeader.appendChild(connTitle); connHeader.appendChild(connCollapse);
                    const connList = document.createElement('div'); connList.className='toolbox-category-list'; connList.style.display='flex'; connList.style.flexDirection='column'; connList.style.gap='8px'; connList.style.padding='6px 4px 12px 4px';
                    Object.keys(connDefs).forEach(k=>{
                        const d = connDefs[k];
                        const ccard = document.createElement('div'); ccard.className='toolbox-card'; ccard.style.display='flex'; ccard.style.alignItems='center'; ccard.style.gap='12px'; ccard.style.padding='10px'; ccard.style.borderRadius='8px'; ccard.style.cursor='pointer'; ccard.style.wordBreak='break-word';
                        if (!d.enabled) ccard.classList.add('disabled');
                        const iconWrap = document.createElement('div'); iconWrap.className='toolbox-card-icon'; iconWrap.style.width='56px'; iconWrap.style.height='56px'; iconWrap.style.display='flex'; iconWrap.style.alignItems='center'; iconWrap.style.justifyContent='center'; iconWrap.style.background='#0d0f10'; iconWrap.style.borderRadius='6px';
                        const icon = document.createElement('div'); icon.textContent = d.key === 'power' ? '⚡' : (d.key==='conveyor'?'▤':(d.key==='water'?'💧':'🔥')); icon.style.fontSize='22px'; iconWrap.appendChild(icon);
                        const txt = document.createElement('div'); txt.style.flex='1'; txt.style.minWidth='0'; const nm = document.createElement('div'); nm.className='toolbox-card-name'; nm.textContent = d.label; const sub = document.createElement('div'); sub.className='toolbox-card-category'; sub.textContent = d.comingSoon ? 'Coming soon' : d.renderer; txt.appendChild(nm); txt.appendChild(sub);
                        ccard.appendChild(iconWrap); ccard.appendChild(txt);
                        ccard.addEventListener('click', (ev)=>{
                            ev.preventDefault(); try { if (!d.enabled) return; } catch(e){}
                            // Cancel placement mode
                            try { if (fetchScene._placementController && fetchScene._placementController.isPlacing()) fetchScene._placementController.cancelPlacement(); } catch(e){}
                            // Begin connection mode
                            try { if (fetchScene._connectionController) fetchScene._connectionController.beginConnection(d.key, d); } catch(e){}
                            // visual selected state
                            setSelectedToolboxCard(ccard);
                        });
                        connList.appendChild(ccard);
                    });
                    connHeader.addEventListener('click', ()=>{ const expanded = connList.style.display !== 'none'; connList.style.display = expanded ? 'none' : 'flex'; connCollapse.textContent = expanded ? '▸' : '▾'; connCollapse.setAttribute('aria-expanded', String(!expanded)); });
                    connSection.appendChild(connHeader); connSection.appendChild(connList); container.appendChild(connSection);
                } catch(e) {}
                try { toolbox.classList.add('expanded'); document.body.classList.add('toolbox-is-expanded'); const tog = document.getElementById('toolbox-toggle'); if (tog) tog.setAttribute('aria-expanded','true'); toolbox.style.width='280px'; const simRoot=document.getElementById('simulator-root'); if (simRoot) simRoot.style.marginLeft='280px'; } catch(e){}
                search.addEventListener('input', (e)=>{ const q=(e.target.value||'').toLowerCase().trim(); container.querySelectorAll('.toolbox-card').forEach(card=>{ const name = (card.querySelector('div') && card.querySelector('div').innerText) || ''; card.style.display = (!q || name.toLowerCase().includes(q)) ? '' : 'none'; }); });
            } catch (e) { /* ignore */ }
        })();

        // BuildingManager instantiated now to centralize building lifecycle
        this._buildingManager = new BuildingManager(this, this._gridSystem, this._buildingDefinitions, this._eventBus);
        // Connection manager/controller for linking buildings
        this._connectionManager = new ConnectionManager(this, this._buildingManager);
        import('./simulator/controllers/ConnectionController.js').then(mod => { try { this._connectionController = new mod.default(this, this._connectionManager); } catch(e){} }).catch(e=>{});
        // InputHandler centralizes pointer and keyboard routing
        this._inputHandler = new InputHandler(this, this._buildingManager, this._cameraController);
        // PlacementController handles placement lifecycle and preview
        import('./simulator/controllers/PlacementController.js').then(mod => {
            try { this._placementController = new mod.default(this, this._buildingManager); } catch (e) { /* ignore */ }
        }).catch(e => { /* ignore */ });
        // Machine info UI panel (pure DOM) - scene fetches data then delegates rendering
        this._machineInfoPanel = new MachineInfoPanel();

        // Expose machine info helper for InputHandler and other scene code
        this.showMachineInfoFor = async (record) => {
            if (!record || record.defKey === undefined || record.defKey === null) return;
            const defKey = record.defKey;

            // If defKey is a non-numeric built-in definition, render from local building definitions
            if (typeof defKey === 'string' && !/^[0-9]+$/.test(defKey)) {
                const local = this._buildingDefs[defKey];
                if (local) {
                    try { this._machineInfoPanel.show(local, record); } catch (e) { /* ignore */ }
                    return;
                }
            }

            // defKey looks numeric (or is numeric-like); fetch from API but guard against invalid values
            const id = encodeURIComponent(String(defKey));
            if (!id || id === 'undefined') return;
            try {
                const res = await fetch('/api/machines/' + id, { credentials: 'same-origin' });
                if (!res.ok) throw new Error('Fetch failed: ' + res.status + ' ' + res.statusText);
                const m = await res.json();
                if (!m) throw new Error('No machine data');
                try { this._machineInfoPanel.show(m, record); } catch (e) { /* ignore */ }
            } catch (err) {
                // fallback: try to show local definition if available
                const local = this._buildingDefs[defKey];
                if (local) {
                    try { this._machineInfoPanel.show(local, record); } catch (e) { /* ignore */ }
                    return;
                }
                try {
                    const panelEl = document.getElementById('machine-info-panel');
                    if (panelEl) { panelEl.innerHTML = '<div>Unable to load machine information.</div>'; panelEl.style.display = 'block'; }
                } catch (e) {}
            }
        };
        // BuildingManager instantiated; do not mirror its private fields here.

        const fetchScene = this;
        // Fire-and-forget: load remote machines and augment definitions; toolbar DOM rendering remains in simulator.js
        this._buildingDefinitions.init().then(async (machines) => {
            try {
                if (!Array.isArray(machines) || machines.length === 0) return;

                // Queue image loads for Phaser and extend building definitions to use scene texture keys
                const queued = [];
                machines.forEach((m) => {
                    const id = String(m.id);
                    const textureKey = m.defKey ? `machine-${m.defKey}` : `machine-${id}`;
                    // Map DB record into internal buildingDef shape; preserve sensible defaults
                    fetchScene._buildingDefs[id] = Object.assign({
                        name: m.name || ('Machine ' + id),
                        image: m.image || null,
                        textureKey: textureKey,
                        category: 'process',
                        footprint: m.footprint || [2, 2],
                        permanent: !!m.permanent,
                        deletable: m.deletable !== false,
                        movable: m.movable !== false,
                        placeable: m.placeable !== false,
                        suggestedNext: []
                    }, fetchScene._buildingDefs[id] || {});

                    // Load image from public root using provided filename; do not use icon for canvas sprites
                    if (m.image) {
                        const url = '/' + m.image;
                        try {
                            // Avoid duplicate queueing
                            if (!fetchScene.textures.exists(textureKey) && !queued.includes(textureKey)) {
                                fetchScene.load.image(textureKey, url);
                                queued.push(textureKey);
                            }
                        } catch (e) {
                            console.warn('Failed to queue image load for', m.defKey || id, url, e);
                        }
                    }
                });

                // Start the loader for any queued assets and wait for completion before enabling placement
                if (queued.length > 0) {
                    // Attach one-time error listener for verification (will be removed later)
                    const loadErrors = [];
                    const onLoadError = (file) => {
                        loadErrors.push({ key: file.key, url: file.src });
                        console.warn('Machine image load error', file.key, file.src);
                    };
                    fetchScene.load.on('loaderror', onLoadError);
                    fetchScene.load.once('complete', () => {
                        // detach listener
                        try { fetchScene.load.off('loaderror', onLoadError); } catch (e) {}
                        if (loadErrors.length) {
                            loadErrors.forEach(err => console.warn('Machine texture failed to load', err));
                        }
                    });
                    try { fetchScene.load.start(); } catch (e) { /* ignore */ }
                }

                // Populate left Toolbox (existing #toolbox) with machines from repository
                try {
                    const toolbox = document.getElementById('toolbox');
                    const toolboxBody = document.getElementById('toolbox-body');
                    if (toolbox && toolboxBody) {
                        // Build search input and categories container
                        const search = document.createElement('input');
                        search.type = 'search';
                        search.placeholder = 'Search machines...';
                        search.id = 'toolbox-search';
                        search.style.width = '100%';
                        search.style.boxSizing = 'border-box';
                        search.style.padding = '8px';
                        search.style.marginBottom = '8px';

                        const container = document.createElement('div');
                        container.id = 'toolbox-categories';

                        toolboxBody.innerHTML = '';
                        toolboxBody.appendChild(search);
                        toolboxBody.appendChild(container);
                        // Expand toolbox by default for new UI (force styles in case other scripts manage state)
                        try {
                            toolbox.classList.add('expanded');
                            document.body.classList.add('toolbox-is-expanded');
                            const tog = document.getElementById('toolbox-toggle'); if (tog) tog.setAttribute('aria-expanded', 'true');
                            toolbox.style.width = '280px';
                            const simRoot = document.getElementById('simulator-root'); if (simRoot) simRoot.style.marginLeft = '280px';
                        } catch (e) {}

                        // Group machines by category
                        const groups = {};
                        machines.forEach(m => {
                            const cat = (m.category || 'other').toString();
                            groups[cat] = groups[cat] || [];
                            groups[cat].push(m);
                        });

                        // Category display name mapping (emoji + name)
                        const categoryDisplay = (c) => {
                            const map = {
                                agriculture: '🌿 Agriculture',
                                process: '⚙ Processing',
                                infrastructure: '⚡ Energy',
                                manufacturing: '🏭 Manufacturing',
                                recycling: '♻ Recycling',
                                water: '💧 Water',
                                storage: '📦 Storage',
                                research: '🧪 Research',
                                source: '📦 Sources',
                                transport: '🚚 Transport',
                                other: '• Other'
                            };
                            return map[c] || (c ? (c.charAt(0).toUpperCase() + c.slice(1)) : 'Other');
                        };

                        // Create category sections
                        Object.keys(groups).sort().forEach(cat => {
                            const section = document.createElement('div');
                            section.className = 'toolbox-category';
                            const header = document.createElement('div');
                            header.className = 'toolbox-category-header';
                            header.style.display = 'flex';
                            header.style.justifyContent = 'space-between';
                            header.style.alignItems = 'center';
                            header.style.padding = '6px 4px';
                            header.style.cursor = 'pointer';
                            const title = document.createElement('div');
                            const titleName = document.createElement('span'); titleName.className = 'toolbox-category-title'; titleName.textContent = categoryDisplay(cat);
                            const titleCount = document.createElement('span'); titleCount.className = 'toolbox-category-count'; titleCount.textContent = ' (' + groups[cat].length + ')';
                            title.appendChild(titleName); title.appendChild(titleCount);
                            title.style.fontWeight = '700';
                            title.style.fontSize = '13px';
                            const collapseBtn = document.createElement('button');
                            collapseBtn.textContent = '▾';
                            collapseBtn.setAttribute('aria-expanded', 'true');
                            collapseBtn.style.background = 'transparent';
                            collapseBtn.style.border = '0';
                            collapseBtn.style.color = '#9ca3af';
                            collapseBtn.style.cursor = 'pointer';
                            collapseBtn.className = 'toolbox-collapse-btn';
                            header.appendChild(title);
                            header.appendChild(collapseBtn);

                            const list = document.createElement('div');
                            list.className = 'toolbox-category-list';
                            list.style.display = 'flex';
                            list.style.flexDirection = 'column';
                            list.style.gap = '8px';
                            list.style.padding = '6px 4px 12px 4px';

                            groups[cat].forEach(m => {
                                    const card = document.createElement('div');
                                    card.className = 'toolbox-card';
                                    card.style.display = 'flex';
                                    card.style.alignItems = 'center';
                                    card.style.gap = '12px';
                                    card.style.padding = '10px';
                                    card.style.borderRadius = '8px';
                                    card.style.cursor = 'pointer';
                                    card.style.wordBreak = 'break-word';
                                    card.setAttribute('data-defkey', m.defKey || String(m.id));

                                    const iconWrap = document.createElement('div'); iconWrap.className = 'toolbox-card-icon';
                                    const img = document.createElement('img');
                                    const repoIcon = (typeof fetchScene._machineRepoIconPath === 'function') ? fetchScene._machineRepoIconPath(m) : null;
                                    img.src = repoIcon || (m.image ? ('/' + m.image) : '/processingplant.png');
                                    img.alt = m.name || '';
                                    img.style.width = '56px'; img.style.height = '56px'; img.style.objectFit = 'contain'; img.style.flex = '0 0 56px';
                                    iconWrap.appendChild(img);

                                    const text = document.createElement('div');
                                    text.style.flex = '1'; text.style.minWidth='0';
                                    const nm = document.createElement('div'); nm.textContent = m.name || (m.defKey || m.id); nm.className='toolbox-card-name';
                                    const catline = document.createElement('div'); catline.textContent = categoryDisplay((m.category || '').toString()); catline.className = 'toolbox-card-category';
                                    text.appendChild(nm); text.appendChild(catline);

                                    card.appendChild(iconWrap); card.appendChild(text);

                                    // Tooltip using local data
                                    card.addEventListener('mouseenter', ()=>{
                                        try {
                                            const tooltip = document.getElementById('toolbox-tooltip');
                                            if (!tooltip) return;
                                            const parts = [];
                                            if (m.name) parts.push('<div class="title">'+m.name+'</div>');
                                            if (m.description) parts.push('<div class="meta">'+m.description+'</div>');
                                            if (Array.isArray(m.inputs) && m.inputs.length) parts.push('<div class="line"><strong>Inputs:</strong> '+m.inputs.map(i=>((i.quantity||i.amount||'')+(i.units?(' '+i.units):'')+' '+(i.resourceId||i.name||''))).join(', ')+'</div>');
                                            if (Array.isArray(m.outputs) && m.outputs.length) parts.push('<div class="line"><strong>Outputs:</strong> '+m.outputs.map(o=>((o.quantity||o.amount||'')+(o.units?(' '+o.units):'')+' '+(o.resourceId||o.name||''))).join(', ')+'</div>');
                                            if (m.powerRequired !== undefined) parts.push('<div class="line"><strong>Power Req:</strong> '+m.powerRequired+'</div>');
                                            if (m.powerProduced !== undefined) parts.push('<div class="line"><strong>Power Prod:</strong> '+m.powerProduced+'</div>');
                                            tooltip.innerHTML = parts.join(''); tooltip.style.display='block';
                                            const rect = card.getBoundingClientRect();
                                            const left = Math.min(window.innerWidth - 340, rect.right + 8);
                                            const top = Math.max(8, rect.top + (rect.height/2) - 40);
                                            tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px';
                                        } catch(e){}
                                    });
                                    card.addEventListener('mouseleave', ()=>{ const tooltip = document.getElementById('toolbox-tooltip'); if (tooltip) tooltip.style.display='none'; });

                                    card.addEventListener('click', (ev) => {
                                        ev.preventDefault();
                                        const controller = fetchScene._placementController;
                                        const key = m.defKey || String(m.id);
                                        if (controller && typeof controller.beginPlacement === 'function') {
                                            try { controller.beginPlacement(key); } catch (e) { /* ignore */ }
                                        }
                                        // mark selected visually
                                        try { document.querySelectorAll('.toolbox-card.selected').forEach(c=>c.classList.remove('selected')); card.classList.add('selected');
                                            const watcher = setInterval(()=>{ try { if (!controller || typeof controller.isPlacing !== 'function' || !controller.isPlacing()) { card.classList.remove('selected'); clearInterval(watcher); } } catch(e){ card.classList.remove('selected'); clearInterval(watcher);} }, 200);
                                        } catch(e){}
                                    });

                                    list.appendChild(card);
                                });

                            header.addEventListener('click', () => {
                                const expanded = list.style.display !== 'none';
                                list.style.display = expanded ? 'none' : 'flex';
                                collapseBtn.textContent = expanded ? '▸' : '▾';
                                collapseBtn.setAttribute('aria-expanded', String(!expanded));
                            });

                            section.appendChild(header);
                            section.appendChild(list);
                            container.appendChild(section);
                        });

                        // Search filter
                        search.addEventListener('input', (e) => {
                            const q = (e.target.value || '').toLowerCase().trim();
                            container.querySelectorAll('.toolbox-card').forEach(card => {
                                const name = (card.querySelector('div') && card.querySelector('div').innerText) || '';
                                card.style.display = (!q || name.toLowerCase().includes(q)) ? '' : 'none';
                            });
                        });
                    }
                } catch (e) {
                    console.warn('Toolbox population failed', e);
                }
                // BuildingManager was instantiated eagerly during scene create(); definitions have populated.
            } catch (err) {
                console.error('Failed to load machines from API:', err);
                let msgEl = document.getElementById('simulator-api-error');
                if (!msgEl) {
                    msgEl = document.createElement('div');
                    msgEl.id = 'simulator-api-error';
                    msgEl.style.position = 'absolute';
                    msgEl.style.top = '48px';
                    msgEl.style.left = '8px';
                    msgEl.style.zIndex = 20000;
                    msgEl.style.background = 'rgba(255,75,75,0.9)';
                    msgEl.style.color = '#fff';
                    msgEl.style.padding = '6px 8px';
                    msgEl.style.borderRadius = '6px';
                    msgEl.style.fontSize = '13px';
                    msgEl.textContent = 'Could not load machine definitions from API — using built-in defaults.';
                    const wrapper = document.querySelector('.simulator-root-wrapper') || document.body;
                    wrapper.appendChild(msgEl);
                }
            }
        }).catch((err) => {
            console.error('Failed to load machines from API:', err);
            let msgEl = document.getElementById('simulator-api-error');
            if (!msgEl) {
                msgEl = document.createElement('div');
                msgEl.id = 'simulator-api-error';
                msgEl.style.position = 'absolute';
                msgEl.style.top = '48px';
                msgEl.style.left = '8px';
                msgEl.style.zIndex = 20000;
                msgEl.style.background = 'rgba(255,75,75,0.9)';
                msgEl.style.color = '#fff';
                msgEl.style.padding = '6px 8px';
                msgEl.style.borderRadius = '6px';
                msgEl.style.fontSize = '13px';
                msgEl.textContent = 'Could not load machine definitions from API — using built-in defaults.';
                const wrapper = document.querySelector('.simulator-root-wrapper') || document.body;
                wrapper.appendChild(msgEl);
            }
        });
        // Placeholders removed — images are loaded from public/ instead
        // Placement state is owned by PlacementController; do not mutate legacy flags here.
        // Track whether the initial permanent source buildings have been placed
        this._initialSourcesPlaced = false;
        // Global toggle for showing building names
        this._showNames = false;
        // Currently hovered building record (used for temporary label visibility)
        this._hoveredRecord = null;
        this._lastCamState = { x: null, y: null, zoom: null };

        // Scene-wide settings and visual systems
        this._sceneSettings = {
            showMachineStatusColours: true
        };

        // Status colour palette for machine status backgrounds
        this._statusColours = {
            working: { colour: 0x39a96b, alpha: 0.20 },
            fault: { colour: 0xd64545, alpha: 0.20 },
            neutral: { colour: null, alpha: 0 }
        };

        // Power system disabled — no cable visuals or hub state
        this._powerCables = null;
        this._hubPowerState = null;

        // Bind drawGrid to the scene update loop — but only redraw when camera changes.
        this.events.on('postupdate', this._drawGrid, this);

        // Track whether we've successfully rendered at least one visible grid.
        this._gridHasRendered = false;

        // Camera wheel/pan/reset handled by CameraController (see resources/js/simulator/core/CameraController.js)

        /*
                if (pointer.middleButtonDown()) {
                    // CameraController will handle drag start and context menu hiding.
                    return;
                }

            // Left-click: either place a building (when in placement mode) or start possible drag/select
            if (pointer.leftButtonDown()) {
                const world = cam.getWorldPoint(pointer.x, pointer.y);
                const gs = this._gridConfig;
                const ix = Math.floor(world.x / gs.minor);
                const iy = Math.floor(world.y / gs.minor);

                if (this._placementMode) {
                    const defKey = this._placementDefKey || 'processUnit';
                    const def = this._buildingDefs[defKey];
                    const [fw, fh] = def.footprint;
                    // Delegate footprint validation to BuildingManager
                    const canPlace = this._buildingManager.canPlace(ix, iy, defKey);
                    if (canPlace) {
                        this._buildingManager.placeMachine(ix, iy, defKey);
                        // After placing exactly one building, exit placement mode and clear preview
                        this._placementMode = false;
                        this._placementDefKey = null;
                        try { this._hoverGraphics.clear(); } catch (e) {}
                        // Clear any toolbar button active states if present
                        try {
                            document.querySelectorAll('.simulator-toolbar .toolbar-button.active').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
                        } catch (e) {}
                    }
                    // do not perform selection while placing
                    return;
                }

                // Not in placement mode: check if clicked on a building to start a possible drag
                const key = `${ix},${iy}`;
                const record = this._buildingManager.getMachineAt(ix, iy);
                if (record) {
                    // If record is not movable, treat as selection only
                    if (!record.movable) {
                        this._selectedCell = { ix: record.gridX, iy: record.gridY };
                        this._drawSelection();
                        try { scene.showMachineInfoFor(record); } catch (e) {}
                        return;
                    }
                    // Start drag state (not yet dragging until threshold exceeded)
                    this._dragState.active = true;
                    this._dragState.isDragging = false;
                    this._dragState.startScreen = { x: pointer.x, y: pointer.y };
                    this._dragState.record = record;
                    this._dragState.origGrid = { x: record.gridX, y: record.gridY };
                    // compute pointer->container offset in world coordinates so preview keeps relative position
                    const containerWorldX = record.gridX * gs.minor;
                    const containerWorldY = record.gridY * gs.minor;
                    this._dragState.offsetWorld = { x: world.x - containerWorldX, y: world.y - containerWorldY };
                    // ensure selection marks original origin while dragging may not start
                    this._selectedCell = { ix: record.gridX, iy: record.gridY };
                    this._drawSelection();
                    return;
                }

                // Clicked empty ground: clear any selection
                this._selectedCell = null;
                this._drawSelection();

                // Clicking empty space: normal selection
                this._selectedCell = { ix, iy };
                this._drawSelection();
            }
        });

        // this.input.on('pointerup', (pointer) => {

            // Handle left-button release for drag-to-move finalization/click
            if (pointer.leftButtonReleased()) {
                if (this._dragState.active) {
                    const gs = this._gridConfig;
                    const record = this._dragState.record;
                    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
                    const fw = def.footprint[0];
                    const fh = def.footprint[1];

                    if (this._dragState.isDragging) {
                        // compute destination grid from container position (snapped during drag)
                        const destIx = Math.floor(record.container.x / gs.minor);
                        const destIy = Math.floor(record.container.y / gs.minor);

                        // validate and commit move via BuildingManager (ignoring this record)
                        const canMove = this._buildingManager.canPlace(destIx, destIy, record.defKey, record);
                        if (canMove) {
                            this._buildingManager.moveMachine(record, destIx, destIy);
                            // keep selection on new origin
                            this._selectedCell = { ix: destIx, iy: destIy };
                            this._drawSelection();
                        } else {
                            // invalid move: return to original position
                            record.container.x = this._dragState.origGrid.x * gs.minor;
                            record.container.y = this._dragState.origGrid.y * gs.minor;
                            // keep selection at original
                            this._selectedCell = { ix: this._dragState.origGrid.x, iy: this._dragState.origGrid.y };
                            this._drawSelection();
                        }
                    } else {
                        // Pointer released without exceeding threshold -> treat as click: select building origin cell
                        const orig = this._dragState.origGrid;
                        this._selectedCell = { ix: orig.x, iy: orig.y };
                        this._drawSelection();
                        // show machine info for this building if available
                        try { const rec = this._buildingManager.getMachineAt(orig.x, orig.y); if (rec) scene.showMachineInfoFor(rec); } catch (e) {}
                    }

                    // Clear drag preview graphics and reset state
                    this._dragGraphics.clear();
                    this._dragState.active = false;
                    this._dragState.isDragging = false;
                    this._dragState.record = null;
                }
            }
        });

        // this.input.on('pointermove', (pointer) => {
            // Camera panning handled by CameraController; continue with building drag/hover logic

            // Handle possible building drag
            if (this._dragState.active && this._dragState.record) {
                const gs = this._gridConfig;
                const record = this._dragState.record;
                const start = this._dragState.startScreen;

                // If not yet considered dragging, check threshold (screen pixels)
                if (!this._dragState.isDragging) {
                    const dx = pointer.x - start.x;
                    const dy = pointer.y - start.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist >= this._dragState.threshold) {
                        this._dragState.isDragging = true;
                        // Optional visual hint
                        record.container.setDepth(1000);
                        record.container.setAlpha(0.95);
                    }
                }

                if (this._dragState.isDragging) {
                    // Compute desired world top-left position based on pointer and stored offset
                    const world = cam.getWorldPoint(pointer.x, pointer.y);
                    const desiredX = world.x - this._dragState.offsetWorld.x;
                    const desiredY = world.y - this._dragState.offsetWorld.y;
                    const destIx = Math.floor(desiredX / gs.minor);
                    const destIy = Math.floor(desiredY / gs.minor);

                    // Snap container for preview (do not change occupancy yet)
                    record.container.x = destIx * gs.minor;
                    record.container.y = destIy * gs.minor;

                    // Validate footprint occupancy while ignoring the dragged record's current cells
                    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
                    const [fw, fh] = def.footprint;
                    const occupied = !this._buildingManager.canPlace(destIx, destIy, record.defKey, record);

                    // Draw preview footprint using drag graphics
                    const g = this._dragGraphics;
                    g.clear();
                    const fillColor = occupied ? 0xff0000 : 0x10b981;
                    const fillAlpha = occupied ? 0.16 : 0.18;
                    g.fillStyle(fillColor, fillAlpha);
                    g.fillRect(destIx * gs.minor, destIy * gs.minor, fw * gs.minor, fh * gs.minor);
                    g.lineStyle(2, 0xffffff, 0.12);
                    g.strokeRect(destIx * gs.minor + 1, destIy * gs.minor + 1, fw * gs.minor - 2, fh * gs.minor - 2);

                    // Keep selection highlighting on the preview origin
                    this._selectedCell = { ix: destIx, iy: destIy };
                    this._drawSelection();
                    return;
                }
            }

            // Always update hover cell under pointer when not dragging a building
            this._updateHover(pointer);
        */

        // Camera reset handled by CameraController
        // Toolbar show/hide helpers
        const toolbarEl = document.getElementById('simulator-toolbar');
        function showToolbar() {
            if (toolbarEl) toolbarEl.style.display = '';
        }
        function hideToolbar() {
            if (toolbarEl) toolbarEl.style.display = 'none';
        }
        function toggleToolbar() {
            if (!toolbarEl) return;
            toolbarEl.style.display = toolbarEl.style.display === 'none' ? '' : 'none';
        }

        // Wire Process Unit placement button
        const placeProcessBtn = document.getElementById('place-process-unit-btn');
        if (placeProcessBtn) {
            placeProcessBtn.addEventListener('click', () => {
                // toggle placement via PlacementController when available
                const controller = this._placementController;
                const active = controller && controller.isPlacing() && controller.getGhost().defKey === 'processUnit';
                if (!active && controller) {
                    controller.beginPlacement('processUnit');
                    placeProcessBtn.classList.add('active');
                    placeProcessBtn.setAttribute('aria-pressed', 'true');
                    controller.handlePointerMove(this.input.activePointer);
                } else if (controller) {
                    controller.cancelPlacement();
                    placeProcessBtn.classList.remove('active');
                    placeProcessBtn.setAttribute('aria-pressed', 'false');
                    try { this._hoverGraphics.clear(); } catch (e) {}
                } else {
                    // placement controller not ready; no-op
                }
            });
        }

        // Wire Sorting Facility placement button
        const placeSortingBtn = document.getElementById('place-sorting-facility-btn');
        if (placeSortingBtn) {
            placeSortingBtn.addEventListener('click', () => {
                const controller = this._placementController;
                const active = controller && controller.isPlacing() && controller.getGhost().defKey === 'sortingFacility';
                if (!active && controller) {
                    controller.beginPlacement('sortingFacility');
                    placeSortingBtn.classList.add('active');
                    placeSortingBtn.setAttribute('aria-pressed', 'true');
                    controller.handlePointerMove(this.input.activePointer);
                } else if (controller) {
                    controller.cancelPlacement();
                    placeSortingBtn.classList.remove('active');
                    placeSortingBtn.setAttribute('aria-pressed', 'false');
                    try { this._hoverGraphics.clear(); } catch (e) {}
                } else {
                    // placement controller not ready; no-op
                }
            });
        }

        // Exit placement mode on Escape - handled by InputHandler

        // Hook up Show Names toggle
        const showNamesBtn = document.getElementById('toggle-show-names-btn');
        if (showNamesBtn) {
            showNamesBtn.addEventListener('click', () => {
                this._showNames = !this._showNames;
                showNamesBtn.classList.toggle('active', this._showNames);
                showNamesBtn.setAttribute('aria-pressed', String(this._showNames));
                // Update visibility for all existing buildings
                this._updateLabelsVisibility();
            });
            // ensure Escape handling does not toggle this control; no extra Escape logic needed here
        }

        // Context menu responsibilities extracted to ContextMenu class
        const scene = this;

        function handleSuggestedMachine(defKey) {
            // placeholder: future hook
        }
        // Instantiate ContextMenu with callbacks into the scene
        this._contextMenu = new ContextMenu({
            onAction: (action, payload) => {
                try {
                    switch (action) {
                        case 'delete':
                            deleteBuilding(payload);
                            break;
                        case 'info':
                            scene.showMachineInfoFor(payload);
                            break;
                        case 'suggested':
                            handleSuggestedMachine(payload);
                            break;
                        case 'toggleToolbar':
                            toggleToolbar();
                            break;
                        case 'toggleStatus':
                            scene._sceneSettings.showMachineStatusColours = !scene._sceneSettings.showMachineStatusColours;
                            if (typeof scene._recomputeMachineStatuses === 'function') scene._recomputeMachineStatuses();
                            break;
                        case 'rotate':
                        case 'upgrade':
                            // not implemented yet
                            break;
                        default:
                            break;
                    }
                } catch (e) { console.warn('ContextMenu action handler failed', e); }
            }
        });

        // Expose thin wrappers expected by InputHandler and CameraController
        scene.showContextMenuFor = function (targetType, targetRecord, clientX, clientY) {
            try {
                // Keep selection visible when showing menu for a building
                if (targetRecord) { scene._selectedCell = { ix: targetRecord.gridX, iy: targetRecord.gridY }; scene._drawSelection(); }
                scene._contextMenu.show(targetRecord, clientX, clientY);
            } catch (e) { console.warn(e); }
        };
        scene.hideContextMenu = function () { try { scene._contextMenu.hide(); } catch (e) {} };

        // Shared delete function
        function deleteBuilding(record) {
            if (!record || !record.deletable) return;
            // Delegate removal to BuildingManager which handles cables, occupancy and container destruction
            if (scene._buildingManager) {
                scene._buildingManager.removeMachine(record);
            } else {
                if (typeof scene._removeCablesForRecord === 'function') scene._removeCablesForRecord(record);
                if (record.container && record.container.destroy) record.container.destroy();
            }
            // clear selection and visuals
            scene._selectedCell = null;
            scene._hoveredRecord = null;
            scene._drawSelection();
        }

        // Expose delete helper for InputHandler
        scene.deleteBuilding = deleteBuilding;

        // Input handling moved to InputHandler
        }

        update() {
            // Force the first grid draw from the update loop until we have a valid rendered grid.
            if (!this._gridHasRendered) {
                const drawn = this._drawGrid(true);
                if (drawn) {
                    this._gridHasRendered = true;
                }
            }
            // Place the initial permanent source buildings once after the first visible grid render
            if (this._gridHasRendered && !this._initialSourcesPlaced) {
                const cam = this.cameras.main;
                const gs = this._gridConfig;
                const view = cam.worldView;

                // compute a readable 3x2 grid layout relative to viewport centre
                const centerX = view.x + view.width / 2;
                const centerIx = Math.floor(centerX / gs.minor);
                const startIx = centerIx - 14; // left-most column
                const startIy = Math.floor((view.y + gs.minor * 1.5) / gs.minor);

                const placements = [
                    { key: 'municipalWaste', ix: startIx + 0, iy: startIy + 0 },
                    { key: 'technologyWaste', ix: startIx + 6, iy: startIy + 0 },
                    { key: 'farmWaste', ix: startIx + 12, iy: startIy + 0 },
                    { key: 'scrapTyres', ix: startIx + 18, iy: startIy + 0 },
                    { key: 'industrialWaste', ix: startIx + 0, iy: startIy + 6 },
                    { key: 'buildingWaste', ix: startIx + 6, iy: startIy + 6 },
                    { key: 'sewerage', ix: startIx + 12, iy: startIy + 6 }
                ];

                for (const p of placements) {
                    // skip if a building of this defKey already exists
                    let exists = false;
                    for (const rec of this._buildingManager.getPlacedMachines()) {
                        if (rec && rec.defKey === p.key) { exists = true; break; }
                    }
                    if (exists) continue;

                    const def = this._buildingDefs[p.key];
                    if (!def) continue;
                    const rec = this._buildingManager.placeMachine(p.ix, p.iy, p.key);
                    if (rec) {
                        rec.permanent = def.permanent === true;
                        rec.deletable = def.deletable !== false;
                        rec.movable = def.movable !== false;
                    }
                }

                this._initialSourcesPlaced = true;
                // Place External Grid and a demo Process Unit and connect them with a power cable for the initial demo
                try {
                    const gridRec = this._buildingManager.placeMachine(startIx + 22, startIy + 0, 'externalGrid');
                    if (gridRec) { gridRec.permanent = true; gridRec.deletable = false; gridRec.movable = true; }
                    // Do not place demo process unit on load — only show external substation
                    if (typeof this._recomputeMachineStatuses === 'function') this._recomputeMachineStatuses();
                } catch (e) {
                    console.warn('Error placing initial External Grid demo:', e);
                }
            }
        }
}

// Draw grid function added to PrototypeScene prototype
// Returns true when a visible grid was drawn, false otherwise.
PrototypeScene.prototype._drawGrid = function (force) {
    if (!this._gridSystem) return false;
    return this._gridSystem.drawGrid(Boolean(force));
};

    // Update hover graphics for the cell under the given pointer
    PrototypeScene.prototype._updateHover = function (pointer) {
        const cam = this.cameras.main;
        const gs = this._gridConfig;
        // Convert screen pointer to world coordinates
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const ix = Math.floor(world.x / gs.minor);
        const iy = Math.floor(world.y / gs.minor);

        // If hover cell unchanged, nothing to do
        if (this._hoverCell && this._hoverCell.ix === ix && this._hoverCell.iy === iy) {
            return;
        }

        this._hoverCell = { ix, iy };

        const g = this._hoverGraphics;
        g.clear();

        // If placement controller active, delegate hover preview drawing to it
        if (this._placementController && this._placementController.isPlacing()) {
            try { this._placementController.handlePointerMove(pointer); } catch (e) {}
            return;
        }

        // Default hover appearance when not placing: subtle fill
        const fillColor = 0xffffff;
        const fillAlpha = 0.08;
        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);

        // If hovering a building, temporarily show its label when global names hidden
        const hovered = this._buildingManager.getMachineAt(ix, iy);
        if (hovered) {
            if (this._hoveredRecord !== hovered) {
                this._hoveredRecord = hovered;
                this._updateLabelsVisibility();
            }
            return;
        }

        // No building hovered: clear hoveredRecord and update labels
        if (this._hoveredRecord) {
            this._hoveredRecord = null;
            this._updateLabelsVisibility();
        }
    };

    // Update label visibility for all unique building records
    PrototypeScene.prototype._updateLabelsVisibility = function () {
        const showGlobal = Boolean(this._showNames);
        const gs = this._gridConfig;

        // Build set of unique records (map has multiple keys per record)
        const seen = new Set();
        for (const rec of this._buildingManager.getPlacedMachines()) {
            if (!rec || seen.has(rec)) continue;
            seen.add(rec);
            const label = rec.label;
            if (!label) continue;

            // Visible if global toggle on, or if this record is hovered, or if selected
            let visible = false;
            if (showGlobal) {
                visible = true;
            } else if (this._hoveredRecord === rec) {
                visible = true;
            } else if (this._selectedCell && this._selectedCell.ix === rec.gridX && this._selectedCell.iy === rec.gridY) {
                visible = true;
            }

            label.setVisible(visible);
        }
    };

    // Draw (or clear) the selection rectangle based on _selectedCell
    PrototypeScene.prototype._drawSelection = function () {
        const gs = this._gridConfig;
        const g = this._selectionGraphics;
        g.clear();
        if (!this._selectedCell) {
            // ensure labels reflect that nothing is selected
            this._updateLabelsVisibility();
            return;
        }
        const { ix, iy } = this._selectedCell;

        // selection: semi-opaque fill + thin stroke
        const fillColor = 0xffffff;
        const fillAlpha = 0.16;
        const strokeColor = 0xffffff;
        const strokeAlpha = 0.28;
        const strokeThickness = Math.max(1, gs.minorThickness);

        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(ix * gs.minor, iy * gs.minor, gs.minor, gs.minor);
        g.lineStyle(strokeThickness, strokeColor, strokeAlpha);
        g.strokeRect(ix * gs.minor + 0.5, iy * gs.minor + 0.5, gs.minor - 1, gs.minor - 1);
        // Update label visibility so selected building's label is shown even when global hide is active
        this._updateLabelsVisibility();
    };

// Legacy _placeBuilding removed — BuildingManager manages placement lifecycle and record creation

// ---------------------------
// Machine status visuals and power cable system
// ---------------------------

PrototypeScene.prototype._ensureStatusBg = function (record) {
    if (!record) return;
    if (record.statusBg && record.statusBg.destroyed) record.statusBg = null;
    if (record.statusBg) return;
    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const pad = 6;
    const w = fw * gs.minor + pad;
    const h = fh * gs.minor + pad;
    const bg = this.add.graphics();
    // Draw rounded rect anchored so it sits behind the building
    const r = Math.min(12, Math.min(w, h) * 0.12);
    bg.fillStyle(0x000000, 0); // initial transparent
    bg.fillRoundedRect(-pad/2, -pad/2, w, h, r);
    bg.lineStyle(0, 0x000000, 0);
    // Ensure it doesn't capture pointer events
    try { bg.disableInteractive && bg.disableInteractive(); } catch (e) {}
    // Insert as first child so it appears behind image and label
    record.container.addAt(bg, 0);
    record.statusBg = bg;
};

PrototypeScene.prototype._updateMachineStatusVisual = function (record) {
    if (!record) return;
    this._ensureStatusBg(record);
    const bg = record.statusBg;
    if (!bg) return;
    const status = record.status || 'neutral';
    const cfg = this._statusColours[status] || this._statusColours.neutral;
    bg.clear();
    if (!this._sceneSettings.showMachineStatusColours || !cfg || !cfg.colour || cfg.alpha <= 0) {
        bg.setVisible(false);
        return;
    }
    const def = this._buildingDefs[record.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const pad = 6;
    const w = fw * gs.minor + pad;
    const h = fh * gs.minor + pad;
    const r = Math.min(12, Math.min(w, h) * 0.12);
    bg.fillStyle(cfg.colour, cfg.alpha);
    bg.fillRoundedRect(-pad/2, -pad/2, w, h, r);
    bg.setVisible(true);
};

PrototypeScene.prototype._updateAllStatusVisibility = function () {
    // Toggle visibility of all status backgrounds according to scene setting
    const seen = new Set();
    for (const rec of this._buildingManager.getPlacedMachines()) {
        if (!rec || !rec.id) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        if (rec.statusBg) {
            rec.statusBg.setVisible(Boolean(this._sceneSettings.showMachineStatusColours));
        }
    }
};

// Power connections removed — machine statuses default to working (non-permanent) or neutral (permanent)
PrototypeScene.prototype._recomputeMachineStatuses = function () {
    const seen = new Set();
    for (const rec of this._buildingManager.getPlacedMachines()) {
        if (!rec || !rec.id) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        if (rec.permanent) {
            rec.status = 'neutral';
        } else {
            rec.status = 'working';
        }
        this._updateMachineStatusVisual(rec);
    }
};

PrototypeScene.prototype._getRecordCenter = function (rec) {
    const def = this._buildingDefs[rec.defKey] || this._buildingDefs.processUnit;
    const gs = this._gridConfig;
    const fw = def.footprint[0];
    const fh = def.footprint[1];
    const cx = rec.container.x + (fw * gs.minor) / 2;
    const cy = rec.container.y + (fh * gs.minor) / 2 - 6;
    return { x: cx, y: cy };
};

// Power cable creation disabled — stub
PrototypeScene.prototype._createPowerCable = function (model) { return null; };
// Create a power cable renderer between an external boundary and the facility
PrototypeScene.prototype._createPowerCable = function (opts) {
    // opts: { id, start: {x,y}, end: {x,y} }
    if (!opts || !opts.start || !opts.end) return null;
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    // draw main cable line (dark) with subtle outline
    g.lineStyle(6, 0x0b0b0b, 1);
    g.beginPath(); g.moveTo(opts.start.x, opts.start.y); g.lineTo(opts.end.x, opts.end.y); g.strokePath();
    g.lineStyle(2, 0x2b2b2b, 0.6);
    g.beginPath(); g.moveTo(opts.start.x, opts.start.y); g.lineTo(opts.end.x, opts.end.y); g.strokePath();
    container.add(g);

    // create a small lightning texture once
    const symKey = 'lightning-symbol';
    if (!this.textures.exists(symKey)) {
        const sx = this.add.graphics();
        sx.fillStyle(0xffffff, 1);
        sx.fillTriangle(0,0, 10,6, 0,12);
        sx.generateTexture(symKey, 10, 12);
        sx.destroy();
    }

    // prepare moving symbols array
    const symbols = [];
    const count = 6;
    for (let i=0;i<count;i++){
        const img = this.add.image(opts.start.x, opts.start.y, symKey);
        img.setOrigin(0.5);
        img.setDepth(9000);
        img.setScale(1);
        container.add(img);
        symbols.push(img);
    }

    return { container, graphics: g, symbols, start: opts.start, end: opts.end };
};

// Remove power cable
PrototypeScene.prototype._removePowerCable = function (rec) {
    try {
        if (rec && rec._powerCable) {
            try { rec._powerCable.container.destroy(); } catch (e) {}
            rec._powerCable = null;
        }
    } catch (e) {}
};

// Update cables for a given record; create if missing and animate according to record.flow
PrototypeScene.prototype._updateCablesForRecord = function (record) {
    if (!record) return;
    try {
        // Only handle externalGrid special boundary
        if (record.defKey !== 'externalGrid') return this._recomputeMachineStatuses();
        // compute endpoints: start at external grid center, end a few cells inward
        const start = this._getRecordCenter(record);
        // determine inward point (to the left) by one cell width times 3
        const gs = this._gridConfig;
        const inward = { x: start.x - (3 * gs.minor), y: start.y };

        // create cable if missing
        if (!record._powerCable) {
            record._powerCable = this._createPowerCable({ id: record.id, start, end: inward });
        }

        const pc = record._powerCable;
        if (!pc) return;

        // set symbol color based on flow sign
        const flow = record.flow || 0;
        let color = 0x9ca3af; // idle grey
        if (flow < 0) color = 0xffbf00; // amber importing
        else if (flow > 0) color = 0x39ff88; // green exporting

        // animate symbols along the cable
        const sx = pc.start.x, sy = pc.start.y, ex = pc.end.x, ey = pc.end.y;
        const dx = ex - sx, dy = ey - sy;
        const len = Math.sqrt(dx*dx + dy*dy);
        const duration = this._getPulseInterval(Math.abs(flow)) || 1200;
        for (let i=0;i<pc.symbols.length;i++){
            const img = pc.symbols[i];
            img.setTint(color);
            // stagger delay
            const delay = (i * (duration / pc.symbols.length));
            // compute direction: for importing (flow<0) animate from start->end; for exporting invert
            const from = (flow >= 0) ? { x: ex, y: ey } : { x: sx, y: sy };
            const to = (flow >= 0) ? { x: sx, y: sy } : { x: ex, y: ey };
            // Stop existing tween if any
            if (img._pulseTween) { try { img._pulseTween.stop(); } catch(e){} }
            img.x = from.x; img.y = from.y;
            img.alpha = (flow === 0) ? 0.25 : 0.95;
            img.rotation = Math.atan2(dy, dx);
            img._pulseTween = this.tweens.add({
                targets: img,
                x: { from: from.x, to: to.x },
                y: { from: from.y, to: to.y },
                duration: duration,
                delay: delay,
                ease: 'Linear',
                repeat: -1
            });
        }
        // also update machine status visual to show any warnings
        this._recomputeMachineStatuses();
    } catch (e) {
        console.warn('Failed to update cables for record', record, e);
    }
};

PrototypeScene.prototype._getPulseInterval = function (powerMW) {
    // Placeholder mapping; future scaling can use powerMW
    return 1100;
};

PrototypeScene.prototype.setDebugHubPowerMode = function (mode) {
    // Disabled — power UI removed
    this._recomputeMachineStatuses();
};

// Power indicator removed — no-op
PrototypeScene.prototype._renderPowerIndicator = function () { return; };

// Legacy occupancy tail removed; BuildingManager manages occupancy and record initialization.


const config = {
    type: Phaser.AUTO,
    parent: 'simulator-root',
    backgroundColor: '#0f172a',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PrototypeScene]
};

new Phaser.Game(config);

// Unresolved outputs donut chart renderer (independent from Phaser)
(function () {
    // Temporary chart weighting.
    // Future resource accounting will determine how solids, liquids and gases
    // are compared within the unresolved-output indicator.

    // Temporary equal weighting for source placeholders.
    // Future material accounting will calculate authoritative quantities
    // and determine how solids, liquids and gases contribute to the chart.
    let unresolvedOutputs = [
        { key: 'municipal-waste', name: 'Municipal Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'technology-waste', name: 'Technology Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'farm-waste', name: 'Farm Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'industrial-waste', name: 'Industrial Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'building-waste', name: 'Building Waste', phase: 'solid', amount: 100, unit: 't', chartValue: 100 },
        { key: 'sewerage', name: 'Sewerage', phase: 'liquid', amount: 100, unit: 'ML', chartValue: 100 }
    ];

    function getColorForKey(key, index) {
        // Stable colour mapping for known sources
        const map = {
            'municipal-waste': '#10b981',
            'technology-waste': '#3b82f6',
            'farm-waste': '#f59e0b',
            'industrial-waste': '#ef4444',
            'building-waste': '#8b5cf6',
            'sewerage': '#06b6d4'
        };
        if (map[key]) return map[key];
        const fallback = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        return fallback[index % fallback.length];
    }

    function calculateUnresolvedTotal(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce((sum, it) => {
            const v = Number(it && it.chartValue);
            if (!isFinite(v) || v <= 0) return sum;
            return sum + v;
        }, 0);
    }

    function setUnresolvedOutputs(items) {
        if (!Array.isArray(items)) items = [];
        unresolvedOutputs = items.slice();
        renderUnresolvedOutputsChart();
    }

    function renderUnresolvedOutputsChart() {
        const svgWrap = document.querySelector('#unresolved-output-chart svg');
        const totalEl = document.getElementById('unresolved-output-total');
        const legendEl = document.getElementById('unresolved-output-legend');

        if (!svgWrap || !totalEl || !legendEl) return;

        // Clear existing
        while (svgWrap.firstChild) svgWrap.removeChild(svgWrap.firstChild);
        legendEl.textContent = '';

        const valid = Array.isArray(unresolvedOutputs) ? unresolvedOutputs.filter(it => {
            if (!it) return false;
            const v = Number(it.chartValue);
            return isFinite(v) && v > 0;
        }) : [];

        const total = calculateUnresolvedTotal(unresolvedOutputs);

        const size = 160;
        const cx = size / 2;
        const cy = size / 2;
        const radius = 60;
        const stroke = 20;
        const circumference = 2 * Math.PI * radius;

        // Background ring
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', String(cx));
        bg.setAttribute('cy', String(cy));
        bg.setAttribute('r', String(radius));
        bg.setAttribute('fill', 'none');
        bg.setAttribute('stroke', 'rgba(255,255,255,0.06)');
        bg.setAttribute('stroke-width', String(stroke));
        svgWrap.appendChild(bg);

        let ariaParts = [];

        if (valid.length === 0 || total === 0) {
            // Empty state: show only background and centre text
            totalEl.querySelector('strong').textContent = '0';
            // ensure unit/text matches spec
            const span = totalEl.querySelector('span'); if (span) span.textContent = 'unresolved';
            const note = document.createElement('div');
            note.className = 'unresolved-empty';
            note.textContent = 'No unresolved outputs currently tracked';
            legendEl.appendChild(note);
            svgWrap.setAttribute('aria-label', 'Unresolved outputs chart: none');
            return;
        }

        // Create segments
        let offset = 0; // in length units along circumference
        valid.forEach((it, idx) => {
            const v = Number(it.chartValue);
            const frac = v / total;
            const segLen = circumference * frac;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', String(cx));
            circle.setAttribute('cy', String(cy));
            circle.setAttribute('r', String(radius));
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', getColorForKey(it.key || '', idx));
            circle.setAttribute('stroke-width', String(stroke));
            circle.setAttribute('stroke-linecap', 'butt');
            // stroke-dasharray: segment length followed by remainder (so segment shows as slice)
            circle.setAttribute('stroke-dasharray', `${segLen} ${circumference}`);
            // offset measured from start of circle; rotate so start at top
            circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
            // apply dashoffset as negative offset so subsequent segments are shifted
            circle.setAttribute('stroke-dashoffset', String(-offset));

            svgWrap.appendChild(circle);

            offset += segLen;

            // Build legend row
            const row = document.createElement('div');
            row.className = 'unresolved-legend-row';

            const color = document.createElement('div');
            color.className = 'unresolved-legend-color';
            color.style.background = getColorForKey(it.key || '', idx);
            row.appendChild(color);

            // Name + phase badge (top) and details (amount + percent) under the name
            const nameWrap = document.createElement('div');
            nameWrap.className = 'unresolved-legend-main';

            const nameRow = document.createElement('div');
            nameRow.style.display = 'flex';
            nameRow.style.alignItems = 'center';

            const name = document.createElement('div');
            name.className = 'unresolved-legend-name';
            name.textContent = it.name || it.key || 'Unknown';
            nameRow.appendChild(name);

            // phase badges removed per design — volume is shown in details

            nameWrap.appendChild(nameRow);

            const details = document.createElement('div');
            details.className = 'unresolved-legend-details';
            const amountText = (isFinite(Number(it.amount)) ? `${it.amount}${it.unit ? ' ' + it.unit : ''}` : '-');
            const pct = Math.round(frac * 100);
            details.textContent = amountText + ' ' + pct + '%';
            nameWrap.appendChild(details);

            row.appendChild(nameWrap);

            legendEl.appendChild(row);

            ariaParts.push(`${it.name || it.key || 'Unknown'}, ${amountText}, ${pct} percent`);
        });

        // Centre display: placeholder percentage until authoritative accounting exists
        const centreStrong = totalEl.querySelector('strong');
        const centreSpan = totalEl.querySelector('span');
        if (centreStrong) centreStrong.textContent = '100%';
        if (centreSpan) centreSpan.textContent = 'unresolved';

        // Accessibility label summarising resources
        svgWrap.setAttribute('aria-label', `Unresolved outputs chart: ${ariaParts.join('; ')}`);
        // Update power indicator UI if the simulator scene is available
        // Power indicator removed — no-op
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderUnresolvedOutputsChart);
    } else {
        renderUnresolvedOutputsChart();
    }

    // Expose setter globally so future code can update the chart
    window.setUnresolvedOutputs = setUnresolvedOutputs;
    window.calculateUnresolvedTotal = calculateUnresolvedTotal;
    window.renderUnresolvedOutputsChart = renderUnresolvedOutputsChart;
})();
