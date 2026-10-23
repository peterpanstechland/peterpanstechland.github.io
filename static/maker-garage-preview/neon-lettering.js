import * as THREE from 'three';

// Original signwriter paths. Coordinates are pen strokes, not font outlines.
const script = {
  P: {advance:1.02, paths:[
    'M -.18 .12 C .04 -.12 .28 -.02 .39 .34 C .50 .69 .62 1.04 .80 1.10',
    'M .02 .73 C -.07 .98 .34 1.22 .80 1.12 C 1.24 1.02 1.00 .57 .39 .60']},
  e: {advance:.60, paths:['M 0 .12 C .22 .19 .59 .45 .46 .54 C .30 .68 .07 .35 .15 .14 C .22 -.03 .48 .04 .64 .22']},
  t: {advance:.49, paths:['M .05 .10 C .20 .34 .40 .79 .46 .95 C .28 .58 .12 .06 .28 .04 C .39 .01 .48 .16 .54 .22','M .10 .57 C .26 .60 .43 .62 .61 .60']},
  r: {advance:.55, paths:['M 0 .12 C .18 .30 .25 .48 .27 .55 C .25 .25 .40 .62 .51 .53 C .59 .46 .39 .33 .40 .20 C .41 .05 .51 .12 .60 .22']},
  a: {advance:.65, paths:['M .51 .47 C .30 .73 .06 .38 .12 .16 C .21 -.05 .46 .15 .56 .50 C .43 .19 .44 .01 .58 .09 L .70 .22']},
  n: {advance:.70, paths:['M 0 .12 C .16 .31 .25 .51 .28 .55 L .15 .11 C .34 .46 .55 .65 .62 .48 C .68 .36 .42 .03 .61 .08 L .75 .22']},
  s: {advance:.61, paths:['M 0 .12 C .20 .30 .35 .45 .46 .61 C .18 .54 .65 .30 .48 .11 C .34 -.04 .10 .04 .14 .18 C .18 .27 .35 .12 .64 .22']},
  '’': {advance:.18, paths:['M .13 .87 C .15 .77 .11 .70 .02 .65']},
};
// Streamlined outline capitals, with deliberately open tube ends at the joins.
const block = {
  Z:[[[0,1],[1,1],[1,.80],[.34,.22],[1,.22],[1,0],[0,0],[0,.20],[.66,.78],[0,.78],[0,.97]]],
  P:[[[0,0],[0,1],[.73,1],[1,.78],[1,.56],[.73,.35],[.25,.35],[.25,0],[.03,0]],[[.25,.57],[.65,.57],[.75,.65],[.75,.73],[.65,.80],[.25,.80],[.25,.60]]],
  R:[[[0,0],[0,1],[.73,1],[1,.78],[1,.56],[.79,.39],[1,0],[.71,0],[.52,.35],[.25,.35],[.25,0],[.03,0]],[[.25,.57],[.65,.57],[.75,.65],[.75,.73],[.65,.80],[.25,.80],[.25,.60]]],
  O:[[[.24,0],[0,.24],[0,.76],[.24,1],[.76,1],[1,.76],[1,.24],[.76,0],[.27,0]],[[.34,.22],[.66,.22],[.75,.32],[.75,.68],[.66,.78],[.34,.78],[.25,.68],[.25,.32],[.32,.24]]],
  J:[[[.75,1],[1,1],[1,.24],[.76,0],[.24,0],[0,.24],[0,.40],[.25,.40],[.25,.32],[.34,.22],[.66,.22],[.75,.32],[.75,.97]]],
  S:[[[1,.93],[.80,1],[.22,1],[0,.78],[0,.60],[.20,.43],[.71,.38],[.76,.32],[.76,.25],[.70,.20],[.30,.20],[.09,.29],[0,.08],[.22,0],[.78,0],[1,.22],[1,.43],[.79,.60],[.30,.65],[.24,.71],[.24,.76],[.30,.80],[.72,.80],[.91,.73],[1,.90]]],
  T:[[[0,1],[1,1],[1,.79],[.62,.79],[.62,0],[.38,0],[.38,.79],[0,.79],[0,.97]]],
  E:[[[1,1],[0,1],[0,0],[1,0],[1,.2],[.25,.2],[.25,.41],[.84,.41],[.84,.61],[.25,.61],[.25,.8],[1,.8],[1,.97]]],
  C:[[[1,.92],[.80,1],[.24,1],[0,.76],[0,.24],[.24,0],[.80,0],[1,.08],[.91,.29],[.72,.22],[.34,.22],[.25,.32],[.25,.68],[.34,.78],[.72,.78],[.91,.71],[1,.89]]],
  H:[[[0,1],[.24,1],[.24,.61],[.76,.61],[.76,1],[1,1],[1,0],[.76,0],[.76,.39],[.24,.39],[.24,0],[0,0],[0,.97]]],
  L:[[[0,1],[.25,1],[.25,.22],[1,.22],[1,0],[0,0],[0,.97]]],
  A:[[[0,0],[.35,1],[.65,1],[1,0],[.74,0],[.66,.25],[.34,.25],[.26,0],[.03,0]],[[.41,.47],[.50,.77],[.59,.47],[.44,.47]]],
  N:[[[0,0],[0,1],[.24,1],[.76,.37],[.76,1],[1,1],[1,0],[.76,0],[.24,.63],[.24,0],[.03,0]]],
  D:[[[0,0],[0,1],[.64,1],[1,.74],[1,.26],[.64,0],[.03,0]],[[.25,.22],[.57,.22],[.75,.36],[.75,.64],[.57,.78],[.25,.78],[.25,.25]]],
};

