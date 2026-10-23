import * as THREE from 'three';

// Separate physical products from the scanned cabinet. The source GLB and UVs
// remain untouched; every source triangle belongs to exactly one runtime mesh.
export function installVendingMotion(model, manifest) {
  let source;
  model.traverse(node => {
    if (node.isMesh && node.geometry.attributes.position.count === manifest.vertexCount && node.geometry.index?.count === manifest.triangleCount * 3) source = node;
  });
  if (!source || source.userData.maglevInstalled) return null;
  const original = source.geometry, indices = original.index.array;
  const taken = new Set(manifest.items.flatMap(item => item.faces));
  const remaining = [];
  for (let face = 0; face < manifest.triangleCount; face++) if (!taken.has(face)) remaining.push(...indices.slice(face * 3, face * 3 + 3));
  source.geometry = original.clone(); source.geometry.setIndex(remaining);
  source.userData.maglevInstalled = true;
  const items = [], metal = new THREE.MeshStandardMaterial({color:'#302135',roughness:.74,metalness:.15,side:THREE.DoubleSide});
  const fieldMaterial = new THREE.MeshBasicMaterial({color:'#52ece8',transparent:true,opacity:.55,toneMapped:false,depthWrite:false});
  const liner = new THREE.Mesh(new THREE.PlaneGeometry(.98,1.0),new THREE.MeshStandardMaterial({color:'#201729',roughness:.6,metalness:.15}));
  liner.position.set(-.16,.98,.036); liner.name='MAGLEV_DISPLAY_INNER_LINER'; source.add(liner);
  const deckMaterial=new THREE.MeshStandardMaterial({color:'#202431',roughness:.44,metalness:.55});
  for(const floor of new Set(manifest.items.map(item=>item.floor))){
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.98,.012,.36),deckMaterial);
    deck.name='MAGLEV_INSET_SHELF_DECK';deck.position.set(-.16,floor+.002,.18);deck.receiveShadow=true;source.add(deck);
  }
  for (const [index,item] of manifest.items.entries()) {
    const pivot = new THREE.Group(); pivot.name='MAGLEV_PRODUCT_'+item.name;
    const center = new THREE.Vector3().fromArray(item.pivot);
    const geometry = new THREE.BufferGeometry();
    const selected=item.faces.flatMap(face=>Array.from(indices.slice(face*3,face*3+3)));
    for(const [name,attribute] of Object.entries(original.attributes)){
      const values=new attribute.array.constructor(selected.length*attribute.itemSize);
      selected.forEach((vertex,i)=>{for(let axis=0;axis<attribute.itemSize;axis++)values[i*attribute.itemSize+axis]=attribute.array[vertex*attribute.itemSize+axis];});
      geometry.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize,attribute.normalized));
    }
    geometry.setIndex(selected.map((_,i)=>i));
    geometry.translate(-center.x,-center.y,-center.z);
    const mesh = new THREE.Mesh(geometry,source.material); mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={assetId:source.userData.assetId,maglevProduct:item.name};pivot.add(mesh);
    const caps = closeCutEdges(geometry, metal); if(caps)pivot.add(caps);
    // A smaller display envelope provides clearance for a complete revolution.
    const vertices=geometry.attributes.position;let radius=0;
    for(const vertex of geometry.index.array)radius=Math.max(radius,Math.hypot(vertices.getX(vertex),vertices.getZ(vertex)));
    const neighbours=manifest.items.filter(other=>other!==item&&Math.abs(other.floor-item.floor)<.02);
    const nearest=Math.min(...neighbours.map(other=>Math.abs(other.pivot[0]-center.x)));
    const scale=Math.min(.86,.175/radius,nearest*.46/radius);pivot.scale.setScalar(scale);
    const restY=item.floor+(center.y-item.floor)*scale+.035;
    pivot.position.set(center.x,restY,.215);source.add(pivot);
    const ringRadius=Math.min(.085,radius*.65);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(ringRadius,.0028,5,32),fieldMaterial.clone());
    ring.rotation.x=Math.PI/2;ring.position.set(center.x,item.floor+.012,.215);ring.name='MAGLEV_COIL_'+item.name;source.add(ring);
    items.push({pivot,ring,restY,radius:radius*scale,phase:index*2.399,speed:(.11+index%4*.019)*(index%2?-1:1)});
  }
  original.dispose();
  source.userData.maglevProductCount=items.length;
  let time=0;
  return {items,animate(delta,enabled){
    if(!enabled)return;
    time+=delta;
    for(const item of items){
      item.pivot.position.y=item.restY+.010*Math.sin(time*.95+item.phase);
      item.pivot.rotation.y=time*item.speed;
      item.ring.material.opacity=.39+.14*Math.sin(time*.95+item.phase);
    }
  }};
}

