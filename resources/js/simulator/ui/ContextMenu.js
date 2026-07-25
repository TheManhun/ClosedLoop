export default class ContextMenu {
    constructor(options = {}) {
        this.options = Object.assign({}, options);
        this.el = document.getElementById('simulator-context-menu') || null;
        this._ensureElement();
    }

    _ensureElement() {
        if (this.el) return this.el;
        const el = document.createElement('div');
        el.id = 'simulator-context-menu';
        el.style.position = 'absolute';
        el.style.background = '#0b1220';
        el.style.color = '#fff';
        el.style.border = '1px solid rgba(255,255,255,0.08)';
        el.style.padding = '8px';
        el.style.zIndex = 10000;
        el.style.minWidth = '160px';
        el.style.display = 'none';
        el.style.fontSize = '13px';
        el.style.boxShadow = '0 6px 18px rgba(2,6,23,0.7)';
        document.body.appendChild(el);
        this.el = el;
        return el;
    }

    isVisible() {
        return Boolean(this.el && this.el.style.display !== 'none');
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

    _clampMenuPosition(x, y) {
        const menuEl = this.el;
        const root = document.getElementById('simulator-root');
        if (!root || !menuEl) return { x, y };
        const rect = root.getBoundingClientRect();
        const menuRect = menuEl.getBoundingClientRect();
        let left = x;
        let top = y;
        if (left + menuRect.width > rect.right) {
            left = Math.max(rect.left, rect.right - menuRect.width - 8);
        }
        if (top + menuRect.height > rect.bottom) {
            top = Math.max(rect.top, rect.bottom - menuRect.height - 8);
        }
        left = Math.max(8, left);
        top = Math.max(8, top);
        return { x: left, y: top };
    }

    show(record, clientX, clientY) {
        const el = this._ensureElement();
        el.innerHTML = '';

        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        if (record) {
            title.textContent = record.type || record.defKey || 'Building';
        } else {
            title.textContent = '';
        }
        if (title.textContent) el.appendChild(title);

        // Suggested next machines
        if (record && Array.isArray(record.suggestedNext) && record.suggestedNext.length > 0) {
            const sugLabel = document.createElement('div');
            sugLabel.style.marginBottom = '6px';
            sugLabel.textContent = 'Suggested Next Machine';
            el.appendChild(sugLabel);
            for (const s of record.suggestedNext) {
                const btn = document.createElement('button');
                btn.textContent = s.name || s.defKey || 'Suggested';
                btn.style.display = 'block';
                btn.style.width = '100%';
                btn.style.marginBottom = '6px';
                btn.onclick = () => { if (this.options.onSuggested) this.options.onSuggested(s.defKey); };
                el.appendChild(btn);
            }
        } else if (record) {
            const sugLabel = document.createElement('div');
            sugLabel.style.marginBottom = '6px';
            sugLabel.textContent = 'Suggested Next Machine';
            el.appendChild(sugLabel);
            const coming = document.createElement('div');
            coming.textContent = 'Coming Soon';
            coming.style.marginBottom = '6px';
            el.appendChild(coming);
        }

        // Delete option
        if (record && record.deletable) {
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete Building';
            delBtn.style.display = 'block';
            delBtn.style.width = '100%';
            delBtn.style.margin = '6px 0';
            delBtn.onclick = () => {
                if (this.options.onDelete) this.options.onDelete(record);
                this.hide();
            };
            el.appendChild(delBtn);
        }

        // Info button
        const infoBtn = document.createElement('button');
        infoBtn.textContent = 'Info';
        infoBtn.style.display = 'block';
        infoBtn.style.width = '100%';
        infoBtn.style.margin = '6px 0';
        infoBtn.onclick = () => { if (this.options.onInfo) this.options.onInfo(record); this.hide(); };
        el.appendChild(infoBtn);

        // Toolbar toggle
        const toolbarBtn = document.createElement('button');
        const toolbarVisible = this.options.isToolbarVisible ? this.options.isToolbarVisible() : true;
        toolbarBtn.textContent = toolbarVisible ? 'Hide Toolbar' : 'Show Toolbar';
        toolbarBtn.onclick = () => { if (this.options.onToggleToolbar) this.options.onToggleToolbar(); this.hide(); };
        el.appendChild(toolbarBtn);

        // Machine Status Colours toggle
        const statusBtn = document.createElement('button');
        const statusOn = this.options.isStatusOn ? this.options.isStatusOn() : true;
        statusBtn.textContent = statusOn ? 'Machine Status Colours: On' : 'Machine Status Colours: Off';
        statusBtn.style.display = 'block';
        statusBtn.style.width = '100%';
        statusBtn.style.margin = '6px 0';
        statusBtn.onclick = () => {
            if (this.options.onToggleStatus) this.options.onToggleStatus();
            this.hide();
        };
        el.appendChild(statusBtn);

        // Rotate / Upgrade placeholders (disabled if no handlers)
        const rotateBtn = document.createElement('button');
        rotateBtn.textContent = 'Rotate';
        rotateBtn.style.display = 'block';
        rotateBtn.style.width = '100%';
        rotateBtn.style.margin = '6px 0';
        rotateBtn.disabled = typeof this.options.onRotate !== 'function';
        rotateBtn.onclick = () => { if (this.options.onRotate) this.options.onRotate(record); this.hide(); };
        el.appendChild(rotateBtn);

        const upgradeBtn = document.createElement('button');
        upgradeBtn.textContent = 'Upgrade';
        upgradeBtn.style.display = 'block';
        upgradeBtn.style.width = '100%';
        upgradeBtn.style.margin = '6px 0';
        upgradeBtn.disabled = typeof this.options.onUpgrade !== 'function';
        upgradeBtn.onclick = () => { if (this.options.onUpgrade) this.options.onUpgrade(record); this.hide(); };
        el.appendChild(upgradeBtn);

        // Ensure selection/update callbacks are invoked
        if (record && this.options.onShowForRecord) this.options.onShowForRecord(record);

        el.style.display = 'block';
        requestAnimationFrame(() => {
            const pos = this._clampMenuPosition(clientX, clientY);
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';
        });
    }
}
