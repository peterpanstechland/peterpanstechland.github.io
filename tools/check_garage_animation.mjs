// Compare actual CPU-skinned vertices across the source and Blender export.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {geometryOnlyGLB} from './glb_geometry_loader.mjs';
const root='assets/tripo/blender-garage';
const cats=await Promise.all(['before','models'].map(dir=>geometryOnlyGLB(`${root}/${dir}/04_cyber_lucky_cat.glb`)));
function sample(gltf,time){
  const clip=gltf.animations.find(c=>c.name==='Techland_Beckon');assert.ok(clip);
  const mixer=new THREE.AnimationMixer(gltf.scene), action=mixer.clipAction(clip);action.play();mixer.setTime(time);
  gltf.scene.updateMatrixWorld(true);const points=[];
  gltf.scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){
    const p=o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));points.push(p);
  }});
  assert.ok(points.length>1000);mixer.stopAllAction();return points;
}
function difference(a,b){
  const cell=.001,grid=new Map(), key=(x,y,z)=>`${x},${y},${z}`;
  for(const p of a){const k=key(...p.toArray().map(v=>Math.floor(v/cell)));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}
  let max=0;
  for(const p of b){const q=p.toArray().map(v=>Math.floor(v/cell));let min=Infinity;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const v of grid.get(key(q[0]+x,q[1]+y,q[2]+z))||[])min=Math.min(min,v.distanceTo(p));
    max=Math.max(max,min);
  }return max;
}
const samples=[];
for(const t of [0,.25,.5,1,1.5,1.99]){
  const [a,b]=cats.map(g=>sample(g,t)),error=difference(a,b);
  assert.ok(error<.001,`Cat pose mismatch at ${t}: ${error}`);
  samples.push({time:t,maxExportDeviationM:error,vertices:b.length});
}
const a=sample(cats[1],0),b=sample(cats[1],.5);let movement=0;
for(let i=0;i<a.length;i++)movement=Math.max(movement,a[i].distanceTo(b[i]));assert.ok(movement>.001);
const shutters=await Promise.all(['before','models'].map(dir=>geometryOnlyGLB(`${root}/${dir}/02_roller_shutter.glb`)));
const roots=shutters.map(g=>g.scene.getObjectByName('ROLLER_SHUTTER_ROOT'));assert.ok(roots.every(Boolean));
assert.deepEqual(roots[0].userData.shutter,roots[1].userData.shutter);
const slats=[];roots[0].traverse(o=>{if(/^SHUTTER_SLAT_\d+$/.test(o.name))slats.push(o)});assert.equal(slats.length,26);
for(const a of slats){const b=roots[1].getObjectByName(a.name);assert.ok(b);assert.deepEqual(a.userData,b.userData);
 assert.ok(a.position.distanceTo(b.position)<1e-6);assert.ok(a.quaternion.angleTo(b.quaternion)<1e-6);
 for(const progress of [0,.5,1]){const spec=roots[1].userData.shutter,c=b.userData.closedY+spec.travel*progress,theta=Math.max(0,(c-spec.top)/spec.radius);
  const y=c<=spec.top?c:spec.top+spec.radius*Math.sin(theta),z=c<=spec.top?b.userData.closedZ:b.userData.closedZ-spec.radius*(1-Math.cos(theta));assert.ok([y,z,theta].every(Number.isFinite));}
}
const result={cat:{clip:'Techland_Beckon',samples,maxBeckonMovementM:movement,skinMotionPreserved:true},shutter:{slats:26,pivotsAndMetadataPreserved:true,closedHalfOpenFullyOpenFinite:true}};
await fs.writeFile(`${root}/animation-validation.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
