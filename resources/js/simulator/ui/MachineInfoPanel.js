export default class MachineInfoPanel {
    constructor() {
        this.el = null;
    }

    _create() {
        if (this.el) return this.el;
        const el = document.createElement('div');
        el.id = 'machine-info-panel';
        el.style.position = 'absolute';
        el.style.right = '12px';
        el.style.top = '12px';
        el.style.zIndex = 20000;
        el.style.minWidth = '280px';
        el.style.maxWidth = '420px';
        el.style.background = 'rgba(8,12,18,0.95)';
        el.style.color = '#fff';
        el.style.padding = '12px';
        el.style.borderRadius = '8px';
        el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        el.style.fontSize = '13px';
        el.style.display = 'none';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '8px';
        closeBtn.style.padding = '4px 8px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', () => { el.style.display = 'none'; });
        el.appendChild(closeBtn);

        document.body.appendChild(el);
        this.el = el;
        return el;
    }

    show(machine, record) {
        if (!machine) return;
        const panel = this._create();
        panel.innerHTML = '';
        // Title
        const title = document.createElement('div');
        title.style.fontSize = '16px';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        title.textContent = machine.name || 'Machine';
        panel.appendChild(title);

        if (machine.description) {
            const desc = document.createElement('div');
            desc.style.marginBottom = '8px';
            desc.textContent = machine.description;
            panel.appendChild(desc);
        }

        const meta = document.createElement('div');
        meta.style.marginBottom = '8px';
        meta.innerHTML = '<strong>Category:</strong> ' + (machine.category || '—');
        panel.appendChild(meta);

        const pw = document.createElement('div');
        pw.style.marginBottom = '8px';
        pw.innerHTML = '<strong>Power required:</strong> ' + (machine.power_required ?? '—') + '<br/><strong>Water required:</strong> ' + (machine.water_required ?? '—');
        panel.appendChild(pw);

        const resources = Array.isArray(machine.resources) ? machine.resources : [];
        const inputs = resources.filter(r => (r.direction || '').toString().toLowerCase() === 'input');
        const outputs = resources.filter(r => (r.direction || '').toString().toLowerCase() === 'output');

        const listSection = document.createElement('div');
        listSection.style.marginBottom = '8px';

        const inHeader = document.createElement('div'); inHeader.style.fontWeight = '600'; inHeader.textContent = 'Inputs';
        listSection.appendChild(inHeader);
        if (!inputs.length) {
            const none = document.createElement('div'); none.style.marginTop = '6px'; none.textContent = 'No inputs recorded.'; listSection.appendChild(none);
        } else {
            const ul = document.createElement('ul'); ul.style.marginTop = '6px'; ul.style.marginBottom = '8px';
            for (const it of inputs) {
                const li = document.createElement('li');
                const name = it.name || 'Resource';
                const amountUnit = (it.amount !== undefined && it.amount !== null) ? (String(it.amount) + (it.unit ? (' ' + it.unit) : '')) : '';
                li.textContent = name + (amountUnit ? (' — ' + amountUnit) : '');
                if (it.category) { const cat = document.createElement('div'); cat.style.fontSize='12px'; cat.style.opacity=0.9; cat.textContent = it.category; li.appendChild(cat); }
                if (it.description) { const d = document.createElement('div'); d.style.fontSize='13px'; d.style.marginTop='4px'; d.textContent = it.description; li.appendChild(d); }
                ul.appendChild(li);
            }
            listSection.appendChild(ul);
        }

        const outHeader = document.createElement('div'); outHeader.style.fontWeight = '600'; outHeader.textContent = 'Outputs';
        listSection.appendChild(outHeader);
        if (!outputs.length) {
            const none = document.createElement('div'); none.style.marginTop = '6px'; none.textContent = 'No outputs recorded.'; listSection.appendChild(none);
        } else {
            const ul2 = document.createElement('ul'); ul2.style.marginTop = '6px'; ul2.style.marginBottom = '8px';
            for (const it of outputs) {
                const li = document.createElement('li');
                const name = it.name || 'Resource';
                const amountUnit = (it.amount !== undefined && it.amount !== null) ? (String(it.amount) + (it.unit ? (' ' + it.unit) : '')) : '';
                li.textContent = name + (amountUnit ? (' — ' + amountUnit) : '');
                if (it.category) { const cat = document.createElement('div'); cat.style.fontSize='12px'; cat.style.opacity=0.9; cat.textContent = it.category; li.appendChild(cat); }
                if (it.description) { const d = document.createElement('div'); d.style.fontSize='13px'; d.style.marginTop='4px'; d.textContent = it.description; li.appendChild(d); }
                ul2.appendChild(li);
            }
            listSection.appendChild(ul2);
        }

        panel.appendChild(listSection);

        if (machine.links && machine.links.length) {
            const h = document.createElement('div'); h.style.fontWeight='600'; h.textContent='Research/Links'; panel.appendChild(h);
            for (const ln of machine.links) {
                const row = document.createElement('div'); row.style.marginTop = '8px';
                const t = document.createElement('div'); t.style.fontWeight='600'; t.textContent = ln.title || 'Link'; row.appendChild(t);
                const org = document.createElement('div'); org.style.fontSize='12px'; org.style.opacity=0.9; org.textContent = ln.organisation || ''; row.appendChild(org);
                const verified = document.createElement('div'); verified.style.fontSize='12px'; verified.style.marginTop='4px'; verified.innerHTML = (ln.verified ? '<span style="color:#38b000">✓ Verified</span>' : '<span style="color:#9aa0a6">Unverified</span>'); row.appendChild(verified);
                if (ln.description) { const d = document.createElement('div'); d.style.marginTop='6px'; d.style.fontSize='13px'; d.textContent = ln.description; row.appendChild(d); }
                const btn = document.createElement('button'); btn.textContent = 'Open Link'; btn.style.marginTop='6px'; btn.onclick = () => { if (ln.url) window.open(ln.url, '_blank'); }; row.appendChild(btn);
                panel.appendChild(row);
            }
        }

        const techs = (machine.technologies || []);
        const techSection = document.createElement('div');
        techSection.style.marginTop = '8px';
        const techHeader = document.createElement('div'); techHeader.style.fontWeight = '600'; techHeader.textContent = 'Technologies'; techSection.appendChild(techHeader);
        if (!techs.length) {
            const none = document.createElement('div'); none.style.marginTop = '6px'; none.textContent = 'No technologies recorded.'; techSection.appendChild(none);
        } else {
            for (const t of techs) {
                const row = document.createElement('div'); row.style.marginTop = '8px';
                const name = document.createElement('div'); name.style.fontWeight='700'; name.textContent = t.name || 'Technology'; row.appendChild(name);
                const meta = document.createElement('div'); meta.style.fontSize='13px'; meta.style.opacity=0.95; meta.innerHTML = '<strong>Role:</strong> ' + (t.role || '—') + ' &nbsp; <strong>Category:</strong> ' + (t.category || '—') + ' &nbsp; <strong>Maturity:</strong> ' + (t.maturity_level || '—'); row.appendChild(meta);
                if (t.description) { const d = document.createElement('div'); d.style.marginTop='6px'; d.textContent = t.description; row.appendChild(d); }
                techSection.appendChild(row);
            }
        }
        panel.appendChild(techSection);

        if (machine.configurable) {
            const cfg = document.createElement('div'); cfg.style.marginTop = '10px';
            const cfgBtn = document.createElement('button'); cfgBtn.textContent = 'Configure'; cfgBtn.style.fontWeight='600';
            cfgBtn.onclick = () => {
                try {
                    const fe = window.__factoryEditor;
                    if (fe) {
                        const root = document.getElementById('factory-editor-root');
                        if (root) root.style.display = '';
                        const panel = document.getElementById('machine-info-panel');
                        if (panel) {
                            const note = document.createElement('div');
                            note.style.marginTop = '8px';
                            note.style.fontSize = '13px';
                            note.style.opacity = '0.9';
                            note.textContent = 'Factory editor opened. Per-building saved configuration is not implemented yet.';
                            panel.appendChild(note);
                        }
                        return;
                    }
                    const ev = new CustomEvent('machine:configure', { detail: { machine: machine, record } });
                    window.dispatchEvent(ev);
                } catch (e) {
                    console.warn('machine configure handler failed', e);
                }
            };
            cfg.appendChild(cfgBtn);
            panel.appendChild(cfg);
        }

        panel.style.display = 'block';
    }

    update(machine) {
        // Re-render from machine data
        if (!this.el) return;
        this.show(machine);
    }

    clear() {
        if (!this.el) return;
        this.el.innerHTML = '';
        this.el.style.display = 'none';
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
