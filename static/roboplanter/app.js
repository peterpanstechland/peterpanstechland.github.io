import * as THREE from './vendor/three.module.min.js';

// This page never discovers, connects to, or sends commands to a device.
// All plant state below belongs only to this browser's visual demonstration.
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const moods = {
  chill: { line: '老板的饼我不吃。<br>我光合作用。', quote: ['老板的饼我不吃。', '我光合作用。'], label: '佛系发芽', color: 0xbddf6d },
  busy: { line: '别看我没动。<br>我在后台光合。', quote: ['别看我没动。', '我在后台光合。'], label: '假装很忙', color: 0xddd379 },
  tired: { line: '不是枯了。<br>是在省电。', quote: ['不是枯了。', '是在省电。'], label: '电量见底', color: 0xa9c4a4 },
  happy: { line: '今天的叶子，<br>准点下班。', quote: ['今天的叶子，', '准点下班。'], label: '准点下班', color: 0xa7d785 },
};
let mood = 'chill';
let renderer, scene, camera, plant, leafMaterial, pupils = [], eyes = [], particles, halo;
const lightModes = ['关', '柔绿', '呼吸', '流动', '彩虹'];
let lightMode = 0;
const lightBeads = [];
let elapsed = 0, frozen = false, waterAt = -100, yaw = 0, targetYaw = 0, drag = null;
let lastFrame = 0, frameHandle = 0, pausedForVisibility = false;
let sceneInView = true;
let glAvailable = false;
const worldTarget = new THREE.Vector3(0, 1.32, 0);
const size = { width: 1, height: 1 };
const report = (message) => { $('render-state').textContent = message; };
function mesh(geometry, material, parent = plant) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
function sphere(material, x, y, z, sx, sy = sx, sz = sx, parent = plant) {
  const object = mesh(new THREE.SphereGeometry(1, 40, 24), material, parent);
  object.position.set(x, y, z); object.scale.set(sx, sy, sz); return object;
}
function tube(points, radius, material, parent = plant) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 12, false), material, parent);
}
function initScene() {
  const host = $('scene');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
  camera.position.set(0, 3.15, 8.4); camera.lookAt(worldTarget);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6c9a1, 3));
  const key = new THREE.DirectionalLight(0xfff7dd, 4.2);
  key.position.set(-3, 7, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025;
  key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xd3ffaf, 2.5); rim.position.set(4, 4, -3); scene.add(rim);
  const floor = mesh(new THREE.CircleGeometry(4, 80), new THREE.ShadowMaterial({ color: 0x53633c, opacity: .19 }), scene);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.055; floor.castShadow = false;
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ca, roughness: .9 });
  const plinth = mesh(new THREE.CylinderGeometry(1.56, 1.61, .1, 80), plinthMat, scene);
  plinth.position.y = -.015;
  // Stylised WS2812 ring: visual prototype only, not the real strip layout/count.
  const beadGeometry = new THREE.SphereGeometry(.044, 12, 8);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const bead = mesh(beadGeometry, new THREE.MeshBasicMaterial({color:0xaab79b}), scene);
    bead.position.set(Math.sin(a)*1.43, .053, Math.cos(a)*1.43);
    bead.scale.y=.48; bead.castShadow=false; lightBeads.push(bead);
  }
  plant = new THREE.Group(); scene.add(plant);
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf2d6ae, roughness: .42, metalness: .03 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xffebcc, roughness: .4 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x504534, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23382c, roughness: .32 });
  const white = new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: .32 });
  const peach = new THREE.MeshStandardMaterial({ color: 0xd89675, roughness: .75 });
  leafMaterial = new THREE.MeshStandardMaterial({ color: moods.chill.color, roughness: .55, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x67913c, roughness: .7 });
  const points = [[0,.1],[.52,.1],[.65,.14],[.72,.28],[.85,1.23],[.87,1.28],[.93,1.31],[.96,1.39],[.93,1.47],[.86,1.49],[.82,1.43],[.82,1.34],[.77,1.27],[.65,.32],[.55,.22],[0,.22]];
  mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 88), ceramic);
  const lip = mesh(new THREE.TorusGeometry(.885, .065, 16, 88), lipMat); lip.position.y = 1.42; lip.rotation.x = Math.PI/2;
  const soil = mesh(new THREE.CylinderGeometry(.81,.78,.08,64),soilMat); soil.position.y=1.30;
  const pebbleMat = new THREE.MeshStandardMaterial({color:0x8a7e60,roughness:.95});
  for(let i=0;i<22;i++) {const a=i*2.39996,r=.2+Math.sqrt(i/22)*.5; sphere(pebbleMat,Math.sin(a)*r,1.35,Math.cos(a)*r,.026+(i%3)*.008,.017,.024);}
  tube([[0,1.28,0],[.08,1.65,0],[-.04,2.07,.02],[.09,2.55,0]],.045,stemMat);
  tube([[.04,1.85,0],[-.35,2.12,0],[-.6,2.23,-.03]],.026,stemMat);
  tube([[.01,2.12,0],[.35,2.35,-.03],[.55,2.47,-.07]],.025,stemMat);
  const left=sphere(leafMaterial,-.55,2.25,-.05,.61,.22,.32);left.rotation.z=-.37;
  const right=sphere(leafMaterial,.5,2.5,-.05,.57,.21,.31);right.rotation.z=.5;
  const tip=sphere(leafMaterial,.045,2.75,0,.18,.37,.18);tip.rotation.z=-.23;
  const veinMat=new THREE.MeshStandardMaterial({color:0x84ab47,roughness:.8});
  tube([[-.15,2.17,.20],[-.53,2.3,.25],[-.95,2.4,.10]],.011,veinMat);
  tube([[.15,2.32,.18],[.5,2.5,.23],[.88,2.68,.1]],.011,veinMat);
  for(const x of [-.29,.29]) {
    const eye=sphere(white,x,.91,.735,.205,.235,.11); eyes.push(eye);
    const pupil=sphere(dark,x+.015,.9,.829,.095,.115,.04); pupils.push(pupil);
    sphere(white,x-.006,.94,.866,.025,.03,.011);
  }
  sphere(peach,-.51,.71,.678,.12,.044,.022);sphere(peach,.51,.71,.678,.12,.044,.022);
  tube([[-.1,.69,.815],[0,.645,.839],[.1,.69,.815]],.02,dark);
  // Small, intentionally handmade arms make the silhouette readable on mobile.
  tube([[-.73,.63,.17],[-.93,.72,.15],[-1,.91,.18]],.055,ceramic);
  sphere(ceramic,-1,.94,.18,.075);
  tube([[.73,.63,.17],[.96,.55,.15],[1.05,.66,.18]],.055,ceramic);
  sphere(ceramic,1.05,.68,.18,.075);
  sphere(ceramic,-.36,.08,.19,.19,.11,.27);sphere(ceramic,.36,.08,.19,.19,.11,.27);
  const n=360, positions=new Float32Array(n*3), seeds=new Float32Array(n), hues=new Float32Array(n);
  for(let i=0;i<n;i++){positions[i*3]=(i*1.618%1)*2-1;positions[i*3+1]=(i*.754%1)*2-1;positions[i*3+2]=(i*.569%1)*2-1;seeds[i]=i/n;hues[i]=i%5===0?1:0;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aGold',new THREE.BufferAttribute(hues,1));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    uniforms:{uTime:{value:0},uWater:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio,1.75)}},
    vertexShader:`attribute float aSeed; attribute float aGold; uniform float uTime; uniform float uWater; uniform float uPixelRatio; varying float vAlpha; varying float vGold;
    void main(){float angle=aSeed*83.3+uTime*.22;float radius=1.12+fract(aSeed*17.3)*1.25;vec3 p=vec3(sin(angle)*radius,.25+fract(aSeed*31.7+uTime*.023)*3.4,cos(angle)*radius*.6);
      float w=fract(aSeed*12.1+uTime*.5);vec3 drop=vec3(sin(aSeed*49.)*(.2+w*.9),3.4-w*2.5,cos(aSeed*71.)*(.2+w*.6));p=mix(p,drop,uWater);vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;gl_PointSize=(8.+aSeed*9.)*uPixelRatio*(5./-mv.z);vAlpha=mix(.12,.7,uWater);vGold=aGold;}`,
    fragmentShader:`varying float vAlpha;varying float vGold;void main(){vec2 uv=(gl_PointCoord-.5)*2.;uv.x*=1.2;float alpha=exp(-dot(uv,uv)*3.4)*vAlpha;if(alpha<.012)discard;vec3 color=mix(vec3(.57,.70,.38),vec3(.84,.60,.26),vGold);gl_FragColor=vec4(color,alpha);}`
  });
  particles=new THREE.Points(geometry,particleMaterial);scene.add(particles);
  halo=mesh(new THREE.TorusGeometry(1.45,.012,8,96),new THREE.MeshBasicMaterial({color:0xa0b96d,transparent:true,opacity:.4}),scene);
  halo.rotation.x=-Math.PI/2;halo.position.y=.05;
  new ResizeObserver(resize).observe(host);
  resize();
  host.addEventListener('pointerdown', event=>{drag={x:event.clientX,y:event.clientY,yaw:targetYaw};});
  host.addEventListener('pointermove',event=>{if(drag){const dx=event.clientX-drag.x; if(Math.abs(dx)>7){targetYaw=drag.yaw+dx*.009;}}});
  window.addEventListener('pointerup',()=>{drag=null;});
  host.addEventListener('pointercancel',()=>{drag=null;});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault(); glAvailable=false;cancelAnimationFrame(frameHandle);report('3D 已暂停 · 仍可阅读教程');$('fallback').classList.remove('hidden');});
  glAvailable=true;$('fallback').classList.add('hidden');report('拖动可旋转 · 网页模拟');
  render(0);frameHandle=requestAnimationFrame(animate);
}
function resize(){if(!renderer)return;const host=$('scene');size.width=host.clientWidth;size.height=host.clientHeight;renderer.setSize(size.width,size.height);camera.aspect=size.width/size.height;camera.updateProjectionMatrix();render(performance.now());}
function updateLightPreview(){
  lightBeads.forEach((bead,i)=>{
    if(lightMode===0){bead.material.color.setHex(0xaab79b);return;}
    let level=.65;
    if(lightMode===2)level=.2+.6*(.5-.5*Math.cos(elapsed*Math.PI/2));
    if(lightMode===3){const phase=(elapsed*.3)%1;const distance=Math.min(Math.abs(i/24-phase),1-Math.abs(i/24-phase));level=.12+.8*Math.exp(-distance*distance/0.015);}
    if(lightMode===4)bead.material.color.setHSL((i/24+elapsed*.08)%1,.65,.45);
    else bead.material.color.setRGB(.28*level,.85*level,.12*level);
  });
  if(halo){halo.material.opacity=lightMode===0?.4:.72;halo.material.color.setHex(lightMode===0?0xa0b96d:0x7eac42);}
}
function render(){if(!glAvailable)return;updateLightPreview();renderer.render(scene,camera);}
function animate(now){
  if(!glAvailable||pausedForVisibility)return;
  frameHandle=requestAnimationFrame(animate);
  if(now-lastFrame<33)return;
  const dt=Math.min((now-lastFrame)/1000,.08);lastFrame=now;
  if(!frozen&&!reducedMotion)elapsed+=dt;
  const burst=!frozen?Math.max(0,1-(elapsed-waterAt)/3.8):particles.material.uniforms.uWater.value;
  particles.material.uniforms.uTime.value=elapsed;
  particles.material.uniforms.uWater.value=burst;
  particles.visible=!reducedMotion;
  yaw+=(targetYaw-yaw)*.07;
  plant.rotation.y=yaw+(frozen?0:Math.sin(elapsed*.5)*.08);
  plant.rotation.z=reducedMotion?0:Math.sin(elapsed*.8)*.025;
  plant.position.y=frozen||reducedMotion?0:Math.sin(elapsed*1.4)*.026;
  const blink=!frozen&&!reducedMotion&&elapsed%5.8>5.58;
  eyes.forEach(e=>e.scale.y=blink?.025:(mood==='tired'?.13:.235));
  pupils.forEach(p=>p.scale.y=blink?.01:(mood==='tired'?.07:.115));
  if(frozen&&!reducedMotion){const a=performance.now()*.00017;camera.position.set(Math.sin(a)*3,3.15,Math.cos(a)*1+7.4);camera.lookAt(worldTarget);}else{camera.position.lerp(new THREE.Vector3(0,3.15,8.4),.05);camera.lookAt(worldTarget);}
  render();
}
try{initScene();}catch(error){report('静态模式 · 教程与海报可用');console.warn('RoboPlanter visual unavailable:',error.message);}

