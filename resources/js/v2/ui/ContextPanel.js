export default class ContextPanel {
  constructor({ eventBus, technology } = {}) {
    this.eventBus = eventBus;
    this.technology = technology;
    this._el = null;
    this._mounted = false;
    this._bound = {};
    this.mountId = 'closed-loop-v2-ui';
    this._currentResource = null;
    this._view = 'recommended';
    this._selectedMachineId = null;
    this._catalogueCategory = 'All Categories';
    this._catalogueSearch = '';
  }

  initialise() {
    if (this._mounted) return;
    if (typeof document === 'undefined') return;
    const root = document.getElementById(this.mountId);
    if (!root) return;

    const el = document.createElement('div');
    el.className = 'v2-context-panel';
    el.style.position = 'relative';
    el.style.padding = '8px 10px';
    el.style.width = 'min(320px, calc(100vw - 32px))';
    el.style.maxWidth = '320px';
    el.style.background = 'rgba(10,12,16,0.85)';
    el.style.color = '#e6eef8';
    el.style.borderRadius = '8px';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.3';
    el.style.boxSizing = 'border-box';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
    el.style.display = 'none';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '22';
    el.style.margin = '0';
    el.setAttribute('aria-live', 'polite');

    root.appendChild(el);
    this._el = el;

    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._bound.onSelection = (p) => this._onSelectionChanged(p);
      this.eventBus.on('selection:changed', this._bound.onSelection);
    }

    this._mounted = true;
  }

  _getMachineImage(machine) {
    const src = machine && (machine.image || machine.image_url || machine.icon || null);
    if (!src || typeof src !== 'string' || src.trim() === '') return null;
    const img = document.createElement('img');
    img.src = src;
    img.alt = machine.name || 'Machine';
    img.style.width = '28px';
    img.style.height = '28px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    img.style.flexShrink = '0';
    return img;
  }

  _getResourceId(resourceMeta) {
    const resource = (resourceMeta && (resourceMeta.resource || resourceMeta.resource_canonical)) || {};
    return resourceMeta && (resourceMeta.resource_id ?? resource.id ?? null) != null ? (resourceMeta.resource_id ?? resource.id ?? null) : null;
  }

  _getCompatibleMachines(resourceId) {
    if (this.technology && typeof this.technology.getCompatibleMachinesForResource === 'function') {
      return this.technology.getCompatibleMachinesForResource(resourceId || null) || [];
    }
    return [];
  }

  _getAllMachines() {
    try {
      if (this.technology && this.technology.dataLoader && typeof this.technology.dataLoader.getMachines === 'function') {
        return this.technology.dataLoader.getMachines() || [];
      }
      if (this.technology && typeof this.technology.getMachines === 'function') {
        return this.technology.getMachines() || [];
      }
    } catch (e) {}
    return [];
  }

  _makeActionButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = label;
    btn.style.marginTop = '8px';
    btn.style.padding = '6px 8px';
    btn.style.border = '1px solid rgba(255,255,255,0.2)';
    btn.style.borderRadius = '6px';
    btn.style.background = 'rgba(255,255,255,0.04)';
    btn.style.color = '#e6eef8';
    btn.style.cursor = 'pointer';
    btn.onclick = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      onClick();
    };
    return btn;
  }

  _createBoundedCatalogue(list) {
    const container = document.createElement('div');
    container.className = 'v2-context-catalogue';
    const viewportHeight = typeof window !== 'undefined' && typeof window.innerHeight === 'number' ? window.innerHeight : 900;
    const maxHeight = Math.min(300, Math.max(180, viewportHeight - 280));
    container.style.maxHeight = `${maxHeight}px`;
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.marginTop = '6px';
    container.style.paddingRight = '4px';
    container.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    container.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
    container.style.scrollbarWidth = 'thin';
    container.style.msOverflowStyle = 'auto';
    container.appendChild(list);
    return container;
  }

  _renderMachineCard(machine, selected = false) {
    const card = document.createElement('div');
    card.className = 'v2-context-machine-card';
    card.style.padding = '8px';
    card.style.borderRadius = '6px';
    card.style.background = selected ? 'rgba(125, 211, 252, 0.12)' : 'rgba(255,255,255,0.04)';
    card.style.border = selected ? '1px solid rgba(125, 211, 252, 0.7)' : '1px solid transparent';
    card.style.display = 'flex';
    card.style.gap = '8px';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.gap = '8px';
    left.style.alignItems = 'center';
    left.style.flex = '1';

    const img = this._getMachineImage(machine);
    if (img) left.appendChild(img);

    const meta = document.createElement('div');
    meta.style.display = 'flex';
    meta.style.flexDirection = 'column';
    meta.style.gap = '2px';
    const name = document.createElement('div');
    name.style.fontWeight = '600';
    name.innerText = machine && machine.name ? machine.name : `Machine ${machine && machine.id ? machine.id : ''}`;
    const cat = document.createElement('div');
    cat.style.fontSize = '12px';
    cat.style.opacity = '0.85';
    cat.innerText = machine && machine.category ? machine.category : 'Uncategorised';
    meta.appendChild(name);
    meta.appendChild(cat);
    left.appendChild(meta);

    const button = this._makeActionButton(selected ? 'Selected' : 'Select', () => {
      const selectedMachine = machine || null;
      this._selectedMachineId = selectedMachine && (selectedMachine.id ?? selectedMachine.machine_id ?? null);
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('technology:selected', {
          machine: selectedMachine,
          resource: this._currentResource || null,
          mode: this._view,
        });
      }
      this._renderCurrent();
    });
    button.style.flexShrink = '0';

    card.appendChild(left);
    card.appendChild(button);
    return card;
  }

  _getSortedUniqueCategories(machines = []) {
    const categories = new Set();
    for (const machine of machines) {
      const value = machine && (machine.category || machine.category_name || null);
      if (value == null) continue;
      const text = String(value).trim();
      if (text === '') continue;
      categories.add(text);
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  _getMachineSearchText(machine) {
    if (!machine) return '';
    const values = [];
    const pushValue = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        for (const item of value) pushValue(item);
        return;
      }
      const text = String(value).trim();
      if (text !== '') values.push(text);
    };

    pushValue(machine.name);
    pushValue(machine.category);
    pushValue(machine.category_name);
    pushValue(machine.search_terms);
    pushValue(machine.keywords);
    pushValue(machine.tags);
    return values.join(' ').toLowerCase();
  }

  _getFilteredCatalogueMachines() {
    const allMachines = this._getAllMachines();
    const searchTerm = (this._catalogueSearch || '').trim().toLowerCase();
    const category = this._catalogueCategory || 'All Categories';

    return allMachines.filter((machine) => {
      const categoryValue = machine && (machine.category || machine.category_name || null);
      const matchesCategory = category === 'All Categories' || (categoryValue != null && String(categoryValue).trim() === String(category).trim());
      if (!matchesCategory) return false;

      if (!searchTerm) return true;

      const haystack = this._getMachineSearchText(machine);
      return haystack.includes(searchTerm);
    });
  }

  _renderMachineList(resourceMeta, recommendedMachines = [], allMachines = []) {
    if (!this._el) return;
    this._el.innerText = '';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '4px';
    title.innerText = resourceMeta.display_name || (resourceMeta.resource && resourceMeta.resource.name) || 'Resource';

    const qty = document.createElement('div');
    qty.style.fontSize = '12px';
    qty.style.opacity = '0.9';
    if (resourceMeta.current_quantity || resourceMeta.initial_quantity) {
      const q = resourceMeta.current_quantity ?? resourceMeta.initial_quantity;
      qty.innerText = `Quantity: ${q} ${resourceMeta.unit || ''}`;
    }

    const recommendationsHeading = document.createElement('div');
    recommendationsHeading.style.fontWeight = '600';
    recommendationsHeading.style.marginTop = '8px';
    recommendationsHeading.style.marginBottom = '4px';
    recommendationsHeading.innerText = 'RECOMMENDED TECHNOLOGIES';

    const recommendedList = document.createElement('div');
    recommendedList.style.display = 'flex';
    recommendedList.style.flexDirection = 'column';
    recommendedList.style.gap = '8px';

    for (const machine of recommendedMachines) {
      const selected = Number(this._selectedMachineId) === Number(machine && (machine.id ?? machine.machine_id ?? null));
      recommendedList.appendChild(this._renderMachineCard(machine, selected));
    }

    const toggleButton = this._makeActionButton(this._view === 'all' ? 'Hide All Technologies ▲' : 'Show All Technologies ▼', () => {
      this._view = this._view === 'all' ? 'recommended' : 'all';
      this._renderCurrent();
    });
    toggleButton.style.marginTop = '10px';
    toggleButton.style.marginBottom = '10px';

    this._el.appendChild(title);
    if (qty.innerText) this._el.appendChild(qty);
    this._el.appendChild(recommendationsHeading);
    this._el.appendChild(recommendedList);
    this._el.appendChild(toggleButton);

    if (this._view === 'all') {
      const divider = document.createElement('div');
      divider.style.borderTop = '1px solid rgba(255,255,255,0.12)';
      divider.style.margin = '8px 0 6px';
      divider.style.paddingTop = '8px';

      const allHeading = document.createElement('div');
      allHeading.style.fontWeight = '600';
      allHeading.style.marginBottom = '6px';
      allHeading.innerText = 'ALL TECHNOLOGIES';

      const filterLabel = document.createElement('div');
      filterLabel.style.fontSize = '12px';
      filterLabel.style.opacity = '0.9';
      filterLabel.style.marginBottom = '4px';
      filterLabel.innerText = 'Category';

      const select = document.createElement('select');
      select.className = 'v2-context-category-select';
      select.style.width = '100%';
      select.style.padding = '6px 8px';
      select.style.borderRadius = '6px';
      select.style.border = '1px solid rgba(255,255,255,0.2)';
      select.style.background = 'rgba(8,10,15,0.7)';
      select.style.color = '#e6eef8';
      select.style.marginBottom = '8px';

      const categories = this._getSortedUniqueCategories(allMachines);
      const options = ['All Categories', ...categories];
      for (const optionValue of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.innerText = optionValue;
        if (optionValue === this._catalogueCategory) option.selected = true;
        select.appendChild(option);
      }

      select.onchange = (event) => {
        const value = event && event.target ? event.target.value : 'All Categories';
        this._catalogueCategory = value || 'All Categories';
        this._renderCurrent();
      };

      const searchLabel = document.createElement('div');
      searchLabel.style.fontSize = '12px';
      searchLabel.style.opacity = '0.9';
      searchLabel.style.marginTop = '4px';
      searchLabel.style.marginBottom = '4px';
      searchLabel.innerText = 'Search';

      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.value = this._catalogueSearch || '';
      searchInput.placeholder = 'Search technologies...';
      searchInput.style.width = '100%';
      searchInput.style.padding = '6px 8px';
      searchInput.style.borderRadius = '6px';
      searchInput.style.border = '1px solid rgba(255,255,255,0.2)';
      searchInput.style.background = 'rgba(8,10,15,0.7)';
      searchInput.style.color = '#e6eef8';
      searchInput.style.boxSizing = 'border-box';
      searchInput.style.marginBottom = '8px';
      searchInput.oninput = (event) => {
        const value = event && event.target ? event.target.value : '';
        this._catalogueSearch = typeof value === 'string' ? value : '';
        this._renderCurrent();
      };

      const catalogueMachines = this._getFilteredCatalogueMachines();
      const allList = document.createElement('div');
      allList.style.display = 'flex';
      allList.style.flexDirection = 'column';
      allList.style.gap = '8px';

      if (!catalogueMachines.length) {
        const noMatch = document.createElement('div');
        noMatch.style.fontSize = '12px';
        noMatch.style.opacity = '0.85';
        noMatch.style.padding = '8px 0';
        noMatch.innerText = 'No technologies match your filters.';
        allList.appendChild(noMatch);
      } else {
        for (const machine of catalogueMachines) {
          const selected = Number(this._selectedMachineId) === Number(machine && (machine.id ?? machine.machine_id ?? null));
          allList.appendChild(this._renderMachineCard(machine, selected));
        }
      }

      this._el.appendChild(divider);
      this._el.appendChild(allHeading);
      this._el.appendChild(filterLabel);
      this._el.appendChild(select);
      this._el.appendChild(searchLabel);
      this._el.appendChild(searchInput);
      this._el.appendChild(this._createBoundedCatalogue(allList));
    }

    this._el.style.display = 'block';
  }

  _renderNoMatches() {
    if (!this._el) return;
    this._el.innerText = '';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.innerText = (this._currentResource && (this._currentResource.display_name || (this._currentResource.resource && this._currentResource.resource.name))) || 'Resource';

    const heading = document.createElement('div');
    heading.style.fontWeight = '600';
    heading.style.marginTop = '10px';
    heading.style.marginBottom = '6px';
    heading.innerText = 'RECOMMENDED TECHNOLOGIES';

    const body = document.createElement('div');
    body.style.marginTop = '6px';
    body.innerText = 'No compatible technologies defined yet.';

    const allMachines = this._getAllMachines();
    const toggleLabel = this._view === 'all' ? 'Hide All Technologies ▲' : 'Show All Technologies ▼';
    const toggleButton = this._makeActionButton(toggleLabel, () => {
      this._view = this._view === 'all' ? 'recommended' : 'all';
      this._renderCurrent();
    });
    toggleButton.style.marginTop = '10px';
    toggleButton.style.marginBottom = '10px';

    this._el.appendChild(title);
    this._el.appendChild(heading);
    this._el.appendChild(body);
    this._el.appendChild(toggleButton);

    if (this._view === 'all' && allMachines.length > 0) {
      const divider = document.createElement('div');
      divider.style.borderTop = '1px solid rgba(255,255,255,0.12)';
      divider.style.margin = '12px 0 8px';

      const allHeading = document.createElement('div');
      allHeading.style.fontWeight = '600';
      allHeading.style.marginBottom = '6px';
      allHeading.innerText = 'ALL TECHNOLOGIES';

      const filterLabel = document.createElement('div');
      filterLabel.style.fontSize = '12px';
      filterLabel.style.opacity = '0.9';
      filterLabel.style.marginBottom = '4px';
      filterLabel.innerText = 'Category';

      const select = document.createElement('select');
      select.className = 'v2-context-category-select';
      select.style.width = '100%';
      select.style.padding = '6px 8px';
      select.style.borderRadius = '6px';
      select.style.border = '1px solid rgba(255,255,255,0.2)';
      select.style.background = 'rgba(8,10,15,0.7)';
      select.style.color = '#e6eef8';
      select.style.marginBottom = '8px';

      const categories = this._getSortedUniqueCategories(allMachines);
      const options = ['All Categories', ...categories];
      for (const optionValue of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.innerText = optionValue;
        if (optionValue === this._catalogueCategory) option.selected = true;
        select.appendChild(option);
      }

      select.onchange = (event) => {
        const value = event && event.target ? event.target.value : 'All Categories';
        this._catalogueCategory = value || 'All Categories';
        this._renderCurrent();
      };

      const searchLabel = document.createElement('div');
      searchLabel.style.fontSize = '12px';
      searchLabel.style.opacity = '0.9';
      searchLabel.style.marginTop = '4px';
      searchLabel.style.marginBottom = '4px';
      searchLabel.innerText = 'Search';

      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.value = this._catalogueSearch || '';
      searchInput.placeholder = 'Search technologies...';
      searchInput.style.width = '100%';
      searchInput.style.padding = '6px 8px';
      searchInput.style.borderRadius = '6px';
      searchInput.style.border = '1px solid rgba(255,255,255,0.2)';
      searchInput.style.background = 'rgba(8,10,15,0.7)';
      searchInput.style.color = '#e6eef8';
      searchInput.style.boxSizing = 'border-box';
      searchInput.style.marginBottom = '8px';
      searchInput.oninput = (event) => {
        const value = event && event.target ? event.target.value : '';
        this._catalogueSearch = typeof value === 'string' ? value : '';
        this._renderCurrent();
      };

      const allList = document.createElement('div');
      allList.style.display = 'flex';
      allList.style.flexDirection = 'column';
      allList.style.gap = '8px';
      const filteredMachines = this._getFilteredCatalogueMachines();
      if (!filteredMachines.length) {
        const noMatch = document.createElement('div');
        noMatch.style.fontSize = '12px';
        noMatch.style.opacity = '0.85';
        noMatch.style.padding = '8px 0';
        noMatch.innerText = 'No technologies match your filters.';
        allList.appendChild(noMatch);
      } else {
        for (const machine of filteredMachines) {
          allList.appendChild(this._renderMachineCard(machine, false));
        }
      }

      this._el.appendChild(divider);
      this._el.appendChild(allHeading);
      this._el.appendChild(filterLabel);
      this._el.appendChild(select);
      this._el.appendChild(searchLabel);
      this._el.appendChild(searchInput);
      this._el.appendChild(this._createBoundedCatalogue(allList));
    }

    this._el.style.display = 'block';
  }

  _renderCurrent() {
    if (!this._el || !this._currentResource) {
      this._el && (this._el.style.display = 'none');
      return;
    }

    const resourceId = this._getResourceId(this._currentResource);
    const compatibleMachines = this._getCompatibleMachines(resourceId) || [];
    const allMachines = this._getAllMachines();

    if (this._view === 'all') {
      this._renderMachineList(this._currentResource, compatibleMachines, allMachines);
      return;
    }

    if (!compatibleMachines.length) {
      this._renderNoMatches();
      return;
    }

    this._renderMachineList(this._currentResource, compatibleMachines, allMachines);
  }

  _onSelectionChanged(payload) {
    try {
      if (!this._el) return;
      if (!payload || payload.kind == null) {
        this._el.style.display = 'none';
        this._el.innerText = '';
        return;
      }

      if (payload.kind === 'resource') {
        this._currentResource = payload.meta || {};
        this._selectedMachineId = null;
        this._view = 'recommended';
        this._catalogueCategory = 'All Categories';
        this._catalogueSearch = '';
        this._renderCurrent();
        return;
      }

      this._el.style.display = 'none';
      this._el.innerText = '';
      this._currentResource = null;
    } catch (e) {
      // noop
    }
  }

  destroy() {
    try {
      if (this.eventBus && typeof this.eventBus.off === 'function' && this._bound.onSelection) {
        this.eventBus.off('selection:changed', this._bound.onSelection);
      }
    } catch (e) {}
    try { if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el); } catch (e) {}
    this._el = null;
    this._mounted = false;
    this._currentResource = null;
    this._view = 'recommended';
    this._selectedMachineId = null;
  }
}
