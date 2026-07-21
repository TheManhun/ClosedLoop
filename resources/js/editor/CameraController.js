export default class CameraController {
  constructor({world, grid}){
    this.world = world;
    this.grid = grid;
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 4;
    this._apply();
  }
  set({x,y,scale}){
    if(x!==undefined) this.x = x;
    if(y!==undefined) this.y = y;
    if(scale!==undefined) this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
    this._apply();
  }
  panBy(dx,dy){ this.x += dx; this.y += dy; this._apply(); }
  zoomAt(point, factor){
    const prevScale = this.scale;
    let next = this.scale * factor;
    next = Math.max(this.minScale, Math.min(this.maxScale, next));
    // keep point stable: screen -> world
    const worldBefore = this.screenToWorld(point.x, point.y);
    this.scale = next;
    const worldAfter = this.screenToWorld(point.x, point.y);
    this.x += (worldAfter.x - worldBefore.x);
    this.y += (worldAfter.y - worldBefore.y);
    this._apply();
  }
  screenToWorld(screenX, screenY){
    const rect = this.world.parentElement.getBoundingClientRect();
    const sx = screenX - rect.left;
    const sy = screenY - rect.top;
    const wx = (sx / this.scale) - this.x;
    const wy = (sy / this.scale) - this.y;
    return {x:wx,y:wy};
  }
  worldToScreen(wx,wy){
    const sx = (wx + this.x) * this.scale;
    const sy = (wy + this.y) * this.scale;
    const rect = this.world.parentElement.getBoundingClientRect();
    return {x: rect.left + sx, y: rect.top + sy};
  }
  _apply(){
    this.world.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    // adjust grid size for visual crispness
    if(this.grid){
      const size = 32 * this.scale;
      this.grid.style.backgroundSize = `${size}px ${size}px, ${size}px ${size}px`;
    }
  }
}
