// First-person hand + held item renderer (transform chain modeled on Beta's ItemRenderer)
import * as THREE from 'three';
import { items, getIcon } from '../inventory/items.js';
import { SHAPE, SH } from '../world/blocks.js';
import { blockCubeGeometry } from '../entity/entity.js';
import { buildModel } from '../entity/models.js';
import { Skins } from './skin.js';

// --- adapters to this project's APIs ---
function iconPixels(id, meta = 0) { return getIcon(id, 16, meta).getContext('2d').getImageData(0, 0, 16, 16).data; }
function isFlatItem(id) { const it = items[id]; return !(it && it.block !== undefined && [SH.cube, SH.slab, SH.cactus].includes(SHAPE[it.block])); }
let atlas = null;
function itemMesh(id, meta = 0) { const it = items[id]; const mat = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true, alphaTest: 0.1 });
  const m = new THREE.Mesh(blockCubeGeometry(it.block, atlas.rows, 1, meta), mat); m.userData.mats = [mat]; return m; }

const D2R = Math.PI/180;
class MS { constructor(){ this.m=new THREE.Matrix4(); this.t=new THREE.Matrix4(); }
  reset(){ this.m.identity(); return this; }
  tr(x,y,z){ this.m.multiply(this.t.makeTranslation(x,y,z)); return this; }
  rot(deg,x,y,z){ this.m.multiply(this.t.makeRotationAxis(new THREE.Vector3(x,y,z).normalize(), deg*D2R)); return this; }
  sc(x,y,z){ this.m.multiply(this.t.makeScale(x,y??x,z??x)); return this; } }

