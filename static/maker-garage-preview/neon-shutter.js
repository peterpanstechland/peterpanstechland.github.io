import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

export {addNeonLetters} from './neon-lettering.js?v=neon-design-v2';

export function addShutterGraffiti(group,entry,canvas) {
  if(!entry?.shutter||entry.state!=='ready')return;
  const {slats}=entry.shutter, projected=[], closedBounds=new THREE.Box3();
  entry.mount.updateMatrixWorld(true);
  // Build closed-pose transforms without interrupting an in-progress animation.
  for(const slat of slats) {
    const closed=new THREE.Matrix4().compose(new THREE.Vector3(slat.closedX,slat.closedY,slat.closedZ),slat.originalQuaternion,slat.node.scale);
    closed.premultiply(slat.node.parent.matrixWorld);
    const liveInverse=slat.node.matrixWorld.clone().invert();
    slat.node.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const source=new THREE.Mesh(mesh.geometry);
      source.matrixWorld.multiplyMatrices(closed,liveInverse.clone().multiply(mesh.matrixWorld));
      mesh.geometry.computeBoundingBox();closedBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(source.matrixWorld));
      projected.push({source,closed,slat});
    });
  }
  if(closedBounds.isEmpty())return;
  const size=closedBounds.getSize(new THREE.Vector3()),center=closedBounds.getCenter(new THREE.Vector3());
  const width=Math.min(2.18,size.x*.70),height=width*280/1024;
  center.x-=.45;center.y=closedBounds.min.y+size.y*.55;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  texture.userData.previewTextureLimit=canvas.width;
  const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,roughness:.85,metalness:.02});
  const bindings=[];
  for(const {source,closed,slat} of projected) {
    const geometry=new DecalGeometry(source,center,new THREE.Euler(),new THREE.Vector3(width,height,size.z+.03));
    if(!geometry.attributes.position.count){geometry.dispose();continue;}
    // Paint only outward-facing metal, never the back of the rolled-up door.
    const positions=geometry.attributes.position,front=[];
    for(let i=0;i<positions.count;i+=3) {
      const ax=positions.getX(i+1)-positions.getX(i),ay=positions.getY(i+1)-positions.getY(i);
      const bx=positions.getX(i+2)-positions.getX(i),by=positions.getY(i+2)-positions.getY(i);
      if(ax*by-ay*bx>1e-10)front.push(i,i+1,i+2);
    }
    if(!front.length){geometry.dispose();continue;}geometry.setIndex(front);
    geometry.applyMatrix4(closed.clone().invert());
    const decal=new THREE.Mesh(geometry,material);decal.name='LOCAL_PAINT_'+slat.node.name;decal.matrixAutoUpdate=false;
    decal.userData={locallyAuthored:true,assetId:'02_roller_shutter',surfacePaint:true};group.add(decal);bindings.push({decal,node:slat.node});
  }
  if(!bindings.length){material.dispose();texture.dispose();return;}
  group.userData.shutterGraffiti={method:'Triangle-clipped surface paint in individual slat coordinates',paintedMeshes:bindings.length,width,height,sourceGeometryModified:false};
  group.userData.syncShutterGraffiti=()=>{
    group.updateWorldMatrix(true,false);const inverse=group.matrixWorld.clone().invert();
    for(const {decal,node} of bindings){decal.matrix.multiplyMatrices(inverse,node.matrixWorld);decal.matrixWorldNeedsUpdate=true;}
  };
}
