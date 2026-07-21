export default class Viewport{
  constructor({viewportEl, worldEl, camera}){
    this.viewport = viewportEl;
    this.world = worldEl;
    this.camera = camera;
    this._init();
  }
  _init(){
    // add grid
    this.grid = document.createElement('div');
    this.grid.className = 'grid';
    // insert grid behind the world so components sit above it
    this.viewport.insertBefore(this.grid, this.world);
    this.camera.grid = this.grid;

    // panning with middle mouse or space+drag
    let panning = false, last = null;
    this.viewport.addEventListener('pointerdown', (e)=>{
      if(e.button === 1){ panning=true; last = {x:e.clientX,y:e.clientY}; this.viewport.setPointerCapture(e.pointerId); }
    });
    this.viewport.addEventListener('pointermove', (e)=>{
      if(panning && last){
        const dx = (e.clientX - last.x)/this.camera.scale;
        const dy = (e.clientY - last.y)/this.camera.scale;
        this.camera.panBy(dx,dy);
        last = {x:e.clientX,y:e.clientY};
      }
    });
    this.viewport.addEventListener('pointerup', (e)=>{ if(e.button===1){ panning=false; last=null; } });

    // wheel zoom
    this.viewport.addEventListener('wheel', (e)=>{
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.96 : 1.04;
      this.camera.zoomAt({x:e.clientX,y:e.clientY}, factor);
    }, {passive:false});

    // double click to center at point
    this.viewport.addEventListener('dblclick', (e)=>{
      const worldPt = this.camera.screenToWorld(e.clientX, e.clientY);
      // center the view so that worldPt is centered
      const rect = this.viewport.getBoundingClientRect();
      const cx = rect.width/2 / this.camera.scale - worldPt.x;
      const cy = rect.height/2 / this.camera.scale - worldPt.y;
      this.camera.set({x:cx,y:cy});
    });
  }
}
