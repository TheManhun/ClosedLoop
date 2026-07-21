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
    this._renderItems();
    this._loadState();
    this._bind();
  }
  _renderItems(){
    this.list.innerHTML = '';
    this.items.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'toolbox-item';
      li.textContent = it;
      li.draggable = false;
      li.addEventListener('pointerdown', (e)=>this._startPlace(e,it));
      this.list.appendChild(li);
    });
  }
  _bind(){
    this.toggle.addEventListener('click', ()=>{
      const closed = this.container.classList.toggle('closed');
      this.toggle.setAttribute('aria-expanded', String(!closed));
      localStorage.setItem('factory_toolbox_closed', closed? '1':'0');
    });
    // draggable header with cross-browser fallbacks (pointer/mouse/touch)
    let dragging = false;
    let dragStart = {x:0,y:0};
    let orig = {x:0,y:0};
    const header = this.container.querySelector('.toolbox-header');
    header.style.cursor = 'move';

    const getPoint = (ev)=>{
      if(ev.touches && ev.touches.length) return {x: ev.touches[0].clientX, y: ev.touches[0].clientY};
      return {x: ev.clientX, y: ev.clientY};
    };

    const startDrag = (e)=>{
      try{ e.preventDefault(); }catch(_){}
      dragging = true;
      const p = getPoint(e);
      dragStart = {x: p.x, y: p.y};
      const rect = this.container.getBoundingClientRect();
      orig = {x: rect.left, y: rect.top};
      if(e.pointerId && this.container.setPointerCapture) this.container.setPointerCapture(e.pointerId);
    };

    const moveDrag = (ev)=>{
      if(!dragging) return;
      const p = getPoint(ev);
      const dx = p.x - dragStart.x;
      const dy = p.y - dragStart.y;
      const nx = Math.max(8, Math.min(window.innerWidth - this.container.offsetWidth - 8, Math.round(orig.x + dx)));
      const ny = Math.max(8, Math.min(window.innerHeight - this.container.offsetHeight - 8, Math.round(orig.y + dy)));
      this.container.style.left = nx + 'px';
      this.container.style.top = ny + 'px';
    };

    const endDrag = ()=>{
      if(!dragging) return;
      dragging = false;
      localStorage.setItem('factory_toolbox_left', this.container.style.left || '12px');
      localStorage.setItem('factory_toolbox_top', this.container.style.top || '12px');
    };

    // Pointer events where available
    if(window.PointerEvent){
      header.addEventListener('pointerdown', startDrag, {passive:false});
      document.addEventListener('pointermove', moveDrag, {passive:true});
      document.addEventListener('pointerup', endDrag, {passive:true});
    } else {
      // mouse fallback
      header.addEventListener('mousedown', startDrag, {passive:false});
      document.addEventListener('mousemove', moveDrag, {passive:true});
      document.addEventListener('mouseup', endDrag, {passive:true});
      // touch fallback
      header.addEventListener('touchstart', startDrag, {passive:false});
      document.addEventListener('touchmove', moveDrag, {passive:true});
      document.addEventListener('touchend', endDrag, {passive:true});
    }
    // resizer
    let resizing = false;
    let startX, startW;
    this.resizer.addEventListener('pointerdown', (e)=>{
      resizing = true; startX = e.clientX; startW = this.container.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      const move = (ev)=>{
        const nx = Math.max(160, startW + (ev.clientX - startX));
        this.container.style.width = nx + 'px';
      };
      const up = ()=>{resizing=false; document.body.style.cursor=''; localStorage.setItem('factory_toolbox_width', String(this.container.offsetWidth)); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }
  _loadState(){
    const closed = localStorage.getItem('factory_toolbox_closed');
    if(closed === '1') this.container.classList.add('closed');
    const w = localStorage.getItem('factory_toolbox_width');
    if(w) this.container.style.width = w + 'px';
    const left = localStorage.getItem('factory_toolbox_left');
    const top = localStorage.getItem('factory_toolbox_top');
    const pxMatch = (v)=> typeof v === 'string' && /^\d+px$/.test(v);
    if(pxMatch(left)) this.container.style.left = left; else this.container.style.left = this.container.style.left || '12px';
    if(pxMatch(top)) this.container.style.top = top; else this.container.style.top = this.container.style.top || '12px';
  }
  _startPlace(e,type){
    e.preventDefault();
    // inform main app to begin a placement drag
    if(this.onStartPlace) this.onStartPlace({type, clientX:e.clientX, clientY:e.clientY});
  }
}