const extrudeCache = new Map();
export function extrudedItem(id, meta){
  const key=id+':'+(id>=256&&id!==373?0:meta); if(extrudeCache.has(key)) return extrudeCache.get(key);
  const px=iconPixels(id,meta); const pos=[], col=[];
  const A=(x,y)=> x>=0&&x<16&&y>=0&&y<16 && px[(y*16+x)*4+3]>40;
  const quad=(p,c,s)=>{ for(const i of [0,1,2,0,2,3]){ pos.push(...p[i]); col.push(c[0]*s,c[1]*s,c[2]*s); } };
  const t=1/16;
  if (px) for(let y=0;y<16;y++) for(let x=0;x<16;x++){ if(!A(x,y)) continue; const i=(y*16+x)*4; const c=[px[i]/255,px[i+1]/255,px[i+2]/255];
    const x0=x/16, x1=(x+1)/16, y0=1-(y+1)/16, y1=1-y/16;
    quad([[x0,y0,t/2],[x1,y0,t/2],[x1,y1,t/2],[x0,y1,t/2]],c,1);
    quad([[x1,y0,-t/2],[x0,y0,-t/2],[x0,y1,-t/2],[x1,y1,-t/2]],c,0.8);
    if(!A(x-1,y)) quad([[x0,y0,-t/2],[x0,y0,t/2],[x0,y1,t/2],[x0,y1,-t/2]],c,0.6);
    if(!A(x+1,y)) quad([[x1,y0,t/2],[x1,y0,-t/2],[x1,y1,-t/2],[x1,y1,t/2]],c,0.6);
    if(!A(x,y-1)) quad([[x0,y1,t/2],[x1,y1,t/2],[x1,y1,-t/2],[x0,y1,-t/2]],c,0.9);
    if(!A(x,y+1)) quad([[x0,y0,-t/2],[x1,y0,-t/2],[x1,y0,t/2],[x0,y0,t/2]],c,0.5); }
  // match vanilla renderItemIn2D: icon is mirrored along x (x=0 shows the icon's right edge) and extruded from z=0 back to z=-1/16
  for (let i=0;i<pos.length;i+=9){ for(let k=0;k<9;k+=3){ pos[i+k]=1-pos[i+k]; pos[i+k+2]-=t/2; } for(let k=0;k<3;k++){ const q=pos[i+3+k]; pos[i+3+k]=pos[i+6+k]; pos[i+6+k]=q; } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  extrudeCache.set(key,g); return g;
}
export class HandRenderer {
  constructor(){
    this.scene=new THREE.Scene(); this.cam=new THREE.PerspectiveCamera(70,1,0.01,10);
    this.root=new THREE.Group(); this.root.matrixAutoUpdate=false; this.scene.add(this.root);
    const steve=buildModel('steve'); this.armMat=steve.mat; Skins.apply(this.armMat, Skins.current); Skins.onChange(s=>Skins.apply(this.armMat, s));
    const armMesh=steve.parts.armR.children[0]; const ag=armMesh.geometry.clone(); ag.translate(-1/16,0,0); this.arm=new THREE.Mesh(ag, this.armMat); const sg=steve.parts.sleeveR.children[0].geometry.clone(); sg.translate(-1/16,0,0); this.arm.add(new THREE.Mesh(sg, this.armMat));
    this.arm.matrixAutoUpdate=false; this.scene.add(this.arm);
    this.itemMat=new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide });
    this.item=null; this.itemKey=null; this.equip=1; this.pequip=1; this.lastKey=null; this.ms=new MS();
    this.pitchLag=0; this.yawLag=0;
  }
  setItem(stack){
    const key = stack? stack.id+':'+(stack.id>=256?0:(stack.dmg||0)) : 'none';
    if (key===this.itemKey) return; this.itemKey=key;
    if (this.item){ this.scene.remove(this.item); this.item=null; }
    if (!stack) return;
    if (isFlatItem(stack.id)){ this.item=new THREE.Mesh(extrudedItem(stack.id,(stack.dmg||0)), this.itemMat); this.flat=true; }
    else { this.item=itemMesh(stack.id,(stack.dmg||0),1); this.flat=false; }
    this.item.matrixAutoUpdate=false; this.scene.add(this.item);
  }
  tick(player){ // equip animation like MC
    this.pequip=this.equip; const held=player.inv.held; const key=held? held.id+':'+(held.id>=256?0:(held.dmg||0)):'none';
    const target = key===this.lastKey ? 1 : 0; const d=Math.max(-0.4,Math.min(0.4,target-this.equip)); this.equip+=d;
    if (this.equip<0.1){ this.lastKey=key; this.setItem(held); }
  }
  render(gl, player, alpha, camera, bright){
    this.cam.aspect=camera.aspect; this.cam.fov=70; this.cam.updateProjectionMatrix();
    const P=player; const equip=this.pequip+(this.equip-this.pequip)*alpha;
    // view bobbing (same as world camera)
    const walk = P.walkDist + (P.walkDist-P.pWalkDist)*(alpha-1) ; const bob = P.bobbing===false ? 0 : P.pBob+(P.bob-P.pBob)*alpha;
    const ms=this.ms.reset();
    ms.tr(Math.sin(walk*Math.PI)*bob*0.5, -Math.abs(Math.cos(walk*Math.PI)*bob), 0);
    ms.rot(Math.sin(walk*Math.PI)*bob*3, 0,0,1); ms.rot(Math.abs(Math.cos(walk*Math.PI-0.2)*bob)*5, 1,0,0);
    const base = ms.m.clone();
    const sw = P.swing > 0 ? 1 - (P.swing - alpha)/6 : 0; const s = Math.min(1, sw);
    const f12 = Math.sin(s*Math.PI), f17=Math.sin(Math.sqrt(s)*Math.PI);
    const shade = bright;
    if (this.item){
      this.arm.visible=false; this.item.visible=true;
      ms.m.copy(base);
      if (P.eating && this.item){ const e=P.eating+alpha; const k=1-Math.pow(e/32,27); const b=Math.abs(Math.cos(e/4*Math.PI)*0.1)*(e/32>0.2?1:0); ms.tr(0, b, 0); ms.tr(-0.3*(1-k)*0+(-0.5)*(1-k)*0, 0, 0); ms.tr(0,0,0); ms.rot(0,0,1,0); ms.tr(-0.35*(e>2?1:0), 0.15*(e>2?1:0), 0.1*(e>2?1:0)); }
      ms.tr(-f17*0.4, Math.sin(Math.sqrt(s)*Math.PI*2)*0.2, -f12*0.2);
      ms.tr(0.56, -0.52-(1-equip)*0.6, -0.72);
      ms.rot(45,0,1,0);
      const g12=Math.sin(s*s*Math.PI);
      ms.rot(-g12*20,0,1,0); ms.rot(-f17*20,0,0,1); ms.rot(-f17*80,1,0,0);
      ms.sc(0.4);
      if (P.drawing){ const d=Math.min(1,(P.drawing+alpha)/20); ms.tr(0,0,0.3*d); ms.rot(-10*d,0,0,1); }
      if (this.flat){ ms.tr(0,-0.3,0); ms.sc(1.5); ms.rot(50,0,1,0); ms.rot(335,0,0,1); ms.tr(-0.9375,-0.0625,0); this.itemMat.color.setRGB(shade,shade,shade); }
      else { this.item.userData.mats.forEach(m=>m.color.setRGB(shade,shade,shade)); }
      this.item.matrix.copy(ms.m); this.item.matrixWorldNeedsUpdate=true;
    } else {
      this.arm.visible=true;
      ms.m.copy(base);
      ms.tr(-f17*0.3, Math.sin(Math.sqrt(s)*Math.PI*2)*0.4, -f12*0.4);
      ms.tr(0.64, -0.6-(1-equip)*0.6, -0.72);
      ms.rot(45,0,1,0); ms.rot(f17*70,0,1,0); ms.rot(-f12*20,0,0,1);
      ms.tr(-1,3.6,3.5); ms.rot(120,0,0,1); ms.rot(200,1,0,0); ms.rot(-135,0,1,0);
      ms.tr(5.6,0,0);
      // arm model: rotation point (-5,2,0) in model px; arm box (-3,-2,-2)-(1,10,2) in MC coords (y down)
      ms.tr(-5/16, 2/16, 0); ms.sc(1,-1,1);
      this.arm.matrix.copy(ms.m); this.arm.matrixWorldNeedsUpdate=true;
      this.armMat.color.setRGB(shade,shade,shade);
    }
    gl.autoClear=false; gl.clearDepth(); gl.render(this.scene, this.cam); gl.autoClear=true;
  }
}