document.querySelectorAll('[data-mood]').forEach(button=>button.addEventListener('click',()=>{
  mood=button.dataset.mood;
  document.querySelectorAll('[data-mood]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('plant-line').innerHTML=moods[mood].line;
  if(leafMaterial)leafMaterial.color.setHex(moods[mood].color);
}));
let waterCooldown = false;
$('lighting').addEventListener('click',()=>{
  lightMode=(lightMode+1)%lightModes.length;
  $('lighting-label').textContent='灯效：'+lightModes[lightMode];
  $('lighting').setAttribute('aria-label','切换网页灯效预览，当前'+lightModes[lightMode]);
  report('WS2812 灯效预览 · 不连接真实灯带');
  render();
});
$('water').addEventListener('click',()=>{
  if(waterCooldown)return;
  if(frozen){frozen=false;$('freeze').setAttribute('aria-pressed','false');$('freeze').innerHTML='<span aria-hidden="true">◎</span>定格这一秒';}
  waterAt=elapsed;waterCooldown=true;$('water').disabled=true;
  $('plant-line').innerHTML='收到。<br>你也记得喝一口。';
  report('仅网页动画 · 没有发送水泵命令');
  setTimeout(()=>{waterCooldown=false;$('water').disabled=false;$('plant-line').innerHTML=moods[mood].line;report(glAvailable?'拖动可旋转 · 网页模拟':'静态模式 · 教程与海报可用');},4000);
});
$('freeze').addEventListener('click',()=>{
  if(!glAvailable){report('当前为静态模式 · 无动画可定格');return;}
  frozen=!frozen;$('freeze').setAttribute('aria-pressed',String(frozen));
  $('freeze').innerHTML=frozen?'<span aria-hidden="true">▶</span>让时间继续':'<span aria-hidden="true">◎</span>定格这一秒';
  if(frozen){if(particles.material.uniforms.uWater.value<.1)particles.material.uniforms.uWater.value=.7;report('粒子定格 · 视角继续环绕');}
  else report('拖动可旋转 · 网页模拟');
});
function syncSceneVisibility(){
  pausedForVisibility=document.hidden||!sceneInView;
  cancelAnimationFrame(frameHandle);
  if(!pausedForVisibility&&glAvailable){lastFrame=performance.now();frameHandle=requestAnimationFrame(animate);}
}
document.addEventListener('visibilitychange',syncSceneVisibility);
if('IntersectionObserver' in window){
  new IntersectionObserver(([entry])=>{sceneInView=entry.isIntersecting;syncSceneVisibility();},{rootMargin:'160px'}).observe($('experience'));
}

const dialog=$('poster-dialog');
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function makePoster(){
  const canvas=$('poster-canvas'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#f6f5ef';ctx.fillRect(0,0,1200,1600);
  ctx.fillStyle='#222a23';ctx.font='700 29px system-ui, sans-serif';ctx.fillText('工位搭子',80,105);
  ctx.font='500 17px system-ui, sans-serif';ctx.fillText('ROBOPLANTER / '+moods[mood].label+' / 灯效预览：'+lightModes[lightMode],80,143);
  ctx.fillStyle='#6d746b';ctx.textAlign='right';ctx.fillText('GROW AT YOUR OWN PACE.',1120,105);ctx.textAlign='left';
  ctx.font='750 74px system-ui, sans-serif';ctx.fillStyle='#222a23';moods[mood].quote.forEach((line,i)=>ctx.fillText(line,80,280+i*100));
  ctx.fillStyle='#e9edde';rounded(ctx,65,440,1070,855,34);
  if(renderer&&glAvailable){render();const s=renderer.domElement;const height=800,width=height*size.width/size.height;ctx.drawImage(s,(1200-width)/2,470,width,height);}
  else{ctx.font='220px serif';ctx.fillStyle='#879c60';ctx.textAlign='center';ctx.fillText('♧',600,780);ctx.fillStyle='#efd6ae';rounded(ctx,380,820,440,300,70);ctx.fillStyle='#222a23';ctx.font='90px system-ui';ctx.fillText('•ᴗ•',600,1005);ctx.textAlign='left';}
  ctx.fillStyle='#222a23';ctx.font='700 42px system-ui, sans-serif';ctx.fillText('你先下班，我负责发芽。',80,1390);
  ctx.font='24px system-ui, sans-serif';ctx.fillStyle='#6d746b';ctx.fillText('一盆绿，一个小小的喘息。',80,1440);
  ctx.font='18px system-ui, sans-serif';ctx.fillText('交互概念演示 / 非实机拍摄 / 公开复现项目',80,1510);
  ctx.fillText('peterpanstechland.github.io/roboplanter',80,1544);
}
$('poster').addEventListener('click',()=>{makePoster();$('download-status').textContent='';dialog.showModal();});
$('close-poster').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
function saveCanvas(canvas,filename,message){canvas.toBlob(blob=>{if(!blob){$('download-status').textContent='这次生成失败了，请再试一次。';return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('download-status').textContent=message;},'image/png');}
$('download-poster').addEventListener('click',()=>saveCanvas($('poster-canvas'),'roboplanter-desk-friend-'+mood+'.png','已生成 1200 × 1600 PNG。若浏览器未保存，可长按预览图保存。'));
$('download-cover').addEventListener('click',()=>{
  const cover=document.createElement('canvas');cover.width=1600;cover.height=900;const ctx=cover.getContext('2d');
  ctx.fillStyle='#f6f5ef';ctx.fillRect(0,0,1600,900);ctx.fillStyle='#222a23';ctx.font='700 35px system-ui, sans-serif';ctx.fillText('工位搭子 / ROBOPLANTER',85,110);
  ctx.fillStyle='#e9edde';rounded(ctx,790,50,755,795,35);
  if(renderer&&glAvailable){render();const s=renderer.domElement;const height=740,width=height*size.width/size.height;ctx.drawImage(s,1170-width/2,70,width,height);}
  ctx.fillStyle='#222a23';ctx.font='750 89px system-ui, sans-serif';ctx.fillText('你先下班，',85,330);ctx.fillText('我负责发芽。',85,455);
  ctx.fillStyle='#6d746b';ctx.font='29px system-ui, sans-serif';ctx.fillText('一盆有点嘴硬的绿。一个不催进度的搭子。',85,560);
  ctx.fillStyle='#c4eb72';rounded(ctx,85,620,340,74,9);ctx.fillStyle='#222a23';ctx.font='600 25px system-ui, sans-serif';ctx.fillText('硬件你来选 · 对话交给 YOYO',104,667);
  ctx.fillStyle='#6d746b';ctx.font='21px system-ui, sans-serif';ctx.fillText('交互概念演示 / 非实机拍摄',85,795);ctx.fillText('peterpanstechland.github.io/roboplanter',85,831);
  saveCanvas(cover,'roboplanter-social-cover.png','已生成 1600 × 900 横版 PNG。');
});
