import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {geometryOnlyGLB} from './glb_geometry_loader.mjs';
const repair=JSON.parse(await fs.readFile('assets/tripo/shutter-clearance/repair.json','utf8'));
const points=repair.meshes.flatMap(m=>m.movedVertices.map(v=>new THREE.Vector3(v.after[0],v.after[2]-.22,-v.after[1])));
const planter=new THREE.Box3().setFromPoints(points);
const {scene:model}=await geometryOnlyGLB('static/maker-garage-preview/models/02_roller_shutter.glb');
const mount=new THREE.Group();mount.add(model);mount.position.set(.3,-.02,1.13);mount.scale.y=.71;
const root=model.getObjectByName('ROLLER_SHUTTER_ROOT'),spec=root.userData.shutter,slats=[];
root.traverse(node=>{if(/^SHUTTER_SLAT_\d+$/.test(node.name))slats.push({node,...node.userData,q:node.quaternion.clone()});});
assert.equal(slats.length,26);
let minimum=Infinity;const collisions=[];
for(let step=0;step<=100;step++){
  const progress=step/100;
  for(const s of slats){
    const lifted=s.closedY+spec.travel*progress,theta=Math.max(0,(lifted-spec.top)/spec.radius);
    s.node.position.set(s.closedX,theta?spec.top+spec.radius*Math.sin(theta):lifted,s.closedZ-spec.radius*(1-Math.cos(theta)));
    s.node.quaternion.copy(s.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-theta));
  }
  mount.updateMatrixWorld(true);
  for(const s of slats){
    const b=new THREE.Box3().setFromObject(s.node,true);
    if(b.max.y<planter.min.y||b.min.y>planter.max.y||b.max.x<planter.min.x||b.min.x>planter.max.x)continue;
    minimum=Math.min(minimum,b.min.z-planter.max.z);
    if(b.intersectsBox(planter))collisions.push({progress,slat:s.node.name});
  }
}
assert.equal(collisions.length,0,'Native planter must clear every animated door slat');
assert.ok(minimum>.12,'Keep meaningful clearance, not merely nonintersection');
const result={samples:101,slats:26,collisions,minimumDepthClearanceMeters:minimum,planterBounds:{min:planter.min.toArray(),max:planter.max.toArray()},movedVertices:points.length,originalTopologyAndUVsRetained:repair.meshes.every(m=>m.UVUnchanged&&m.topologyUnchanged)};
await fs.writeFile('assets/tripo/shutter-clearance/validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
