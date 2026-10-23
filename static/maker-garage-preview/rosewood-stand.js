// Locally modelled pierced rosewood furniture. No texture substitutes for carving.
export function createRosewoodStand(THREE,{center,width,depth,top,feet,heights}) {
  const stand=new THREE.Group();stand.name='LOCAL_LUCKY_CAT_DISPLAY_STAND';
  stand.userData={locallyAuthored:true,supportHardware:true,assetId:'04_lucky_cat',provenance:'Eight-legged rosewood flower stand with real pierced bat and foliage carving'};
  const grain=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const wave=Math.sin(x*.58+Math.sin(y*.034)*1.4)+.3*Math.sin(x*2.1+y*.021),i=(y*128+x)*4;
    grain[i]=76+wave*6;grain[i+1]=31+wave*3;grain[i+2]=23+wave*2;grain[i+3]=255;
  }
  const map=new THREE.DataTexture(grain,128,128);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  const wood=new THREE.MeshPhysicalMaterial({map,roughness:.31,metalness:0,clearcoat:.26,clearcoatRoughness:.3});
  const dark=new THREE.MeshStandardMaterial({color:'#3c1c16',roughness:.34});
  const polished=new THREE.MeshPhysicalMaterial({color:'#633124',roughness:.29,clearcoat:.3,clearcoatRoughness:.26});
  function mesh(name,geometry,material=wood,parent=stand){
    const node=new THREE.Mesh(geometry,material);node.name=name;node.castShadow=true;node.receiveShadow=true;node.userData={...stand.userData};parent.add(node);return node;
  }
  function octagon(w,d,cut){return [[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]];}
  function slab(name,w,d,cut,y,thickness,mat,bevel=.002){
    const s=new THREE.Shape();octagon(w,d,cut).forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,steps:1});
    const n=mesh(name,g,mat);n.rotation.x=-Math.PI/2;n.position.set(center.x,y-thickness,center.z);return n;
  }
  function rail(name,a,b,r,mat=wood,parent=stand){
    const curve=new THREE.LineCurve3(new THREE.Vector3(...a),new THREE.Vector3(...b));return mesh(name,new THREE.TubeGeometry(curve,1,r,8,false),mat,parent);
  }
  // A thin floating panel within a moulded octagonal top; recessed waist below.
  slab('ROSEWOOD_TOP_OGEE',width,depth,.071,top-.005,.022,wood,.004);
  slab('ROSEWOOD_RECESSED_TOP_PANEL',width-.044,depth-.044,.065,top-.001,.006,dark,.001);
  slab('ROSEWOOD_TOP_FINE_LIP',width-.012,depth-.012,.070,top-.028,.007,polished,.0015);
  slab('ROSEWOOD_RECESSED_WAIST',width-.070,depth-.070,.057,top-.035,.024,dark,.001);
  slab('ROSEWOOD_LOWER_CORNICE',width-.030,depth-.030,.065,top-.062,.011,wood,.0025);
  // Eight independent, capped, faceted legs. Adjacent legs form a pair at each corner.
  feet.forEach(([x,z],i)=>{
    const bottom=heights[i]-.002,h=top-.071-bottom,sx=Math.sign(x-center.x),sz=Math.sign(z-center.z);
    const profile=[[0,.025,.004],[.018,.028,.003],[.045,.022,-.002],[.10,.020,-.004],[.68,.021,-.003],[.84,.024,0],[.94,.027,0],[1,.027,0]];
    const ring=[[-1,-.65],[-.65,-1],[.65,-1],[1,-.65],[1,.65],[.65,1],[-.65,1],[-1,.65]],v=[],uv=[],indices=[];
    profile.forEach(([t,w,offset],r)=>ring.forEach(([a,b],j)=>{
      v.push(x+sx*offset+a*w/2,bottom+t*h,z+sz*offset+b*w/2);uv.push(j/8,t*3);
      if(r){const p=(r-1)*8+j,q=(r-1)*8+(j+1)%8;indices.push(p,r*8+j,q,q,r*8+j,r*8+(j+1)%8);}
    }));
    for(let j=1;j<7;j++){indices.push(0,j,j+1);const end=(profile.length-1)*8;indices.push(end,end+j+1,end+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    mesh('ROSEWOOD_LEG_'+(i+1),g);
    // Two understated collars articulate the joinery, not decorative metal bands.
    for(const y of [top-.092,top-.212]){
      const collar=mesh('ROSEWOOD_CARVED_LEG_COLLAR',new THREE.BoxGeometry(.030,.007,.030),polished);collar.position.set(x,y,z);
    }
  });
  function relief(name,shape,parent,depth=.012,material=wood){
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:2,curveSegments:12,steps:1});g.translate(0,0,-depth/2);return mesh(name,g,material,parent);
  }
  function bat(){
    const s=new THREE.Shape();s.moveTo(-.010,.016);s.lineTo(-.015,.032);s.lineTo(-.003,.025);s.lineTo(.003,.025);s.lineTo(.015,.032);s.lineTo(.010,.016);
    s.bezierCurveTo(.031,.021,.054,.045,.092,.035);s.bezierCurveTo(.076,.023,.078,.010,.085,.002);
    s.bezierCurveTo(.059,.014,.058,-.025,.037,-.018);s.quadraticCurveTo(.023,-.014,.015,-.027);s.lineTo(0,-.044);s.lineTo(-.015,-.027);
    s.quadraticCurveTo(-.023,-.014,-.037,-.018);s.bezierCurveTo(-.058,-.025,-.059,.014,-.085,.002);
    s.bezierCurveTo(-.078,.010,-.076,.023,-.092,.035);s.bezierCurveTo(-.054,.045,-.031,.021,-.010,.016);s.closePath();
    for(const sign of [-1,1]){const hole=new THREE.Path();hole.moveTo(sign*.026,.010);hole.bezierCurveTo(sign*.043,.025,sign*.058,.032,sign*.074,.029);hole.bezierCurveTo(sign*.057,.010,sign*.041,-.003,sign*.026,.010);hole.closePath();s.holes.push(hole);}
    return s;
  }
  function scroll(parent,sign,span){
    const path=new THREE.CurvePath(),p=(x,y)=>new THREE.Vector3(sign*x,y,0);
    path.add(new THREE.CubicBezierCurve3(p(span/2,0),p(span/2-.015,-.07),p(.13,-.10),p(.105,-.064)));
    path.add(new THREE.CubicBezierCurve3(p(.105,-.064),p(.085,-.032),p(.15,-.035),p(.143,-.061)));
    path.add(new THREE.CubicBezierCurve3(p(.143,-.061),p(.14,-.082),p(.12,-.075),p(.124,-.060)));
    mesh('ROSEWOOD_PIERCED_RUYI_SCROLL',new THREE.TubeGeometry(path,50,.0045,7,false),wood,parent);
    // A pierced leaf bridges the scroll into the bat's outstretched wing.
    const leaf=new THREE.Shape();leaf.moveTo(sign*.075,-.028);leaf.bezierCurveTo(sign*.10,-.002,sign*.13,-.014,sign*.166,-.008);leaf.bezierCurveTo(sign*.146,-.041,sign*.10,-.054,sign*.075,-.028);leaf.closePath();
    const hole=new THREE.Path();hole.moveTo(sign*.093,-.027);hole.quadraticCurveTo(sign*.12,-.016,sign*.147,-.018);hole.quadraticCurveTo(sign*.12,-.034,sign*.093,-.027);hole.closePath();leaf.holes.push(hole);
    relief('ROSEWOOD_PIERCED_FOLIAGE',leaf,parent,.010);
  }
  const railHeight=Math.max(...heights)+.095;
  for(let i=0;i<feet.length;i++){
    const [ax,az]=feet[i],[bx,bz]=feet[(i+1)%feet.length],span=Math.hypot(bx-ax,bz-az);
    rail('ROSEWOOD_LOW_OCTAGON_STRETCHER',[ax,railHeight,az],[bx,railHeight,bz],.008);
    rail('ROSEWOOD_APRON_BEAD',[ax,top-.080,az],[bx,top-.080,bz],.006,polished);
    const face=new THREE.Group();face.name='ROSEWOOD_OPENWORK_APRON_'+i;
    face.position.set((ax+bx)/2,top-.084,(az+bz)/2);face.rotation.y=-Math.atan2(bz-az,bx-ax);stand.add(face);
    if(span>.25){
      const motif=relief('ROSEWOOD_PIERCED_BAT',bat(),face,.016);motif.position.y=-.044;
      scroll(face,-1,span);scroll(face,1,span);
      // Small central tenon joins the bat to the upper apron without filling the opening.
      rail('ROSEWOOD_BAT_TENON',[0,-.004,0],[0,-.028,0],.006,wood,face);
      for(const sign of [-1,1]){
        const s=new THREE.Shape();s.moveTo(sign*span/2,0);s.lineTo(sign*(span/2-.048),0);
        s.bezierCurveTo(sign*(span/2-.039),-.045,sign*(span/2-.012),-.060,sign*(span/2-.008),-.124);s.lineTo(sign*span/2,-.124);s.closePath();
        relief('ROSEWOOD_SHOULDER_BRACKET',s,face,.016);
      }
    }else{
      // Short corner panels remain pierced too, linking each pair of legs.
      const s=new THREE.Shape();s.moveTo(-span/2,0);s.lineTo(span/2,0);s.lineTo(span/2,-.09);s.quadraticCurveTo(0,-.11,-span/2,-.09);s.closePath();
      const hole=new THREE.Path();hole.absellipse(0,-.042,span*.24,.026,0,Math.PI*2,true);s.holes.push(hole);relief('ROSEWOOD_PIERCED_CORNER',s,face);
    }
  }
  stand.traverse(node=>{node.userData={...node.userData,...stand.userData};});
  stand.userData.design={legs:8,batMotifs:4,piercedAprons:true,lowerRing:'octagonal',wood:'polished dark rosewood'};
  return stand;
}
