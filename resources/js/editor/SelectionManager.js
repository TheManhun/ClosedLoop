export default class SelectionManager{
  constructor(){
    this.selectedId = null;
    this.subscribers = [];
  }
  select(id){
    this.selectedId = id;
    this._notify();
  }
  clear(){ this.selectedId = null; this._notify(); }
  onChange(fn){ this.subscribers.push(fn); }
  _notify(){ this.subscribers.forEach(s=>s(this.selectedId)); }
}
