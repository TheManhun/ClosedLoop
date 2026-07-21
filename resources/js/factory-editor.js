import '../css/factory-editor.css';
import CameraController from './editor/CameraController';
import Toolbox from './editor/Toolbox';
import Viewport from './editor/Viewport';
import ComponentCard from './editor/ComponentCard';
import SelectionManager from './editor/SelectionManager';

const world = document.getElementById('world');
const viewportEl = document.getElementById('viewport');

const camera = new CameraController({world});
const selection = new SelectionManager();
const viewport = new Viewport({viewportEl, worldEl: world, camera});

const components = new Map();

function addComponent(type, worldPos){
  const c = new ComponentCard({type, position: worldPos, world, camera, selection, onRemove: (comp)=>{ components.delete(comp.id); }});
  components.set(c.id, c);
}

// toolbox
const toolbox = new Toolbox({root: document.getElementById('toolbox'), onStartPlace: startPlacement});

// Remove any stray toolbox-like elements that might have been left by prior dev iterations
try{
  Array.from(document.querySelectorAll('.toolbox')).forEach(el=>{ if(el.id !== 'toolbox'){ el.remove(); } });
}catch(e){}

// Clean up any obsolete saved Outputs panel state (development convenience)
try{
  localStorage.removeItem('panel_state_outputs');
  localStorage.removeItem('panel-outputs');
  localStorage.removeItem('outputs-panel');
}catch(e){}

// ghost placement
let ghost = null;
let placing = null;

function startPlacement({type, clientX, clientY}){
  placing = {type};
  ghost = document.createElement('div');
  ghost.className = 'component-card ghost';
  ghost.innerHTML = `<div class="component-label">${type}</div>`;
  document.body.appendChild(ghost);
  moveGhost(clientX, clientY);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, {once:true});
}

function moveGhost(cx,cy){
  ghost.style.left = cx + 'px';
  ghost.style.top = cy + 'px';
}

function onPointerMove(e){ moveGhost(e.clientX,e.clientY); }

function onPointerUp(e){
  window.removeEventListener('pointermove', onPointerMove);
  if(ghost) ghost.remove();
  const rect = viewportEl.getBoundingClientRect();
  if(e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom){
    const wp = camera.screenToWorld(e.clientX, e.clientY);
    addComponent(placing.type, {x: wp.x, y: wp.y});
  }
  placing = null; ghost = null;
}

// selection clearing when clicking empty space
viewportEl.addEventListener('pointerdown', (e)=>{
  if(e.target === viewportEl || e.target === world || e.target.classList.contains('grid')){
    selection.clear();
  }
});

// delete key
window.addEventListener('keydown', (e)=>{
  if(e.key === 'Delete' || e.key === 'Backspace'){
    const sel = selection.selectedId;
    if(sel && components.has(sel)){
      const c = components.get(sel);
      c.remove();
      selection.clear();
    }
  }
});

// initial camera setup
camera.set({x: window.innerWidth/2/ camera.scale * -0.8, y: window.innerHeight/2/ camera.scale * -0.3, scale:1});

// expose small debug on window
window.__factoryEditor = {camera, addComponent, components, selection};
