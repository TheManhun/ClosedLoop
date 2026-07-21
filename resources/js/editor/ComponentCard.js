let idCounter = 1;
export default class ComponentCard{
  constructor({type, position, world, camera, selection, onRemove}){
    this.id = `c${Date.now()}_${idCounter++}`;
    this.type = type;
    this.position = {...position};
    this.rotation = 0;
    this.properties = {};
    this.connections = [];
    this.world = world;
    this.camera = camera;
    this.selection = selection;
    this.onRemove = onRemove;

    this.el = document.createElement('div');
    this.el.className = 'component-card';
    this.el.setAttribute('data-id', this.id);
    this.el.innerHTML = `<div class="component-label">${type}</div>`;
    this._render();
    this._bind();
    this.world.appendChild(this.el);
  }
  _render(){
    this.el.style.left = `${this.position.x}px`;
    this.el.style.top = `${this.position.y}px`;
    this.el.style.transform = `translateZ(0)`;
    this.el.classList.toggle('selected', this.selection.selectedId === this.id);
  }
  _bind(){
    // selection
    this.el.addEventListener('pointerdown', (e)=>{
      e.stopPropagation();
      this.selection.select(this.id);
      this._startDrag(e);
    });
    // respond to selection changes
    this.selection.onChange((sel)=>{
      this.el.classList.toggle('selected', sel === this.id);
    });
  }
  _startDrag(e){
    const start = {x:e.clientX, y:e.clientY};
    const orig = {x:this.position.x, y:this.position.y};
    const move = (ev)=>{
      const dx = (ev.clientX - start.x)/this.camera.scale;
      const dy = (ev.clientY - start.y)/this.camera.scale;
      this.position.x = orig.x + dx;
      this.position.y = orig.y + dy;
      this._render();
    };
    const up = (ev)=>{ document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, {once:true});
  }
  remove(){
    this.el.remove();
    if(this.onRemove) this.onRemove(this);
  }
  toObject(){
    return {id:this.id,type:this.type,position:this.position,rotation:this.rotation,properties:this.properties,connections:this.connections};
  }
}
