// City-level technologies shown in the main toolbox
const cityTechnologies = [
  {
    id: 'process-unit',
    name: 'Process Unit',
    image: '/processingplant.png',
    defKey: 'processUnit'
  },
  {
    id: 'sorting-facility',
    name: 'Sorting Facility',
    image: '/sorting.png',
    defKey: 'sortingFacility'
  }
];

// Sorting-factory equipment preserved for future internal factory editor
export const sortingFactoryEquipment = [
  'Conveyor','Bag Opener','Trommel','Magnet','Eddy Current','AI Optical Sorter','Human QA'
];

export default class Toolbox{
  constructor({root, onStartPlace}){
    this.root = root;
    // instance created
    this.onStartPlace = (payload) => {
      const scene = window.__simulatorScene;
      if (scene && payload && payload.defKey) {
        if (scene._placementController && typeof scene._placementController.beginPlacement === 'function') {
          try { scene._placementController.beginPlacement(payload.defKey); } catch (e) { /* ignore */ }
        } else if (onStartPlace) {
          onStartPlace(payload);
        }
      } else if (onStartPlace) {
        onStartPlace(payload);
      }
    };
    this.items = cityTechnologies;
    this._init();
  }
  _init(){
    this.container = document.getElementById('toolbox');
    this.list = document.getElementById('toolbox-items');
    this.toggle = document.getElementById('toolbox-toggle');
    this.resizer = document.getElementById('toolbox-resizer');
    // Ensure toolbox uses left/top fixed positioning and not right/bottom
    try{
      this.container.style.position = 'fixed';
      // fixed left sidebar; sizing and positioning handled by CSS
    }catch(e){}
    this._renderItems();
    // delegate pointerdown at root to ensure clicks on children trigger placement
    try {
      if (this.container) {
        this.container.addEventListener('pointerdown', (e) => {
          try {
            const li = e.target.closest && e.target.closest('.toolbox-item');
            if (!li) return;
            const idx = Array.from(this.list.children).indexOf(li);
            if (idx >= 0 && this.items && this.items[idx]) {
              this._startPlace(e, this.items[idx]);
            }
          } catch (ee) {}
        }, true);
      }
    } catch (e) {}
    this._loadState();
    this._bind();
  }
  _renderItems(){
    this.list.innerHTML = '';
    this.items.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'toolbox-item';
      li.draggable = false;
      // icon + label layout so collapsed state can hide labels
      const imgHtml = `<img src="${it.image}" alt="${it.name}" style="max-width:36px;max-height:36px;object-fit:contain">`;
      li.innerHTML = `<div class="toolbox-item-icon">${imgHtml}</div><div class="toolbox-item-label">${it.name}</div>`;
      // pointerdown will start the (DOM) ghost placement flow — attach on li and its children to be robust
      li.addEventListener('pointerdown', (e) => this._startPlace(e, it));
      // also set onclick handlers as a robust fallback for synthetic events
      try {
        const imgEl = li.querySelector('img');
        if (imgEl) {
          imgEl.addEventListener('pointerdown', (e) => this._startPlace(e, it));
          imgEl.onclick = (e) => this._startPlace(e, it);
        }
        const labelEl = li.querySelector('.toolbox-item-label');
        if (labelEl) {
          labelEl.addEventListener('pointerdown', (e) => this._startPlace(e, it));
          labelEl.onclick = (e) => this._startPlace(e, it);
        }
        li.onclick = (e) => this._startPlace(e, it);
      } catch (e) {}

      this.list.appendChild(li);
    });
  }
  _bind(){
    // toggle expanded state
    this.toggle.addEventListener('click', () => {
      const expanded = this.container.classList.toggle('expanded');

      document.body.classList.toggle('toolbox-is-expanded', expanded);

      this.toggle.setAttribute('aria-expanded', String(expanded));

      try {
        localStorage.setItem(
          'factory_toolbox_expanded',
          expanded ? '1' : '0'
        );
      } catch (e) {}

      // Let Phaser detect the newly available canvas space
      window.dispatchEvent(new Event('resize'));
    });
  }
  _loadState() {
    const expanded = localStorage.getItem('factory_toolbox_expanded') === '1';

    this.container.classList.toggle('expanded', expanded);
    document.body.classList.toggle('toolbox-is-expanded', expanded);
    this.toggle.setAttribute('aria-expanded', String(expanded));
  }
  
  _startPlace(e,item){
    e.preventDefault();
    // inform main app to begin a placement drag
    if(this.onStartPlace) {
      this.onStartPlace({
        type: item.name,
        id: item.id,
        defKey: item.defKey,
        image: item.image,
        clientX: e.clientX,
        clientY: e.clientY
      });
    }
  }
}