function penPath(data, transform) {
  const tokens=data.match(/[MLCQ]|-?(?:\d*\.)?\d+/g),path=new THREE.CurvePath();let i=0,p;
  const point=()=>transform(+tokens[i++],+tokens[i++]);
  while(i<tokens.length){const cmd=tokens[i++];
    if(cmd==='M')p=point();
    else if(cmd==='L'){const q=point();path.add(new THREE.LineCurve3(p,q));p=q;}
    else if(cmd==='C'){const a=point(),b=point(),q=point();path.add(new THREE.CubicBezierCurve3(p,a,b,q));p=q;}
    else if(cmd==='Q'){const a=point(),q=point();path.add(new THREE.QuadraticBezierCurve3(p,a,q));p=q;}
  }return path;
}
function roundedPath(points, transform) {
  const p=points.map(([x,y])=>transform(x,y)),path=new THREE.CurvePath();let last=p[0];
  for(let i=1;i<p.length-1;i++){
    const r=Math.min(.014,p[i].distanceTo(p[i-1])*.23,p[i].distanceTo(p[i+1])*.23);
    const a=p[i].clone().addScaledVector(p[i-1].clone().sub(p[i]).normalize(),r);
    const b=p[i].clone().addScaledVector(p[i+1].clone().sub(p[i]).normalize(),r);
    path.add(new THREE.LineCurve3(last,a));path.add(new THREE.QuadraticBezierCurve3(a,p[i],b));last=b;
  }path.add(new THREE.LineCurve3(last,p.at(-1)));return path;
}

function neonWriter(sign,z,assetId,samplesPerUnit=180) {
  const hardware=new THREE.MeshStandardMaterial({color:'#403a43',metalness:.7,roughness:.43});
  const palettes={};let count=0;
  function tube(path,color,radius=.0058,name='LETTER'){
    if(!palettes[color])palettes[color]=[
      new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:4.2,roughness:.22,metalness:.04}),
      new THREE.MeshBasicMaterial({color:new THREE.Color(color).lerp(new THREE.Color('white'),.48),toneMapped:false})];
    const segments=Math.max(32,Math.ceil(path.getLength()*samplesPerUnit));
    for(const [r,mat,dz] of [[radius,palettes[color][0],0],[radius*.31,palettes[color][1],radius*.85]]){
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,segments,r,6,false),mat);
      mesh.position.z=z+dz;mesh.name='LOCAL_NEON_TUBE_'+name;
      mesh.userData={locallyAuthored:true,assetId};sign.add(mesh);
    }
    for(const t of [0,1]){
      const socket=new THREE.Mesh(new THREE.CylinderGeometry(radius*1.4,radius*1.4,.016,6),hardware);
      socket.rotation.x=Math.PI/2;socket.position.copy(path.getPoint(t));socket.position.z=z-.008;socket.userData={locallyAuthored:true,assetId};sign.add(socket);
    }count++;
  }
  return {tube,get count(){return count;}};
}

