import {createSponsorService,createSponsorApplication} from './sponsor-applications.js?v=sponsor-labels-v1';
const definitions = [
  {id:'core', en:'CORE SPONSOR', zh:'核心赞助商', color:'#b5f5e4', description:['Support long-term making, open projects and the next ambitious idea.','支持长期创作、开源项目，以及下一个大胆的想法。']},
  {id:'hardware', en:'HARDWARE SPONSOR', zh:'硬件赞助商', color:'#f3c891', description:['Put tools, components and devices into real builds.','让工具、元器件和设备走进真实的制作过程。']},
  {id:'community', en:'COMMUNITY SPONSOR', zh:'社区赞助商', color:'#d3b8f3', description:['Connect makers through shared knowledge, events and collaboration.','用知识分享、活动与协作，连接更多创作者。']},
];
const configURL = new URL('./sponsors/config.json',import.meta.url);
function website(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}}
function logoURL(value){try{const url=new URL(value,configURL);return ['https:','http:'].includes(url.protocol)&& (url.protocol==='https:'||url.origin===location.origin||(['127.0.0.1','localhost'].includes(location.hostname)&&['127.0.0.1','localhost'].includes(url.hostname)))?url.href:null;}catch{return null;}}

export async function createSponsorBillboard(THREE,zh,onLoad){
  let service=null,application=null,feed=[],serverOffset=0,feedReady=false;
  const tiers=definitions.map(t=>({...t}));
  let page=0,previousPage=0,pageElapsed=0,transition=1,paused=false,lastSeconds=null;
  const tiles=[],imageCache=new Map();
  const dialog=document.createElement('dialog');dialog.id='sponsor-dialog';dialog.setAttribute('aria-labelledby','sponsor-title');
  dialog.innerHTML='<button class="sp-close" type="button">×</button><header><span class="sp-kicker">TECHLAND / SPONSOR NETWORK</span><h2 id="sponsor-title"></h2><p class="sp-intro"></p></header><div class="sp-playback"><span class="sp-page-status" aria-live="polite"></span><button type="button" class="sp-prev">← 上一页</button><button type="button" class="sp-next">下一页 →</button><button type="button" class="sp-pause">暂停轮播</button></div><div class="sp-tiers"></div><footer>INDEPENDENT MAKERS. SHARED POSSIBILITIES.</footer>';
  const sections=new Map();
  dialog.querySelector('.sp-close').setAttribute('aria-label',zh?'关闭赞助商':'Close sponsors');dialog.querySelector('.sp-close').onclick=()=>dialog.close();
  dialog.querySelector('h2').textContent=zh?'一起，让想法发生。':'Build what comes next.';
  dialog.querySelector('.sp-intro').textContent=zh?'三页循环播放 · 每页 8 秒 · 审核通过并进入档期后展示。':'Three pages · 8 seconds each · Approved, scheduled sponsors.';
  function populate(){
    sections.clear();dialog.querySelector('.sp-tiers').replaceChildren();
    for(const [i,tier] of tiers.entries()){
      const section=document.createElement('section');section.style.setProperty('--tier',tier.color);section.dataset.tier=tier.id;
      const code=document.createElement('span');code.className='sp-code';code.textContent=`0${i+1} / ${tier.en}`;
      const heading=document.createElement('h3');heading.textContent=zh?tier.zh:tier.en;
      const description=document.createElement('p');description.textContent=tier.description[zh?1:0];section.append(code,heading,description);
      const active=feed.filter(s=>s.tier===tier.id&&s.page===page+1&&s.endAt>Date.now()+serverOffset);
      if(!active.length){const empty=document.createElement('div');empty.className='sp-recruit';empty.textContent=feedReady?(zh?'招募中':'OPEN FOR SPONSORS'):(zh?'暂未连接':'UNAVAILABLE');section.append(empty);}
      for(const s of active){const card=document.createElement('a');card.className='sp-brand';card.href=s.url;card.target='_blank';card.rel='noopener noreferrer';const img=document.createElement('img');img.src=s.logo;img.alt=s.name;const name=document.createElement('span');name.textContent=s.name+' ↗';card.append(img,name);section.append(card);}
      const pricing=document.createElement('small');pricing.className='sp-price';pricing.textContent=tier.id==='core'?(service?`¥${service.plans.prices[page+1].month/100} / 月 · ¥${service.plans.prices[page+1].year/100} / 年`:''):(tier.id==='hardware'?'项目制 · 硬件与技术支持':'活动制 · 展位 / swag');section.append(pricing);
      const apply=document.createElement('button');apply.className='sp-apply';apply.textContent=zh?'申请合作 / 查看进度 ↗':'Apply / My applications ↗';apply.disabled=!application;apply.onclick=()=>application.open(tier.id,page+1);section.append(apply);
      sections.set(tier.id,section);dialog.querySelector('.sp-tiers').append(section);
    }
    dialog.querySelector('.sp-page-status').textContent=`${String(page+1).padStart(2,'0')} / 03`;
  }
  function choose(next){previousPage=page;page=(next+3)%3;transition=0;pageElapsed=0;populate();onLoad();}
  dialog.querySelector('.sp-prev').onclick=()=>choose(page-1);dialog.querySelector('.sp-next').onclick=()=>choose(page+1);
  dialog.querySelector('.sp-pause').onclick=()=>{paused=!paused;dialog.querySelector('.sp-pause').textContent=paused?'继续轮播':'暂停轮播';onLoad();};
  document.body.append(dialog);populate();
  function open(tier){populate();for(const [id,section] of sections)section.classList.toggle('sp-selected',id===tier);if(!dialog.open)dialog.showModal();if(tier)sections.get(tier)?.scrollIntoView({block:'nearest'});}
  async function refreshFeed(){if(!service)return;try{const result=await service.request('sponsors');serverOffset=result.serverTime-Date.now();feed=(result.sponsors||[]).filter(s=>website(s.url)&&logoURL(s.logo));feedReady=true;repaintPages();if(dialog.open)populate();onLoad();}catch{if(!feedReady)populate();}}
  const refreshTimer=setInterval(()=>{if(!document.hidden)refreshFeed();},30000);
  window.addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true});
  const group=new THREE.Group();group.name='TECHLAND_SPONSOR_BILLBOARD';
  const metal=new THREE.MeshStandardMaterial({color:'#18212c',metalness:.78,roughness:.38});
  const dark=new THREE.MeshStandardMaterial({color:'#080e18',metalness:.45,roughness:.5});
  const trim=new THREE.MeshStandardMaterial({color:'#455565',metalness:.8,roughness:.33});
  function box(name,size,pos,material=metal){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...pos);group.add(mesh);return mesh;}
  function beam(a,b,r=.025){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),trim);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(mesh);}
  // Two grounded columns sit behind the garage; a cantilever carries the screen.
  for(const x of [-2.65,3.15]){
    box('BILLBOARD_FOOT',[.4,.08,.42],[x,0,-.65]);
    box('BILLBOARD_COLUMN',[.12,4.85,.14],[x,2.425,-.65]);
    for(const y of [.25,.42])box('COLUMN_COLLAR',[.19,.04,.21],[x,y,-.65],trim);
    beam([x,3.35,-.65],[x,4.15,.02],.045);
  }
  const cx=.25,cy=4.72,z=.05,width=5.82,height=1.68;
  box('BILLBOARD_CABINET',[width,height,.18],[cx,cy,z],dark);
  for(const y of [cy-height/2,cy+height/2])box('HORIZONTAL_RIM',[width+.08,.045,.23],[cx,y,z],trim);
  for(const x of [cx-width/2,cx+width/2])box('VERTICAL_RIM',[.045,height,.23],[x,cy,z],trim);
  // A closed, rounded glass tube: UV.x follows the perimeter continuously.
  const tubePath=new THREE.CurvePath(),hw=width/2+.045,hh=height/2+.045,r=.13,tubeZ=z+.17;
  const point=(x,y)=>new THREE.Vector3(cx+x,cy+y,tubeZ);
  const line=(a,b)=>tubePath.add(new THREE.LineCurve3(point(...a),point(...b)));
  line([-hw+r,hh],[hw-r,hh]);
  function clockwiseCorner(x,y,start){const pts=[];for(let i=0;i<=12;i++){const angle=start-i*Math.PI/24;pts.push(point(x+r*Math.cos(angle),y+r*Math.sin(angle)));}for(let i=1;i<pts.length;i++)tubePath.add(new THREE.LineCurve3(pts[i-1],pts[i]));}
  clockwiseCorner(hw-r,hh-r,Math.PI/2);line([hw,hh-r],[hw,-hh+r]);
  clockwiseCorner(hw-r,-hh+r,0);line([hw-r,-hh],[-hw+r,-hh]);
  clockwiseCorner(-hw+r,-hh+r,-Math.PI/2);line([-hw,-hh+r],[-hw,hh-r]);
  clockwiseCorner(-hw+r,hh-r,Math.PI);
  const marqueeUniforms={time:{value:0},cyan:{value:new THREE.Color('#25eadf')},pink:{value:new THREE.Color('#ff378e')}};
  const vertexShader='varying vec2 vTubeUv; void main(){vTubeUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fragmentShader=`uniform float time; uniform vec3 cyan; uniform vec3 pink; varying vec2 vTubeUv;
    void main(){
      float phase=fract(vTubeUv.x*3.0-time*.24);
      float trail=smoothstep(.49,.91,phase)*(1.0-smoothstep(.96,1.0,phase));
      float head=exp(-pow((phase-.93)*36.0,2.0));
      float glass=.7+.3*pow(abs(sin(vTubeUv.y*6.283185)),4.0);
      vec3 light=mix(cyan,pink,trail)*(1.35+trail*1.2)+vec3(.7,1.,.96)*head*2.0;
      gl_FragColor=vec4(light*glass,1.0);
      #include <colorspace_fragment>
    }`;
  const tubeMaterial=new THREE.ShaderMaterial({uniforms:marqueeUniforms,vertexShader,fragmentShader,toneMapped:false});
  const tube=new THREE.Mesh(new THREE.TubeGeometry(tubePath,384,.041,10,true),tubeMaterial);tube.name='SPONSOR_NEON_MARQUEE_TUBE';group.add(tube);
  // Soft additive glass envelope remains visible on mobile without bloom.
  const haloMaterial=new THREE.MeshBasicMaterial({color:'#26cfc9',transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const halo=new THREE.Mesh(new THREE.TubeGeometry(tubePath,384,.069,8,true),haloMaterial);halo.name='SPONSOR_NEON_MARQUEE_HALO';group.add(halo);
  const marqueeBounds=new THREE.Box3(point(-hw-.1,-hh-.1),point(hw+.1,hh+.1));
  const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
  function animate(seconds,reduced,camera){
    marqueeUniforms.time.value=reduced?0:seconds;
    camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
    const visible=frustum.intersectsBox(marqueeBounds),delta=lastSeconds===null?0:Math.min(.1,seconds-lastSeconds);lastSeconds=seconds;
    if(feed.some(s=>s.endAt<=Date.now()+serverOffset)){feed=feed.filter(s=>s.endAt>Date.now()+serverOffset);repaintPages();if(dialog.open)populate();}
    if(visible&&!reduced&&!paused&&!dialog.open&&!document.querySelector('#sponsor-application[open]')){pageElapsed+=delta;if(pageElapsed>=8)choose(page+1);}
    if(transition<1){transition=reduced?1:Math.min(1,transition+delta/.65);drawPanels();}
    return visible&&(!reduced||transition<1);
  }
  for(const y of [4.0,4.65,5.4]){beam([-2.6,y,-.1],[3.1,y,-.1]);}
  for(let i=0;i<5;i++)beam([-2.6+i*1.14,4,-.1],[-1.46+i*1.14,5.4,-.1]);
  function face(name,w,h,x,y,draw,data={}){
    const canvas=document.createElement('canvas');canvas.width=Math.round(w*320);canvas.height=Math.round(h*320);const ctx=canvas.getContext('2d');draw(ctx,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.position.set(x,y,z+.101);mesh.name=name;mesh.userData={assetId:'sponsor-board',sponsorBoard:true,...data};group.add(mesh);return {mesh,ctx,canvas,texture};
  }
  const masthead=face('BILLBOARD_MASTHEAD',5.55,.25,cx,5.365,()=>{});
  const slots=[{x:-.85,y:4.59,w:3.32,h:1.21},{x:1.96,y:4.91,w:2.12,h:.57},{x:1.96,y:4.27,w:2.12,h:.57}];
  tiers.forEach((tier,i)=>{const slot=slots[i],tile=face(`SPONSOR_SLOT_${tier.id}`,slot.w,slot.h,slot.x,slot.y,()=>{},{tier:tier.id});tile.pages=[];tile.tier=tier;tile.hero=i===0;tiles.push(tile);});
  function repaintPages(){
    for(const tile of tiles){tile.pages=[];for(let p=1;p<=3;p++){
      const canvas=document.createElement('canvas');canvas.width=tile.canvas.width;canvas.height=tile.canvas.height;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,hero=tile.hero,tier=tile.tier;
      ctx.fillStyle=hero?'#122c32':'#151e30';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#30524e';ctx.lineWidth=2;ctx.strokeRect(1,1,w-2,h-2);ctx.fillStyle=tier.color;ctx.fillRect(0,0,5,h);ctx.font=`500 ${hero?25:21}px monospace`;ctx.fillText(tier.en,hero?34:23,hero?46:34);ctx.fillStyle='#dfe9e6';ctx.font=`600 ${hero?34:25}px system-ui`;ctx.fillText(zh?tier.zh:tier.en,hero?34:23,hero?104:74);
      const brand=feed.find(s=>s.tier===tier.id&&s.page===p&&s.endAt>Date.now()+serverOffset);
      if(brand){const image=imageCache.get(brand.logo);const ix=hero?34:23,iy=hero?130:88,iw=hero?w-220:w-120,ih=hero?150:68;ctx.fillStyle='#f0f2ef';ctx.fillRect(ix,iy,iw,ih);
        if(image?.complete&&image.naturalWidth){const scale=Math.min((iw-20)/image.width,(ih-12)/image.height);ctx.drawImage(image,ix+(iw-image.width*scale)/2,iy+(ih-image.height*scale)/2,image.width*scale,image.height*scale);}
        else {ctx.fillStyle='#132b32';ctx.font=`600 ${hero?48:30}px system-ui`;ctx.fillText(brand.name,ix+15,iy+ih*.65,iw-30);if(!image){const img=new Image();img.crossOrigin='anonymous';imageCache.set(brand.logo,img);img.onload=()=>{repaintPages();onLoad();};img.src=brand.logo;}}
        ctx.fillStyle=tier.color;ctx.font=hero?'65px system-ui':'42px system-ui';ctx.fillText('↗',w-90,hero?230:140);if(hero){ctx.font='25px system-ui';ctx.fillText(brand.tagline||brand.name,34,h-38,w-65);}
      }else{ctx.fillStyle=tier.color;ctx.font=`600 ${hero?126:48}px system-ui`;ctx.fillText(feedReady?(zh?'招募中':'OPEN CALL'):(zh?'加载中':'LOADING'),hero?32:22,hero?252:145);ctx.textAlign='right';ctx.font=`300 ${hero?80:48}px system-ui`;ctx.fillText('↗',w-28,hero?252:145);if(hero){ctx.textAlign='left';ctx.font='23px system-ui';ctx.fillStyle='#90acae';ctx.fillText(service?`PAGE ${p}  /  ¥${service.plans.prices[p].month/100} 月 · ¥${service.plans.prices[p].year/100} 年`:'SPONSOR NETWORK',34,h-40);}}
      tile.pages.push(canvas);
    }}drawPanels();
  }
  function drawPanels(){
    const progress=transition*transition*(3-2*transition);
    for(const tile of tiles){if(!tile.pages.length)continue;const w=tile.canvas.width,h=tile.canvas.height;tile.ctx.clearRect(0,0,w,h);
      if(transition<1){tile.ctx.drawImage(tile.pages[previousPage],-progress*w,0);tile.ctx.drawImage(tile.pages[page],(1-progress)*w,0);}else tile.ctx.drawImage(tile.pages[page],0,0);
      tile.texture.needsUpdate=true;const brand=feed.find(s=>s.tier===tile.tier.id&&s.page===page+1&&s.endAt>Date.now()+serverOffset);tile.mesh.userData.sponsorURL=transition===1?brand?.url:null;
    }
    const {ctx,canvas,texture}=masthead;ctx.fillStyle='#0a141d';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#a6c1c5';ctx.font='600 24px monospace';ctx.fillText('TECHLAND  /  BUILT TOGETHER',18,49);ctx.textAlign='right';ctx.font='22px monospace';ctx.fillText(`SPONSOR NETWORK   ${page+1} / 3`,canvas.width-18,49);ctx.textAlign='left';texture.needsUpdate=true;
  }
  repaintPages();
  createSponsorService().then(value=>{service=value;application=createSponsorApplication(service,zh);populate();refreshFeed();onLoad();}).catch(()=>populate());
  // Cabinet and supports occlude clicks but never link to a brand.
  group.traverse(node=>{if(node.isMesh&&!node.userData.sponsorBoard)node.userData={assetId:'sponsor-board',sponsorBoard:true};});
  return {group,open,animate,activate(data){if(data.sponsorURL)window.open(data.sponsorURL,'_blank','noopener,noreferrer');else open(data.tier);}};
}
