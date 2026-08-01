export default class MachineInfoPanel {
    constructor() {
        this.el = null;
        this._sectionStates = {
            summary: true,
            power: true,
            resources: false
        };
    }

    _create() {
        if (this.el) return this.el;

        const host = document.querySelector('.simulator-root-wrapper') || document.body;
        const el = document.createElement('aside');
        el.id = 'machine-info-panel';
        el.className = 'operations-centre';
        el.setAttribute('aria-label', 'Operations Centre');
        el.dataset.collapsed = 'false';

        const header = document.createElement('div');
        header.className = 'operations-centre-header';

        const titleBlock = document.createElement('div');
        titleBlock.className = 'operations-centre-title';
        const title = document.createElement('div');
        title.className = 'operations-centre-title-main';
        title.textContent = 'Operations Centre';
        const subtitle = document.createElement('div');
        subtitle.className = 'operations-centre-title-sub';
        subtitle.textContent = 'Live system overview';
        titleBlock.appendChild(title);
        titleBlock.appendChild(subtitle);

        const headerActions = document.createElement('div');
        headerActions.className = 'operations-centre-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'operations-centre-toggle';
        toggleBtn.type = 'button';
        toggleBtn.textContent = '▾';
        toggleBtn.addEventListener('click', () => this._setCollapsed(!this._isCollapsed()));
        headerActions.appendChild(toggleBtn);

        header.appendChild(titleBlock);
        header.appendChild(headerActions);

        const body = document.createElement('div');
        body.className = 'operations-centre-body';

        el.appendChild(header);
        el.appendChild(body);
        host.appendChild(el);

        this.el = el;
        return el;
    }

    _isCollapsed() {
        return this.el && this.el.dataset.collapsed === 'true';
    }

    _setCollapsed(collapsed) {
        if (!this.el) return;
        this.el.dataset.collapsed = collapsed ? 'true' : 'false';
        this.el.classList.toggle('is-collapsed', collapsed);
        const body = this.el.querySelector('.operations-centre-body');
        if (body) {
            body.style.display = collapsed ? 'none' : 'block';
        }
        const toggle = this.el.querySelector('.operations-centre-toggle');
        if (toggle) toggle.textContent = collapsed ? '▸' : '▾';
    }

    _categoryDisplay(c) {
        const map = {
            agriculture: 'Agriculture',
            process: 'Processing',
            infrastructure: 'Energy',
            'electrical infrastructure': 'Electrical',
            manufacturing: 'Manufacturing',
            recycling: 'Recycling',
            water: 'Water',
            storage: 'Storage',
            research: 'Research',
            source: 'Sources',
            transport: 'Transport',
            other: 'Other'
        };
        return map[c] || (c || 'Other');
    }

    _normalizeMachine(machine) {
        const normalized = Object.assign({}, machine);
        if (normalized.powerRequired !== undefined) normalized.power_required = normalized.powerRequired;
        if (normalized.waterRequired !== undefined) normalized.water_required = normalized.waterRequired;
        if (normalized.powerProduced !== undefined) normalized.power_produced = normalized.powerProduced;
        if (normalized.waterProduced !== undefined) normalized.water_produced = normalized.waterProduced;
        if (normalized.heatProduced !== undefined) normalized.heat_produced = normalized.heatProduced;
        if (normalized.co2Produced !== undefined) normalized.co2_produced = normalized.co2Produced;

        if ((Array.isArray(normalized.inputs) && normalized.inputs.length) || (Array.isArray(normalized.outputs) && normalized.outputs.length)) {
            const resources = [];
            if (Array.isArray(normalized.inputs)) {
                for (const it of normalized.inputs) {
                    resources.push({ direction: 'input', name: it.resourceId || it.name || '', amount: it.quantity ?? it.amount, unit: it.units ?? it.unit, resourceId: it.resourceId });
                }
            }
            if (Array.isArray(normalized.outputs)) {
                for (const it of normalized.outputs) {
                    resources.push({ direction: 'output', name: it.resourceId || it.name || '', amount: it.quantity ?? it.amount, unit: it.units ?? it.unit, resourceId: it.resourceId });
                }
            }
            normalized.resources = resources;
        }

        if (Array.isArray(normalized.references) && normalized.references.length) {
            normalized.links = normalized.references.map((r) => ({ title: r, url: null }));
        }
        return normalized;
    }

    _getSystemSnapshot() {
        const scene = window.__simulatorScene;
        const buildingManager = scene && scene._buildingManager;
        const connectionManager = scene && scene._connectionManager;
        const machines = buildingManager ? buildingManager.getPlacedMachines() : [];
        const connections = connectionManager ? connectionManager.getAll() : [];
        const powerConnections = connections.filter((conn) => conn && conn.type === 'power').length;
        const boards = machines.filter((record) => record && (record.defKey === 'distributionBoard' || record.type === 'power_distribution')).length;
        return { machines: machines.length, connections: connections.length, powerConnections, boards };
    }

    _buildSection(key, title, summary, content, expanded = true) {
        const section = document.createElement('section');
        section.className = 'operations-centre-section';

        const heading = document.createElement('button');
        heading.type = 'button';
        heading.className = 'operations-centre-section-heading';
        heading.dataset.section = key;
        heading.innerHTML = `<span class="operations-centre-section-title">${title}</span><span class="operations-centre-section-summary">${summary}</span><span class="operations-centre-chevron">▾</span>`;
        heading.addEventListener('click', () => {
            const isExpanded = this._sectionStates[key] !== false;
            this._sectionStates[key] = !isExpanded;
            this._refreshSectionState(section, heading, content, key);
        });

        const body = document.createElement('div');
        body.className = 'operations-centre-section-body';
        body.appendChild(content);

        section.appendChild(heading);
        section.appendChild(body);
        this._sectionStates[key] = this._sectionStates[key] ?? expanded;
        this._refreshSectionState(section, heading, body, key);
        return section;
    }

    _refreshSectionState(section, heading, body, key) {
        const expanded = this._sectionStates[key] !== false;
        section.classList.toggle('is-collapsed', !expanded);
        body.style.display = expanded ? 'block' : 'none';
        const chevron = heading.querySelector('.operations-centre-chevron');
        if (chevron) {
            chevron.textContent = expanded ? '▾' : '▸';
        }
        const summary = heading.querySelector('.operations-centre-section-summary');
        if (summary && !expanded) {
            summary.textContent = summary.dataset.short || summary.textContent;
        }
    }

    _makeRow(label, value, modifier = '') {
        const row = document.createElement('div');
        row.className = `operations-centre-row ${modifier}`.trim();
        const labelEl = document.createElement('span');
        labelEl.className = 'operations-centre-row-label';
        labelEl.textContent = label;
        const valueEl = document.createElement('strong');
        valueEl.className = 'operations-centre-row-value';
        valueEl.textContent = value;
        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
    }

    _renderDonutChart(percent) {
        const wrapper = document.createElement('div');
        wrapper.className = 'operations-centre-chart';
        wrapper.style.background = `conic-gradient(#34d399 0 ${percent}%, #3b82f6 ${percent}% ${percent + 17}%, #f59e0b ${percent + 17}% ${percent + 34}%, #ef4444 ${percent + 34}% ${percent + 51}%, #8b5cf6 ${percent + 51}% ${percent + 68}%, #06b6d4 ${percent + 68}% 100%)`;
        const inner = document.createElement('div');
        inner.className = 'operations-centre-chart-inner';
        inner.innerHTML = '<strong>100%</strong><span>unresolved</span>';
        wrapper.appendChild(inner);
        return wrapper;
    }

    _renderCurrentView(machine, record) {
        if (!this.el) return;
        const body = this.el.querySelector('.operations-centre-body');
        if (!body) return;
        body.innerHTML = '';

        const normalized = this._normalizeMachine(machine || {});
        const snapshot = this._getSystemSnapshot();

        const summaryContent = document.createElement('div');
        summaryContent.className = 'operations-centre-section-content';

        const chartWrap = document.createElement('div');
        chartWrap.className = 'operations-centre-chart-wrap';
        chartWrap.appendChild(this._renderDonutChart(100));
        summaryContent.appendChild(chartWrap);

        const summaryText = document.createElement('div');
        summaryText.className = 'operations-centre-summary-text';
        summaryText.innerHTML = `<div><strong>${normalized.name || 'System Overview'}</strong></div><div>${normalized.description || 'Monitoring the active simulator state.'}</div>`;
        summaryContent.appendChild(summaryText);

        const statList = document.createElement('div');
        statList.className = 'operations-centre-stat-list';
        statList.appendChild(this._makeRow('Machines', String(snapshot.machines)));
        statList.appendChild(this._makeRow('Connections', String(snapshot.connections)));
        statList.appendChild(this._makeRow('Power links', String(snapshot.powerConnections)));
        statList.appendChild(this._makeRow('Boards', String(snapshot.boards)));
        summaryContent.appendChild(statList);
        body.appendChild(this._buildSection('summary', 'System Summary', machine ? 'Live view' : 'Overall', summaryContent, true));

        const powerContent = document.createElement('div');
        powerContent.className = 'operations-centre-section-content';
        powerContent.appendChild(this._makeRow('Internal generation', '0.0 MW'));
        powerContent.appendChild(this._makeRow('Machine demand', '0.0 MW'));
        powerContent.appendChild(this._makeRow('Grid import', '0.0 MW'));
        powerContent.appendChild(this._makeRow('Grid export', '0.0 MW'));
        powerContent.appendChild(this._makeRow('Net power', '0.0 MW'));
        powerContent.appendChild(this._makeRow('Self-sufficiency', 'No demand'));

        const bars = document.createElement('div');
        bars.className = 'operations-centre-bars';
        const barRow = (label, value) => {
            const row = document.createElement('div');
            row.className = 'operations-centre-bar-row';
            const head = document.createElement('span');
            head.textContent = label;
            const track = document.createElement('div');
            track.className = 'operations-centre-bar-track';
            const fill = document.createElement('div');
            fill.className = 'operations-centre-bar-fill';
            fill.style.width = `${Math.max(12, Math.min(100, Number(value) || 0))}%`;
            track.appendChild(fill);
            row.appendChild(head);
            row.appendChild(track);
            return row;
        };
        bars.appendChild(barRow('Generation', 42));
        bars.appendChild(barRow('Demand', 36));
        powerContent.appendChild(bars);
        body.appendChild(this._buildSection('power', 'Power Balance', 'Balanced', powerContent, true));

        const resourceItems = Array.isArray(normalized.resources) && normalized.resources.length
            ? normalized.resources.map((item) => ({ name: item.name || 'Resource', amount: item.amount != null ? `${item.amount}${item.unit ? ` ${item.unit}` : ''}` : '—', percent: '—', color: '#60a5fa' }))
            : [
                { name: 'Municipal Waste', amount: '100 t', percent: '17%', color: '#10b981' },
                { name: 'Technology Waste', amount: '100 t', percent: '17%', color: '#3b82f6' },
                { name: 'Farm Waste', amount: '100 t', percent: '17%', color: '#f59e0b' },
                { name: 'Industrial Waste', amount: '100 t', percent: '17%', color: '#ef4444' },
                { name: 'Building Waste', amount: '100 t', percent: '17%', color: '#8b5cf6' },
                { name: 'Sewerage', amount: '100 ML', percent: '17%', color: '#06b6d4' }
            ];

        const resourcesContent = document.createElement('div');
        resourcesContent.className = 'operations-centre-section-content';
        const resourceList = document.createElement('div');
        resourceList.className = 'operations-centre-resource-list';
        resourceItems.slice(0, 6).forEach((item) => {
            const row = document.createElement('div');
            row.className = 'operations-centre-resource-row';
            const marker = document.createElement('span');
            marker.className = 'operations-centre-resource-marker';
            marker.style.background = item.color;
            const label = document.createElement('span');
            label.className = 'operations-centre-resource-name';
            label.textContent = item.name;
            const meta = document.createElement('span');
            meta.className = 'operations-centre-resource-meta';
            meta.textContent = `${item.amount} · ${item.percent}`;
            row.appendChild(marker);
            row.appendChild(label);
            row.appendChild(meta);
            resourceList.appendChild(row);
        });
        resourcesContent.appendChild(resourceList);
        body.appendChild(this._buildSection('resources', 'Resources', `${resourceItems.length}`, resourcesContent, false));
    }

    show(machine, record) {
        if (!this.el) this._create();
        this.el.style.display = 'flex';
        this._renderCurrentView(machine, record);
    }

    update(machine) {
        if (!this.el) return;
        this.show(machine);
    }

    clear() {
        if (!this.el) return;
        this.el.querySelector('.operations-centre-body').innerHTML = '';
        this._renderCurrentView(null, null);
    }

    hide() {
        if (!this.el) return;
        this.el.style.display = 'none';
    }

    destroy() {
        if (!this.el) return;
        try { this.el.remove(); } catch (e) {}
        this.el = null;
    }
}