export function addNeonLetters(parent,z) {
  const sign=new THREE.Group();sign.name='LOCAL_DESIGNED_NEON_LETTERING';parent.add(sign);
  const writer=neonWriter(sign,z,'01_garage_shell'),{tube}=writer;
  // A rising, connected signature contrasts with a wide architectural wordmark.
  let x=-.94;
  for(const c of 'Peter Pan’s'){
    if(c===' '){x+=.13;continue;}
    const glyph=script[c];
    const transform=(u,v)=>new THREE.Vector3(x+u*.29,.015+v*.235+(x+.94)*.022,0);
    for(const data of glyph.paths)tube(penPath(data,transform),'#ff579c',.0075,'SCRIPT_'+c);
    x+=glyph.advance*.29;
  }
  // The capital P starts with an extended signwriter's loop and trailing flourish.
  tube(penPath('M -1.01 .10 C -1.24 .01 -1.14 -.04 -.91 -.02 C -.70 .00 -.50 .015 -.30 .015', (x,y)=>new THREE.Vector3(x,y,0)),'#ff579c',.0045,'SWASH');
  tube(penPath('M .63 .035 C .90 .06 1.08 .12 1.13 .21 C 1.16 .27 1.09 .27 1.05 .23',(x,y)=>new THREE.Vector3(x,y,0)),'#ff579c',.0045,'EXIT_SWASH');
  const word='TECHLAND',width=2.02,gap=.043,w=(width-gap*7)/8;
  [...word].forEach((c,i)=>{
    const transform=(u,v)=>new THREE.Vector3(-width/2+i*(w+gap)+u*w+v*.025,-.253+v*.205,0);
    for(const points of block[c])tube(roundedPath(points,transform),'#44e5df',.005,'OUTLINE_'+c);
  });
  // Sparse amber accent lights: broken orbital arcs and a small four-point spark.
  const v=(x,y)=>new THREE.Vector3(x,y,0);
  tube(penPath('M -1.16 .02 C -1.23 .16 -1.11 .29 -.91 .31 C -.70 .33 -.51 .32 -.39 .31',v),'#ffd18a',.0035,'HALO_LEFT');
  tube(penPath('M .87 -.30 L 1.12 -.30 Q 1.19 -.30 1.19 -.23 L 1.19 -.07',v),'#ffd18a',.0035,'FRAME_RIGHT');
  tube(penPath('M -1.17 -.12 L -1.17 -.24 Q -1.17 -.30 -1.10 -.30 L -.78 -.30',v),'#44e5df',.0035,'FRAME_LEFT');
  tube(penPath('M 1.11 .285 Q 1.13 .225 1.18 .215 Q 1.13 .20 1.11 .15 Q 1.10 .20 1.05 .215 Q 1.10 .225 1.11 .285',v),'#ffd18a',.0035,'SPARK');
  parent.userData.neon={method:'Original cursive Bezier signature and rounded outline capitals, physical glass tubes and sockets',strokes:writer.count,lines:['Peter Pan’s','TECHLAND'],design:'Signwriter signature / streamlined capitals / broken amber orbit'};
}

export function addVendingNeon(parent,width,height) {
  const sign=new THREE.Group();sign.name='LOCAL_PROJECTS_NEON_MARQUEE';
  // The cabinet's original red bezel is the only frame. Fill its shallow
  // header recess with evenly spaced letters, without a second framed badge.
  const scale=Math.min(width/2.62,height/.40);sign.scale.setScalar(scale);parent.add(sign);
  const writer=neonWriter(sign,.008,'05_project_vending',85),{tube}=writer;
  const word='PROJECTS',w=.246,gap=.058,start=-(8*w+7*gap+.035)/2;
  [...word].forEach((c,i)=>{
    const transform=(u,v)=>new THREE.Vector3(start+i*(w+gap)+u*w+v*.035,-.145+v*.29,0);
    for(const points of block[c])tube(roundedPath(points,transform),'#44e5df',.006,'PROJECTS_'+c);
  });
  parent.userData.neon={text:'PROJECTS',strokes:writer.count,design:'Full-width recessed cabinet lettering; original red bezel is the only frame',physicalTubes:true};
}