// Adapter used by game.js: update(pt, daySub) each frame, render(), clear()
export class Hand {
  constructor(game) { this.g = game; this.r = new HandRenderer(); this.lastTick = -1; }
  clear() { this.r.itemKey = null; this.r.lastKey = null; this.r.setItem(null); this.r.itemKey = null; }
  update(pt, daySub) {
    const g = this.g, p = g.player; if (!p) return;
    atlas = { tex: g.renderer.atlasTex, rows: g.renderer.opts.rows };
    if (g.tickCount !== this.lastTick) { this.lastTick = g.tickCount; this.r.tick(p); }
    const w = g.world, x = Math.floor(p.x), y = Math.floor(p.eyeY), z = Math.floor(p.z);
    const lv = Math.max(w.getSky(x, y, z) - daySub, w.getBlockLight(x, y, z)); const f = 1 - Math.max(0, lv) / 15;
    this.shade = (1 - f) / (f * 3 + 1) * 0.95 + 0.05; this.pt = pt;
  }
  render() {
    const g = this.g, p = g.player; if (!p) return;
    const view = { walkDist: p.walkDist, pWalkDist: p.pWalkDist, bob: p.bob, pBob: p.pBob, bobbing: g.settings.bobbing, swing: p.swing, eating: g.eating || 0, drawing: 0 };
    this.r.render(g.renderer.gl, view, this.pt ?? 1, g.renderer.camera, this.shade ?? 1);
  }
}