function closeCutEdges(geometry,material) {
  const positions=geometry.attributes.position, edges=new Map(),points=new Map();
  const key=i=>[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>Math.round(v*100000)).join(',');
  const ids=geometry.index.array;
  for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){
    const a=ids[i+j],b=ids[i+(j+1)%3],ka=key(a),kb=key(b);if(ka===kb)continue;
    points.set(ka,new THREE.Vector3().fromBufferAttribute(positions,a));points.set(kb,new THREE.Vector3().fromBufferAttribute(positions,b));
    const edge=[ka,kb].sort().join('|');if(edges.has(edge))edges.get(edge).count++;else edges.set(edge,{a:ka,b:kb,count:1});
  }
  const boundary=[...edges.values()].filter(e=>e.count===1),caps=[];
  while(boundary.length){
    const edge=boundary.pop(),loop=[edge.a,edge.b];
    for(let guard=0;guard<500&&loop.at(-1)!==loop[0];guard++){
      const next=boundary.findIndex(e=>e.a===loop.at(-1)||e.b===loop.at(-1));if(next<0)break;
      const e=boundary.splice(next,1)[0];loop.push(e.a===loop.at(-1)?e.b:e.a);
    }
    if(loop.length<4||loop.at(-1)!==loop[0])continue;
    const center=new THREE.Vector3();for(const k of loop.slice(0,-1))center.add(points.get(k));center.divideScalar(loop.length-1);
    for(let i=0;i<loop.length-1;i++)caps.push(...center.toArray(),...points.get(loop[i]).toArray(),...points.get(loop[i+1]).toArray());
  }
  if(!caps.length)return null;
  const capGeometry=new THREE.BufferGeometry();capGeometry.setAttribute('position',new THREE.Float32BufferAttribute(caps,3));capGeometry.computeVertexNormals();
  const mesh=new THREE.Mesh(capGeometry,material);mesh.name='SEALED_PRODUCT_CUTS';return mesh;
}

