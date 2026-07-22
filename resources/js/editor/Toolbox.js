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
    this.onStartPlace = (payload) => {
      const scene = window.__simulatorScene;
      if (scene && payload && payload.defKey) {
        scene._placementMode = true;
        scene._placementDefKey = payload.defKey;
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
      // pointerdown will start the (DOM) ghost placement flow
      li.addEventListener('pointerdown', (e)=>this._startPlace(e, it));

      this.list.appendChild(li);
    });
  }
  _bind(){
    // toggle expanded state
    this.toggle.addEventListener('click', ()=>{
      const expanded = this.container.classList.toggle('expanded');
      this.toggle.setAttribute('aria-expanded', String(expanded));
      try{ localStorage.setItem('factory_toolbox_expanded', expanded? '1':'0'); }catch(e){}
    });
  }
  _loadState(){
    const expanded = localStorage.getItem('factory_toolbox_expanded');
    if(expanded === '1') this.container.classList.add('expanded');
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
