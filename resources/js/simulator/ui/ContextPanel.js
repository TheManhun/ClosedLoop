import ContextPanelModel from '../services/ContextPanelModel.js';

// Minimal DOM-based context panel that uses ContextPanelModel to render
export default class ContextPanel {
    constructor({ container, graphService, options = {} } = {}) {
        if (!container) throw new Error('container required');
        this.container = container;
        this.model = new ContextPanelModel({ graphService, options });
        this.mode = 'suggested';
        this.selection = null;
    }

    setMode(mode) { this.mode = mode; this.render(); }
    setSelection(selection) { this.selection = selection; this.render(); }

    clear() { this.container.innerHTML = ''; }

    render() {
        this.clear();
        const data = this.model.getPanelData(this.selection, this.mode);
        const root = document.createElement('div');
        root.className = 'context-panel';
        root.style.padding = '12px';
        root.style.color = '#e5e7eb';
        root.style.fontFamily = 'Inter, Arial, sans-serif';
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        root.style.gap = '8px';

        // Mode toggles (Suggested / Show All)
        const toggles = document.createElement('div'); toggles.style.display = 'flex'; toggles.style.gap = '8px'; toggles.style.alignItems = 'center';
        const suggestedBtn = document.createElement('button'); suggestedBtn.textContent = 'Suggested'; suggestedBtn.style.padding = '6px 10px'; suggestedBtn.style.borderRadius = '6px'; suggestedBtn.style.border = '1px solid rgba(255,255,255,0.06)';
        const allBtn = document.createElement('button'); allBtn.textContent = 'Show All'; allBtn.style.padding = '6px 10px'; allBtn.style.borderRadius = '6px'; allBtn.style.border = '1px solid rgba(255,255,255,0.06)';
        suggestedBtn.addEventListener('click', () => { this.setMode('suggested'); });
        allBtn.addEventListener('click', () => { this.setMode('all'); });
        toggles.appendChild(suggestedBtn); toggles.appendChild(allBtn);
        root.appendChild(toggles);

        if (data.state === 'empty') {
            const h = document.createElement('div'); h.className = 'cp-empty'; h.textContent = data.message; h.style.padding = '8px 0'; h.style.opacity = '0.9'; root.appendChild(h);
        }

        if (data.state === 'resource') {
            const title = document.createElement('h3'); title.textContent = `Compatible Technologies for ${data.resource}`; title.style.margin = '6px 0 4px 0'; root.appendChild(title);
            const list = document.createElement('div'); list.className = 'cp-list'; list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '8px';
            for (const item of data.machines) {
                const card = document.createElement('div'); card.className = 'machine-card'; card.style.display='flex'; card.style.alignItems='center'; card.style.gap='8px'; card.style.padding='8px'; card.style.borderRadius='8px'; card.style.background='rgba(255,255,255,0.02)';
                const img = document.createElement('div'); img.style.width='48px'; img.style.height='48px'; img.style.background = '#0f1724'; img.style.borderRadius='6px'; img.style.flex='0 0 48px';
                try { if (item.machine && (item.machine.image || item.machine.textureKey)) { const icon = document.createElement('img'); icon.src = item.machine.image ? ('/' + item.machine.image) : ('/' + String(item.machine.textureKey || 'processingplant') + '.png'); icon.style.width='48px'; icon.style.height='48px'; icon.style.objectFit='contain'; img.appendChild(icon); } } catch(e){}
                const meta = document.createElement('div'); meta.style.flex='1';
                const name = document.createElement('div'); name.textContent = item.machine.name || item.machine.stable_key; name.style.fontWeight='700'; name.style.marginBottom='4px'; meta.appendChild(name);
                const why = document.createElement('div'); why.className = 'machine-why'; why.textContent = item.reasons.map(r => r.relation === 'accepts' ? `Accepts ${r.resource}` : (r.relation === 'produced_by' ? `Produced by ${r.producer}` : '') ).join('; '); why.style.fontSize='12px'; why.style.opacity='0.85'; meta.appendChild(why);
                card.appendChild(img);
                card.appendChild(meta);
                card.addEventListener('click', () => {
                    const ev = new CustomEvent('contextpanel:place', { detail: { defKey: item.machine.defKey || item.machine.stable_key } });
                    try { this.container.dispatchEvent(ev); } catch (e) {}
                    try { if (window.__simulatorScene && window.__simulatorScene._placementController) window.__simulatorScene._placementController.beginPlacement(item.machine.defKey || item.machine.stable_key); } catch (e) {}
                });
                list.appendChild(card);
            }
            root.appendChild(list);
        }

        if (data.state === 'machine') {
            const title = document.createElement('h3'); title.textContent = `Machine: ${data.machine}`; root.appendChild(title);
            const inputs = document.createElement('div'); inputs.className = 'cp-inputs'; inputs.innerHTML = `<h4>Inputs</h4>`;
            for (const i of data.inputs) { const d = document.createElement('div'); d.textContent = i; inputs.appendChild(d); }
            const outputs = document.createElement('div'); outputs.className = 'cp-outputs'; outputs.innerHTML = `<h4>Outputs</h4>`;
            for (const o of data.outputs) { const d = document.createElement('div'); d.textContent = o; outputs.appendChild(d); }
            const next = document.createElement('div'); next.className = 'cp-next'; next.innerHTML = `<h4>Next Technologies</h4>`;
            for (const n of data.next) {
                const card = document.createElement('div'); card.className = 'machine-card'; card.style.display='flex'; card.style.alignItems='center'; card.style.gap='8px'; card.style.padding='8px'; card.style.borderRadius='8px'; card.style.background='rgba(255,255,255,0.02)';
                const name = document.createElement('div'); name.textContent = n.machine.name || n.machine.stable_key; name.style.fontWeight='700'; card.appendChild(name);
                const why = document.createElement('div'); why.className = 'machine-why'; why.textContent = n.reasons.map(r => r.relation === 'accepts' ? `Accepts ${r.resource}` : (r.relation === 'produced_by' ? `Produced by ${r.producer}` : '') ).join('; '); why.style.marginLeft='8px'; why.style.opacity='0.9'; card.appendChild(why);
                card.addEventListener('click', () => {
                    const ev = new CustomEvent('contextpanel:place', { detail: { defKey: n.machine.defKey || n.machine.stable_key } });
                    try { this.container.dispatchEvent(ev); } catch (e) {}
                    try { if (window.__simulatorScene && window.__simulatorScene._placementController) window.__simulatorScene._placementController.beginPlacement(n.machine.defKey || n.machine.stable_key); } catch (e) {}
                });
                next.appendChild(card);
            }
            root.appendChild(inputs); root.appendChild(outputs); root.appendChild(next);
        }

        if (data.state === 'all') {
            const title = document.createElement('h3'); title.textContent = 'All Buildable Machines'; root.appendChild(title);
            for (const cat of Object.keys(data.groups)) {
                const g = document.createElement('div'); g.className = 'cp-group'; const h = document.createElement('h4'); h.textContent = cat; g.appendChild(h);
                for (const m of data.groups[cat]) { const d = document.createElement('div'); d.textContent = m.name || m.stable_key; g.appendChild(d); }
                root.appendChild(g);
            }
        }

        // Connection tools (always visible)
        const tools = document.createElement('div'); tools.className = 'cp-tools'; tools.innerHTML = '<h4>Connections</h4>';
        ['Power Cable','Gas Pipe','Water Pipe','Conveyor'].forEach(t => { const b = document.createElement('button'); b.textContent = t; b.style.display='block'; b.style.width='100%'; b.style.marginTop='6px'; tools.appendChild(b); });
        root.appendChild(tools);

        this.container.appendChild(root);
    }
}
