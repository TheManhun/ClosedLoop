const DEFAULT_ITEMS = [
  'Conveyor','Bag Opener','Trommel','Magnet','Eddy Current','AI Optical Sorter','Human QA'
];

export default class Toolbox{
  constructor({root, onStartPlace}){
    this.root = root;
    this.onStartPlace = onStartPlace;
    this.items = DEFAULT_ITEMS;
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
      li.innerHTML = `<div class="toolbox-item-icon">▣</div><div class="toolbox-item-label">${it}</div>`;
      li.addEventListener('pointerdown', (e)=>this._startPlace(e,it));
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
  
  _startPlace(e,type){
    e.preventDefault();
    // inform main app to begin a placement drag
    if(this.onStartPlace) this.onStartPlace({type, clientX:e.clientX, clientY:e.clientY});
  }
}