export function addCityNeon(parent,z){
  const face=new THREE.Group();face.name='LOCAL_SHENZHEN_NEON_FACE';face.position.z=z;parent.add(face);
  const backing=new THREE.Mesh(new THREE.PlaneGeometry(.582,.942),new THREE.MeshStandardMaterial({color:'#080f19',metalness:.38,roughness:.29}));
  backing.position.z=-.012;backing.name='SHENZHEN_SMOKED_LIGHTBOX';backing.userData={assetId:'01_garage_shell',locallyAuthored:true};face.add(backing);
  const writer=neonWriter(face,0,'01_garage_shell',130),{tube}=writer;
  // Correct handwritten centre-lines for 氵 + 罙 and 土 + 川. Each is a
  // separate bent glass stroke, with deliberate breaks between radicals.
  const hanzi=[
    {name:'深',y:.040,paths:[
      'M .10 .90 L .23 .80','M .06 .64 L .19 .56','M .10 .13 L .25 .39',
      'M .39 .90 L .39 .75','M .40 .92 L .90 .92 L .90 .75',
      'M .57 .77 Q .53 .66 .43 .61','M .72 .77 Q .76 .66 .86 .61',
      'M .39 .48 L .92 .48','M .66 .61 L .66 .08',
      'M .64 .46 Q .54 .25 .36 .13','M .69 .46 Q .79 .25 .95 .14']},
    {name:'圳',y:-.294,paths:[
      'M .06 .64 L .39 .64','M .24 .88 L .24 .20','M .06 .16 L .40 .27',
      'M .52 .88 L .52 .43 Q .52 .19 .44 .10',
      'M .70 .85 L .70 .17','M .89 .92 L .89 .08']},
  ];
  for(const glyph of hanzi){
    const transform=(x,y)=>new THREE.Vector3((x-.5)*.46,glyph.y+y*.326,0);
    for(const p of glyph.paths)tube(penPath(p,transform),'#39e8e0',.0058,'SHENZHEN_'+glyph.name);
  }
  const english={
    S:['M .95 .88 C .72 1.09 .02 1.04 .02 .76 C .02 .48 .98 .53 .98 .25 C .98 -.04 .24 -.08 .02 .13'],
    H:['M 0 0 L 0 1','M 1 0 L 1 1','M 0 .5 L 1 .5'],
    E:['M 1 1 L 0 1 L 0 0 L 1 0','M 0 .5 L .85 .5'],
    N:['M 0 0 L 0 1 L 1 0 L 1 1'],
    Z:['M 0 1 L 1 1 L 0 0 L 1 0'],
  };
  const word='SHENZHEN',width=.43,gap=.015,w=(width-gap*7)/8;
  [...word].forEach((c,i)=>{
    const transform=(u,v)=>new THREE.Vector3(-width/2+i*(w+gap)+u*w,-.389+v*.043,0);
    for(const path of english[c])tube(penPath(path,transform),'#ff79b6',.0022,'CITY_EN_'+c);
  });
  const v=(x,y)=>new THREE.Vector3(x,y,0);
  tube(penPath('M -.13 .435 L -.235 .435 Q -.267 .435 -.267 .403 L -.267 .21',v),'#ff419e',.0035,'CITY_TOP_LEFT');
  tube(penPath('M .13 -.435 L .235 -.435 Q .267 -.435 .267 -.403 L .267 -.21',v),'#ff419e',.0035,'CITY_BOTTOM_RIGHT');
  tube(penPath('M -.11 -.321 L .11 -.321',v),'#e6bd82',.0018,'CITY_DIVIDER');
  face.userData={locallyAuthored:true,assetId:'01_garage_shell',neon:{text:['深圳','SHENZHEN'],hanziStrokes:17,physicalTubes:true}};
  return face;
}