// Two isolated dips per event, with long, independently timed stable periods.
// No global exposure modulation: only the affected glass circuit loses power.
export function voltageAt(age) {
  if(age<0||age>.78)return 1;
  if(age<.095)return .24;
  if(age<.29)return 1;
  if(age<.385)return .48;
  return 1+.075*Math.sin((age-.385)/.395*Math.PI);
}
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function createAmbientMotion(scene) {
  let circuits=[],clock=0,active=false;
  const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),anchor=new THREE.Vector3();
  function clear(){for(const c of circuits){restore(c);c.sparks.removeFromParent();c.sparks.geometry.dispose();c.sparks.material.dispose();}circuits=[];}
  function restore(c){for(const m of c.materials){m.material.color.copy(m.color);if(m.emissive!==undefined)m.material.emissiveIntensity=m.emissive;}if(c.light)c.light.intensity=c.intensity;c.sparks.visible=false;}
  function rebuild(entries){
    clear();
    const roots=[];
    scene.traverse(node=>{if(['LOCAL_DESIGNED_NEON_LETTERING','LOCAL_SHENZHEN_NEON_FACE','LOCAL_PROJECTS_NEON_MARQUEE'].includes(node.name))roots.push(node);});
    for(const root of roots){
      const materials=[],seen=new Set(),tubes=[];
      root.traverse(node=>{if(!node.isMesh||!node.name.startsWith('LOCAL_NEON_TUBE_'))return;tubes.push(node);
        for(const material of Array.isArray(node.material)?node.material:[node.material])if(!seen.has(material)){
          seen.add(material);materials.push({material,color:material.color.clone(),emissive:material.isMeshStandardMaterial?material.emissiveIntensity:undefined});
        }
      });
      if(!tubes.length)continue;
      const emitter=tubes[Math.floor(tubes.length*.29)];
      add({root,materials,emitter,point:new THREE.Vector3().fromBufferAttribute(emitter.geometry.attributes.position,0)});
    }
    const lamp=entries.get('08_street_lamp');
    if(lamp?.lamp){
      let diffuser=lamp.mount.getObjectByName('STREET_LAMP_LIVE_DIFFUSER');
      if(!diffuser){
        diffuser=new THREE.Mesh(new THREE.PlaneGeometry(.31,.13),new THREE.MeshBasicMaterial({color:'#ffd9a0',toneMapped:false,side:THREE.DoubleSide}));
        diffuser.name='STREET_LAMP_LIVE_DIFFUSER';
        const socket=lamp.mount.localToWorld(new THREE.Vector3(...lamp.config.lightAnchor));
        const ray=new THREE.Raycaster(socket.clone().add(new THREE.Vector3(0,-.4,0)),new THREE.Vector3(0,1,0),0,.8);
        const underside=ray.intersectObject(lamp.model,true)[0];
        diffuser.position.copy(lamp.mount.worldToLocal(underside?underside.point:socket));diffuser.position.y-=.006;
        diffuser.rotation.x=-Math.PI/2;lamp.mount.add(diffuser);
      }
      add({root:lamp.mount,materials:[{material:diffuser.material,color:diffuser.material.color.clone()}],light:lamp.lamp,intensity:lamp.lamp.intensity,emitter:diffuser,point:new THREE.Vector3(),street:true});
    }
  }
  function add(data){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*6),3));
    const sparks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#ffd999',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    sparks.name='INTERMITTENT_ELECTRICAL_SPARKS';sparks.frustumCulled=false;sparks.visible=false;scene.add(sparks);
    const index=circuits.length;
    circuits.push({...data,sparks,next:clock+4+index*3.7,started:-100,events:0,index,box:new THREE.Box3().setFromObject(data.root)});
  }
  function animate(delta,enabled,camera){
    if(!enabled){if(active)for(const c of circuits)restore(c);active=false;return false;}
    active=true;clock+=delta;
    matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
    for(const c of circuits){
      const visible=frustum.intersectsBox(c.box);
      if(clock>=c.next){c.started=clock;c.events++;c.next=clock+14+hash(c.events+c.index*17)*19;}
      const age=clock-c.started,factor=voltageAt(age);
      for(const m of c.materials){m.material.color.copy(m.color).multiplyScalar(m.emissive===undefined?factor:1);if(m.emissive!==undefined)m.material.emissiveIntensity=m.emissive*factor;}
      if(c.light)c.light.intensity=c.intensity*factor;
      // A short, gravity-driven shower at a tube socket; never at screen space.
      const sparkAge=age-.28,show=visible&&!c.street&&sparkAge>0&&sparkAge<.65;
      c.sparks.visible=show;if(!show)continue;
      anchor.copy(c.point);c.emitter.localToWorld(anchor);c.sparks.position.copy(anchor);
      const vertices=c.sparks.geometry.attributes.position;
      for(let i=0;i<12;i++){
        const seed=i+c.events*31+c.index*101,angle=hash(seed)*Math.PI*2,speed=.11+hash(seed+1)*.3;
        for(let end=0;end<2;end++){
          const t=Math.max(0,sparkAge-end*.035),vx=Math.cos(angle)*speed,vz=Math.sin(angle)*speed*.6;
          vertices.setXYZ(i*2+end,vx*t,(.06+hash(seed+4)*.2)*t-.85*t*t,vz*t);
        }
      }
      vertices.needsUpdate=true;c.sparks.material.opacity=(1-sparkAge/.65)*.9;
    }
    return circuits.length>0;
  }
  return {rebuild,animate,dispose:clear};
}
