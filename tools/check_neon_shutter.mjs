import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {geometryOnlyGLB} from './glb_geometry_loader.mjs';
import {addNeonLetters,addShutterGraffiti} from '../static/maker-garage-preview/neon-shutter.js';
const gltf=await geometryOnlyGLB('static/maker-garage-preview/models/02_roller_shutter.glb');
const scene=new THREE.Scene(),mount=new THREE.Group();mount.scale.set(1,.71,1);mount.position.set(.3,.2,1.13);mount.add(gltf.scene);scene.add(mount);
const root=gltf.scene.getObjectByName('ROLLER_SHUTTER_ROOT'),slats=[];
root.traverse(node=>{if(/^SHUTTER_SLAT_\d+$/.test(node.name))slats.push({node,...node.userData,originalQuaternion:node.quaternion.clone()});});
assert.equal(slats.length,26);
const spec=root.userData.shutter;
function pose(progress){for(const s of slats){const lifted=s.closedY+spec.travel*progress,theta=Math.max(0,(lifted-spec.top)/spec.radius);s.node.position.set(s.closedX,theta?spec.top+spec.radius*Math.sin(theta):lifted,s.closedZ-spec.radius*(1-Math.cos(theta)));s.node.quaternion.copy(s.originalQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-theta));}scene.updateMatrixWorld(true);}
const entry={state:'ready',mount,shutter:{slats}};
const outputs=[];
for(const initial of [0,.5,1]) {
  pose(initial);const group=new THREE.Group();scene.add(group);
  addShutterGraffiti(group,entry,{width:2048,height:560});
  assert.ok(group.children.length>6,'Paint must cover multiple real slats');
  const parent=new THREE.Group();parent.position.set(.05,-.22,.1);scene.add(parent);parent.attach(group);
  let maxDrift=0;
  for(const progress of [0,.25,.5,.75,1,0]) {
    pose(progress);group.userData.syncShutterGraffiti();scene.updateMatrixWorld(true);
    for(const decal of group.children) {
      const node=gltf.scene.getObjectByName(decal.name.replace('LOCAL_PAINT_',''));
      const points=decal.geometry.attributes.position,uv=decal.geometry.attributes.uv;
      for(let i=0;i<points.count;i++) {
        const local=new THREE.Vector3().fromBufferAttribute(points,i),world=local.clone().applyMatrix4(decal.matrixWorld),expected=local.applyMatrix4(node.matrixWorld);
        assert.ok(world.toArray().every(Number.isFinite));maxDrift=Math.max(maxDrift,world.distanceTo(expected));
        assert.ok(uv.getX(i)>=-1e-5&&uv.getX(i)<=1.00001&&uv.getY(i)>=-1e-5&&uv.getY(i)<=1.00001);
      }
    }
  }
  assert.ok(maxDrift<1e-6);outputs.push({initial,paintedMeshes:group.children.length,maxDrift});parent.removeFromParent();
}
const neon=new THREE.Group();addNeonLetters(neon,.05);assert.ok(neon.userData.neon.strokes>20);
const result={closedHalfOpenAndOpenCreation:outputs,neon:neon.userData.neon};
await fs.writeFile('assets/tripo/neon-shutter/geometry-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
