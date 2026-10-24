export async function setupFilm({THREE,camera,controls,renderer,setShutterOpen,requestFrame}){
 const style=document.createElement('style');style.textContent='body:has(dialog[open]) #film-start,body:has(dialog[open]) #film-status{display:none!important}';document.head.append(style);
 const W=1920,H=1080,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const g=canvas.getContext('2d');let start=0,rec=null,done=false,lastChapter=-1;
 const images={};
 for(const [id,path] of Object.entries({cat:'/promo/assets/tripo/references/04_cyber_lucky_cat_blue_v6.png',printer:'/promo/assets/tripo/references/interior-equipment/x1c-product-reference.jpg',apex:'/promo/assets/tripo/promo-video/apex-ui.png',projects:'/promo/assets/tripo/promo-video/projects-ui.png',wall:'/promo/assets/tripo/promo-video/wall-ui.png',home:'/promo/assets/tripo/promo-video/home-ui.png'})){
  const img=new Image();img.src=path;try{await img.decode();images[id]=img;}catch{}
 }
 const button=document.createElement('button');button.id='film-start';button.textContent='开始录制 82 秒宣传片';button.style.cssText='position:fixed;z-index:99999;top:16px;right:16px;padding:16px;background:#83eee6;color:#07121d;border:0;border-radius:8px;font:16px system-ui';document.body.append(button);
 const status=document.createElement('p');status.id='film-status';status.style.cssText='position:fixed;top:60px;right:16px;z-index:99999;color:white;background:#07121d;padding:8px';document.body.append(status);
 const shots=[
  [0,10,'一个网页，也可以是一座小宇宙。','PETER PAN’S TECHLAND / CYBER MAKER GARAGE'],
  [10,22,'从一张参考图，开始造物。','01 / 图片 + 文字描述 → Tripo AI → 3D 资产'],
  [22,34,'把工具摆进真实的创作空间。','02 / Blender 比例与摆放 → Three.js 光照与交互'],
  [34,45,'让每件作品，都有自己的入口。','03 / 会旋转、会悬浮的项目贩卖机'],
  [45,55,'收藏的不只是项目，是每一次动手。','04 / 机器人 · 边缘 AI · 灵巧手 · 黑客松'],
  [55,65,'绕到背面，留下一点你的痕迹。','05 / 照片墙 · 留言墙 · 许愿墙'],
  [65,74,'从个人作品，到一起共创。','06 / 拍立得照片 · 便利贴留言 · 审核后公开'],
  [74,82,'把想法造出来。下一件，一起？','EXPLORE / PETERPANSTECHLAND.GITHUB.IO']
 ];
 const lerp=(a,b,t)=>a+(b-a)*t;
 function pose(pos,target){camera.position.set(...pos);controls.target.set(...target);camera.fov=36;camera.updateProjectionMatrix();controls.update();}
 function imageFit(img,x,y,w,h){if(!img)return;const k=Math.min(w/img.width,h/img.height);g.drawImage(img,x+(w-img.width*k)/2,y+(h-img.height*k)/2,img.width*k,img.height*k);}
 function text(s,x,y,size,color='#f2f7fc',weight=600){g.fillStyle=color;g.font=`${weight} ${size}px "Microsoft YaHei",system-ui`;g.fillText(s,x,y);}
 button.onclick=()=>{
  button.disabled=true;controls.enableDamping=false;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  rec=new MediaRecorder(canvas.captureStream(30),{mimeType:mime,videoBitsPerSecond:12000000});const chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=async()=>{await fetch('/promo/upload',{method:'POST',body:new Blob(chunks,{type:mime})});status.textContent='录制完成，文件已保存';};
  start=performance.now();rec.start(1000);requestFrame();
 };
 window.filmBefore=()=>{
  if(!rec||done)return;const t=(performance.now()-start)/1000;
  const chapter=shots.findIndex(s=>t>=s[0]&&t<s[1]);if(chapter!==lastChapter){lastChapter=chapter;if(chapter===2)setShutterOpen(true);if(chapter===7)setShutterOpen(false);}
  if(t<10){const a=lerp(-.16,.43,t/10);pose([Math.sin(a)*12,5.3,Math.cos(a)*12],[.1,2.5,.4]);}
  else if(t<22){const u=(t-10)/12;pose([-4.1+u*.35,2.9,6.0-u*.5],[-1.8,1.55,1.85]);}
  else if(t<34){const u=(t-22)/12;pose([lerp(-1.8,-.6,u),1.7,lerp(3.9,2.1,u)],[.5,1.05,-.45]);camera.fov=65;camera.updateProjectionMatrix();}
  else if(t<55){const u=Math.min(1,(t-34)/11);pose([lerp(5.5,3.8,u),2.7,lerp(6.3,5.5,u)],[2.05,1.15,1.8]);}
  else if(t<74){const u=Math.min(1,(t-55)/10);pose([Math.sin(2.6+u*.55)*9,3.2,Math.cos(2.6+u*.55)*9],[0,1.7,-1.1]);}
  else{const u=(t-74)/8;pose([lerp(3.2,4.2,u),5.1,lerp(10.5,12,u)],[.15,2.5,.5]);}
 };
 window.filmAfter=()=>{
  if(!rec||done)return;const t=(performance.now()-start)/1000;
  g.fillStyle='#070b14';g.fillRect(0,0,W,H);g.drawImage(renderer.domElement,0,0,W,H);
  const s=shots.find(s=>t>=s[0]&&t<s[1])||shots.at(-1);
  if(t<4&&images.home)imageFit(images.home,0,0,W,H);
  if(t>=10&&t<22){g.fillStyle='#09121ff2';g.fillRect(70,180,680,610);imageFit(images.cat,90,200,640,390);text('参考图 + 细节描述',112,650,34);text('Tripo AI 生成模型，再接入网页场景',112,705,25,'#9ec3d1');text('蓝灰英短 / 铜金机械细节 / 青色眼睛',112,755,23,'#f3b7d4');}
  if(t>=22&&t<34){g.fillStyle='#09121ff0';g.fillRect(1370,170,480,610);imageFit(images.printer,1390,190,440,380);text('设备参考 → 场景资产',1400,640,29);text('比例、位置和工具台布局',1400,695,24,'#9ec3d1');}
  if((t>=45&&t<55)||(t>=65&&t<74)){
   const img=images[t<50?'projects':t<55?'apex':'wall'];if(img){g.fillStyle='#060b14';g.fillRect(0,0,W,H);const z=1+(t%10)*.0015;g.save();g.translate(W/2,H/2);g.scale(z,z);imageFit(img,-W/2,-H/2,W,H);g.restore();}
  }
  const gradient=g.createLinearGradient(0,0,0,210);gradient.addColorStop(0,'#050913ed');gradient.addColorStop(1,'#05091300');g.fillStyle=gradient;g.fillRect(0,0,W,210);
  text('PETER PAN’S',76,76,27,'#ff9fc9');text('TECHLAND',76,119,36,'#8deddf');text('MAKE / PLAY / BUILD',1440,76,22,'#a6becf');
  const bottom=g.createLinearGradient(0,820,0,H);bottom.addColorStop(0,'#05091300');bottom.addColorStop(1,'#050913fa');g.fillStyle=bottom;g.fillRect(0,820,W,260);
  text(s[3],80,922,24,'#83eae4');text(s[2],80,994,48);g.fillStyle='#ff4e9e';g.fillRect(80,1030,1760*Math.min(1,t/82),4);
  if(t>=74){text('peterpanstechland.github.io',960,720,42,'#93efe7');}
  status.textContent=`正在录制 ${Math.min(82,Math.floor(t))} / 82 秒`;
  if(t>=82){done=true;rec.stop();}
 };
}
