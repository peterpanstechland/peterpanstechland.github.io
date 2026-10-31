import * as THREE from './vendor/three.module.min.js';

// This page never discovers, connects to, or sends commands to a device.
// All plant state below belongs only to this browser's visual demonstration.
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const moods = {
  chill: { line: '老板的饼我不吃。<br>我光合作用。', quote: ['老板的饼我不吃。', '我光合作用。'], label: '佛系发芽', color: 0x79ac43 },
  busy: { line: '别看我没动。<br>我在后台光合。', quote: ['别看我没动。', '我在后台光合。'], label: '假装很忙', color: 0xddd379 },
  tired: { line: '不是枯了。<br>是在省电。', quote: ['不是枯了。', '是在省电。'], label: '电量见底', color: 0xa9c4a4 },
  happy: { line: '今天的叶子，<br>准点下班。', quote: ['今天的叶子，', '准点下班。'], label: '准点下班', color: 0xa7d785 },
};
let mood = 'chill';
let renderer, scene, camera, plant, leafMaterial, particles, halo;
const lightModes = ['关', '柔绿', '呼吸', '流动', '彩虹'];
let lightMode = 0;
const lightBeads = [];
let elapsed = 0, frozen = false, waterAt = -100, yaw = -.35, targetYaw = -.35, drag = null;
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
function block(material, x, y, z, w, h = w, d = w, parent = plant) {
  const object = mesh(new THREE.BoxGeometry(w, h, d), material, parent);
  object.position.set(x, y, z); return object;
}
// Original procedural tiles: no Minecraft game textures are redistributed.
function tileTexture(palette, soil = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = palette[(x * 13 + y * 7 + x * y * 3) % palette.length];
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  if (soil) {ctx.fillStyle = '#709841'; ctx.fillRect(0,0,64,10); for(let i=0;i<8;i+=2)ctx.fillRect(i*8,10,8,6);}
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; return texture;
}
function initScene() {
  const host = $('scene');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
  camera.position.set(0, 3.15, 8.4); camera.lookAt(worldTarget);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6c9a1, 2));
  const key = new THREE.DirectionalLight(0xfff7dd, 3);
  key.position.set(-3, 7, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025;
  key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xd3ffaf, 1.4); rim.position.set(4, 4, -3); scene.add(rim);
  const floor = mesh(new THREE.CircleGeometry(4, 80), new THREE.ShadowMaterial({ color: 0x53633c, opacity: .19 }), scene);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.055; floor.castShadow = false;
  const greens = ['#719d46','#86b354','#8fbc59','#7aa64c','#98c261','#67933f'];
  const potMat = new THREE.MeshStandardMaterial({map:tileTexture(greens),roughness:.9});
  const soilMat = new THREE.MeshStandardMaterial({map:tileTexture(['#51422b','#604d30','#6a5333','#795f39']),roughness:1});
  const grassMat = new THREE.MeshStandardMaterial({map:tileTexture(['#7d9e48','#87aa51','#779442','#97b45d']),roughness:1});
  const dirtMat = new THREE.MeshStandardMaterial({map:tileTexture(['#856044','#936c49','#7c593e','#a17b54'],true),roughness:1});
  const plinth = mesh(new THREE.BoxGeometry(2.65,.38,2.3),[dirtMat,dirtMat,grassMat,dirtMat,dirtMat,dirtMat],scene);
  plinth.position.y=-.18;
  // A ten-pixel light preview follows the square base, without a device connection.
  const lightPositions=[[-.9,1.03],[-.45,1.03],[0,1.03],[.45,1.03],[.9,1.03],[1.16,.6],[1.16,0],[1.16,-.6],[-1.16,.6],[-1.16,-.6]];
  for(const [x,z] of lightPositions){
    const bead=block(new THREE.MeshBasicMaterial({color:0xaab79b}),x,.03,z,.13,.045,.13,scene);
    bead.castShadow=false;lightBeads.push(bead);
  }
  plant = new THREE.Group(); scene.add(plant);
  const dark = new THREE.MeshStandardMaterial({color:0x203828,roughness:1});
  const rimMat = new THREE.MeshStandardMaterial({color:0x9ac46a,roughness:.9});
  leafMaterial=new THREE.MeshStandardMaterial({color:moods.chill.color,roughness:.9});
  const stemMat=new THREE.MeshStandardMaterial({color:0x4f7b32,roughness:.9});
  // Four walls leave a real opening for soil instead of a closed cube lid.
  block(potMat,0,.88,.77,1.7,1.6,.16);block(potMat,0,.88,-.77,1.7,1.6,.16);
  block(potMat,-.77,.88,0,.16,1.6,1.4);block(potMat,.77,.88,0,.16,1.6,1.4);
  block(soilMat,0,1.58,0,1.4,.09,1.4);
  block(rimMat,0,1.7,.77,1.76,.12,.2);block(rimMat,0,1.7,-.77,1.76,.12,.2);
  block(rimMat,-.78,1.7,0,.2,.12,1.36);block(rimMat,.78,1.7,0,.2,.12,1.36);
  // Creeper-style pixel face, made from simple geometry.
  for(const x of [-.42,.42])block(dark,x,1.12,.86,.4,.4,.024);
  block(dark,0,.82,.86,.4,.23,.024);block(dark,0,.6,.86,.8,.23,.024);
  block(dark,-.3,.39,.86,.2,.22,.024);block(dark,.3,.39,.86,.2,.22,.024);
  block(stemMat,-.12,2.05,0,.09,.91,.09);
  block(stemMat,.04,2.47,0,.09,.6,.09);
  block(stemMat,-.31,2.17,0,.4,.09,.09);
  block(stemMat,.31,2.46,0,.5,.09,.09);
  // Stepped leaves keep a clear voxel silhouette from every angle.
  const leaves=[[-.62,2.27,0,.58,.12,.36],[-.8,2.39,0,.4,.12,.36],[-.91,2.51,0,.18,.12,.25],[.53,2.59,-.02,.63,.12,.38],[.76,2.71,-.02,.4,.12,.38],[.9,2.83,-.02,.18,.12,.25],[.04,2.85,0,.3,.42,.24]];
  leaves.forEach(args=>block(leafMaterial,...args));
  block(new THREE.MeshStandardMaterial({color:0x4c712e,roughness:.9}),-.35,.07,.25,.32,.1,.46);
  block(new THREE.MeshStandardMaterial({color:0x4c712e,roughness:.9}),.35,.07,.25,.32,.1,.46);
  const n=150, positions=new Float32Array(n*3), seeds=new Float32Array(n), hues=new Float32Array(n);
  for(let i=0;i<n;i++){positions[i*3]=(i*1.618%1)*2-1;positions[i*3+1]=(i*.754%1)*2-1;positions[i*3+2]=(i*.569%1)*2-1;seeds[i]=i/n;hues[i]=i%5===0?1:0;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aGold',new THREE.BufferAttribute(hues,1));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    uniforms:{uTime:{value:0},uWater:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio,1.75)}},
    vertexShader:`attribute float aSeed; attribute float aGold; uniform float uTime; uniform float uWater; uniform float uPixelRatio; varying float vAlpha; varying float vGold;
    void main(){float angle=aSeed*83.3+uTime*.22;float radius=1.12+fract(aSeed*17.3)*1.25;vec3 p=vec3(sin(angle)*radius,.25+fract(aSeed*31.7+uTime*.023)*3.4,cos(angle)*radius*.6);
      float w=fract(aSeed*12.1+uTime*.5);vec3 drop=vec3(sin(aSeed*49.)*(.2+w*.9),3.4-w*2.5,cos(aSeed*71.)*(.2+w*.6));p=mix(p,drop,uWater);vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;gl_PointSize=(8.+aSeed*9.)*uPixelRatio*(5./-mv.z);vAlpha=mix(.12,.7,uWater);vGold=aGold;}`,
    fragmentShader:`varying float vAlpha;varying float vGold;void main(){vec2 uv=abs(gl_PointCoord-.5);if(max(uv.x,uv.y)>.36)discard;float alpha=vAlpha;vec3 color=mix(vec3(.57,.70,.38),vec3(.84,.60,.26),vGold);gl_FragColor=vec4(color,alpha);}`
  });
  particles=new THREE.Points(geometry,particleMaterial);scene.add(particles);
  halo=mesh(new THREE.RingGeometry(1.45,1.48,4),new THREE.MeshBasicMaterial({color:0xa0b96d,transparent:true,opacity:.4}),scene);
  halo.rotation.x=-Math.PI/2;halo.rotation.z=Math.PI/4;halo.position.y=.025;
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
    if(lightMode===3){const phase=(elapsed*.3)%1;const distance=Math.min(Math.abs(i/lightBeads.length-phase),1-Math.abs(i/lightBeads.length-phase));level=.12+.8*Math.exp(-distance*distance/0.015);}
    if(lightMode===4)bead.material.color.setHSL((i/lightBeads.length+elapsed*.08)%1,.65,.45);
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
  report('WS2813 灯效预览 · 不连接真实灯带');
  render();
});
$('water').addEventListener('click',()=>{
  if(waterCooldown)return;
  if(frozen){frozen=false;$('freeze').setAttribute('aria-pressed','false');$('freeze').innerHTML='<span aria-hidden="true">◎</span>像素子弹时间';}
  waterAt=elapsed;waterCooldown=true;$('water').disabled=true;
  $('plant-line').innerHTML='收到。<br>你也记得喝一口。';
  report('仅网页动画 · 没有发送水泵命令');
  setTimeout(()=>{waterCooldown=false;$('water').disabled=false;$('plant-line').innerHTML=moods[mood].line;report(glAvailable?'拖动可旋转 · 网页模拟':'静态模式 · 教程与海报可用');},4000);
});
$('freeze').addEventListener('click',()=>{
  if(!glAvailable){report('当前为静态模式 · 无动画可定格');return;}
  frozen=!frozen;$('freeze').setAttribute('aria-pressed',String(frozen));
  $('freeze').innerHTML=frozen?'<span aria-hidden="true">▶</span>让时间继续':'<span aria-hidden="true">◎</span>像素子弹时间';
  if(frozen){if(particles.material.uniforms.uWater.value<.1)particles.material.uniforms.uWater.value=.7;report('像素定格 · 视角继续环绕');}
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
function rounded(ctx,x,y,w,h){ctx.fillRect(x,y,w,h);}
function drawPixelCompanion(ctx,x,y,scale){
  const greens=['#83ad4f','#759d42','#95ba5b','#6a933c'];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){ctx.fillStyle=greens[(row*7+col*3)%4];ctx.fillRect(x+col*scale,y+row*scale,scale,scale);}
  ctx.fillStyle='#233b28';[[1,2,2,2],[5,2,2,2],[3,4,2,1],[2,5,4,1],[2,6,1,1],[5,6,1,1]].forEach(([a,b,w,h])=>ctx.fillRect(x+a*scale,y+b*scale,w*scale,h*scale));
  ctx.fillStyle='#4c7b33';ctx.fillRect(x+3.5*scale,y-3*scale,scale,3*scale);ctx.fillRect(x+2*scale,y-3*scale,2*scale,scale);ctx.fillRect(x+4*scale,y-4*scale,2*scale,scale);
}
function drawPosterGround(ctx,x,y,w){ctx.fillStyle='#547a38';ctx.fillRect(x,y,w,18);ctx.fillStyle='#8fa94f';ctx.fillRect(x,y,w,6);ctx.fillStyle='#87603d';ctx.fillRect(x,y+18,w,28);}
function makePoster(){
  $('poster-canvas').hidden=false;$('cover-canvas').hidden=true;
  const canvas=$('poster-canvas'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#f3f1df';ctx.fillRect(0,0,1200,1600);
  ctx.fillStyle='#233b28';ctx.font='700 29px system-ui, sans-serif';ctx.fillText('工位搭子 / 方块生存模式',80,105);
  ctx.font='500 17px system-ui, sans-serif';ctx.fillText('ROBOPLANTER / '+moods[mood].label+' / 灯效预览：'+lightModes[lightMode],80,143);
  ctx.fillStyle='#53634f';ctx.textAlign='right';ctx.fillText('GROW AT YOUR OWN PACE.',1120,105);ctx.textAlign='left';
  ctx.font='750 74px system-ui, sans-serif';ctx.fillStyle='#233b28';moods[mood].quote.forEach((line,i)=>ctx.fillText(line,80,280+i*100));
  ctx.fillStyle='#dce8c6';rounded(ctx,65,440,1070,855,34);
  if(renderer&&glAvailable){render();const s=renderer.domElement;const height=800,width=height*size.width/size.height;ctx.drawImage(s,(1200-width)/2,470,width,height);}
  else{drawPixelCompanion(ctx,400,820,50);drawPosterGround(ctx,160,1250,880);}
  ctx.fillStyle='#233b28';ctx.font='700 42px system-ui, sans-serif';ctx.fillText('你先下班，我负责发芽。',80,1390);
  ctx.font='24px system-ui, sans-serif';ctx.fillStyle='#53634f';ctx.fillText('一格工位，一点生机。',80,1440);
  ctx.font='18px system-ui, sans-serif';ctx.fillText('HONOR Robot Phone + Seeed Studio / 网页角色演示',80,1510);
  ctx.fillText('peterpanstechland.github.io/roboplanter',80,1544);
}
$('poster').addEventListener('click',()=>{makePoster();$('download-status').textContent='';dialog.showModal();});
$('close-poster').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
function saveCanvas(canvas,filename,message){canvas.toBlob(blob=>{if(!blob){$('download-status').textContent='这次生成失败了，请再试一次。';return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('download-status').textContent=message;},'image/png');}
$('download-poster').addEventListener('click',()=>{makePoster();saveCanvas($('poster-canvas'),'roboplanter-desk-friend-'+mood+'.png','已生成 1200 × 1600 PNG。若浏览器未保存，可使用预览图的保存菜单。');});
$('download-cover').addEventListener('click',()=>{
  const cover=$('cover-canvas');cover.hidden=false;$('poster-canvas').hidden=true;const ctx=cover.getContext('2d');
  ctx.fillStyle='#f3f1df';ctx.fillRect(0,0,1600,900);ctx.fillStyle='#233b28';ctx.font='700 35px system-ui, sans-serif';ctx.fillText('工位搭子 / ROBOPLANTER',85,110);
  ctx.fillStyle='#dce8c6';rounded(ctx,790,50,755,795,35);
  if(renderer&&glAvailable){render();const s=renderer.domElement;const height=740,width=height*size.width/size.height;ctx.drawImage(s,1170-width/2,70,width,height);}
  else{drawPixelCompanion(ctx,1020,415,42);drawPosterGround(ctx,850,785,635);}
  ctx.fillStyle='#233b28';ctx.font='750 89px system-ui, sans-serif';ctx.fillText('这只苦力怕，',85,330);ctx.fillText('只会发芽。',85,455);
  ctx.fillStyle='#53634f';ctx.font='29px system-ui, sans-serif';ctx.fillText('你先下班，我负责发芽。',85,560);
  ctx.fillStyle='#c4eb72';rounded(ctx,85,620,340,74,9);ctx.fillStyle='#233b28';ctx.font='600 25px system-ui, sans-serif';ctx.fillText('硬件你来选 · 对话交给 YOYO',104,667);
  ctx.fillStyle='#53634f';ctx.font='21px system-ui, sans-serif';ctx.fillText('HONOR Robot Phone + Seeed Studio / 网页角色演示',85,795);ctx.fillText('peterpanstechland.github.io/roboplanter',85,831);
  saveCanvas(cover,'roboplanter-social-cover.png','已生成 1600 × 900 横版 PNG。');
});
