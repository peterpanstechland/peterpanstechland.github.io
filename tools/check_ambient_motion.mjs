import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {geometryOnlyGLB} from './glb_geometry_loader.mjs';
import {installVendingMotion,voltageAt,createAmbientMotion} from '../static/maker-garage-preview/ambient-motion.js';
const manifest=JSON.parse(await fs.readFile('static/maker-garage-preview/vending-motion.json','utf8'));
const gltf=await geometryOnlyGLB('static/maker-garage-preview/models/05_project_vending.glb');
const animation=installVendingMotion(gltf.scene,manifest);
assert.equal(animation.items.length,11);
let source;gltf.scene.traverse(n=>{if(n.userData.maglevInstalled)source=n;});
const count=source.geometry.index.count/3+manifest.items.reduce((sum,item)=>sum+item.faces.length,0);
assert.equal(count,manifest.triangleCount,'Every original triangle retained exactly once');
for(let i=0;i<animation.items.length;i++)for(let j=i+1;j<animation.items.length;j++){
  if(Math.abs(manifest.items[i].floor-manifest.items[j].floor)>.02)continue;
  const a=animation.items[i],b=animation.items[j];
  assert.ok(Math.abs(a.pivot.position.x-b.pivot.position.x)>a.radius+b.radius,'Neighbouring products have disjoint spin envelopes');
}
const p=new THREE.Vector3();let lowestClearance=Infinity,maxDepth=-Infinity,minDepth=Infinity;
for(let frame=0;frame<720;frame++){
  animation.animate(.1,true);
  for(const [i,item] of animation.items.entries()){
    item.pivot.updateMatrix();
    const mesh=item.pivot.children[0],positions=mesh.geometry.attributes.position;
    for(let vertex=0;vertex<positions.count;vertex++){
      p.fromBufferAttribute(positions,vertex).applyMatrix4(item.pivot.matrix);
      assert.ok(p.toArray().every(Number.isFinite));
      lowestClearance=Math.min(lowestClearance,p.y-manifest.items[i].floor);
      maxDepth=Math.max(maxDepth,p.z);minDepth=Math.min(minDepth,p.z);
    }
  }
}
assert.ok(lowestClearance>.015,'Display items clear the inset shelf deck at floor + 0.008');
assert.ok(minDepth>.035 && maxDepth<.4,'Rotation stays inside the lined glass cavity');
const before=animation.items.map(i=>i.pivot.matrix.toArray());animation.animate(10,false);
animation.items.forEach((item,i)=>{item.pivot.updateMatrix();assert.deepEqual(item.pivot.matrix.toArray(),before[i]);});
assert.equal(voltageAt(-1),1);assert.equal(voltageAt(2),1);
assert.ok(voltageAt(.04)<.3 && voltageAt(.31)<.5);
// Disabling ambient motion restores both luminous glass and the real lamp.
const scene=new THREE.Scene(),root=new THREE.Group();root.name='LOCAL_DESIGNED_NEON_LETTERING';
const tube=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial({color:'#ff5599',emissive:'#ff5599',emissiveIntensity:4}));tube.name='LOCAL_NEON_TUBE_TEST';root.add(tube);scene.add(root);
const effects=createAmbientMotion(scene);effects.rebuild(new Map());const camera=new THREE.PerspectiveCamera();camera.position.z=3;camera.updateMatrixWorld();
effects.animate(4.04,true,camera);assert.ok(tube.material.emissiveIntensity<4);
effects.animate(0,false,camera);assert.equal(tube.material.emissiveIntensity,4);effects.dispose();
const result={products:animation.items.length,originalTriangles:count,minimumShelfClearance:lowestClearance,depthEnvelope:[minDepth,maxDepth],pausedTransformsStable:true,voltageRestores:true,fullRevolutionsTestedSeconds:72};
await fs.writeFile('assets/tripo/ambient-motion/geometry-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
