import {FAMILY} from './community-wall.js?v=community-v1';
// Actual mounted rails, clips and paper cards on the existing rear shell.
export function createCommunityInstallation(THREE,entries,rows,zh,onLoad) {
  const shell=entries.get('01_garage_shell');if(shell?.state!=='ready')return null;
  const group=new THREE.Group();group.name='LOCAL_COMMUNITY_REAR_INSTALLATION';
  group.position.set(0,shell.mount.position.y+1.52,-1.79);group.rotation.y=Math.PI;
  const metal=new THREE.MeshStandardMaterial({color:'#263337',metalness:.7,roughness:.38});
  const copper=new THREE.MeshStandardMaterial({color:'#a2744c',metalness:.7,roughness:.4});
  const glow=new THREE.MeshStandardMaterial({color:'#6ce8df',emissive:'#4ce6d5',emissiveIntensity:2.1});
  function box(name,size,pos,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  function canvasTexture(w,h,draw){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
  function plane(parent,name,w,h,texture,pos){const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,side:THREE.FrontSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.name=name;mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function text(name,value,x,y,w,h,color='#b9eee5',size=45){const texture=canvasTexture(640,Math.round(640*h/w),(ctx,cw,ch)=>{ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,cw/2,ch/2,cw-28);});return plane(group,name,w,h,texture,[x,y,.076]);}
  function image(parent,url,w,h,pos){const texture=new THREE.TextureLoader().load(url,loaded=>{const ratio=loaded.image.width/loaded.image.height,target=w/h;if(ratio>target){loaded.repeat.x=target/ratio;loaded.offset.x=(1-loaded.repeat.x)/2;}else{loaded.repeat.y=ratio/target;loaded.offset.y=(1-loaded.repeat.y)/2;}onLoad();},undefined,()=>onLoad());texture.colorSpace=THREE.SRGBColorSpace;return plane(parent,'COMMUNITY_PHOTOGRAPH',w,h,texture,pos);}
  for(const y of [-1.2,.10,1.28])box('WALL_MOUNTING_RAIL',[4.04,.035,.045],[0,y,0],metal);
  for(const x of [-2,2]){box('WALL_VERTICAL_SUPPORT',[.035,2.48,.04],[x,.04,0],metal);for(const y of [-1.2,1.28]){const pin=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.09,10),copper);pin.rotation.x=Math.PI/2;pin.position.set(x,y,-.01);group.add(pin);}}
  for(const x of [-1.85,1.85])box('CYAN_EDGE_MARKER',[.18,.012,.018],[x,1.28,.035],glow);
  text('COMMUNITY_TITLE',zh?'到此一游':'I WAS HERE',-1.26,.94,1.22,.22,'#e8e1ca',75);
  text('COMMUNITY_SUBTITLE','LEAVE A LITTLE TRACE',-1.26,.69,1.22,.12,'#91b8b5',34);
  text('COMMUNITY_INVITATION',zh?'一起，让这里长出故事。':'A wall we make together.',-1.26,.42,1.2,.14,'#e3c7a2',36);
  const paper=new THREE.MeshStandardMaterial({color:'#eee6d6',roughness:.9,emissive:'#e4dac1',emissiveIntensity:.2});
  const family=new THREE.Group();family.position.set(0,.74,.065);family.rotation.z=-.035;group.add(family);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.48,.83,.018),paper);family.add(frame);
  image(family,FAMILY,1.39,.623,[0,.045,.012]);
  const caption=canvasTexture(700,65,(ctx,w,h)=>{ctx.fillStyle='#304039';ctx.font='22px system-ui';ctx.textAlign='center';ctx.fillText('OUR LITTLE CREW  /  PETER & FAMILY',w/2,43);});plane(family,'FAMILY_CAPTION',1.36,.105,caption,[0,-.322,.014]);
  for(const x of [-.5,.5]){const clip=new THREE.Mesh(new THREE.BoxGeometry(.055,.10,.045),copper);clip.position.set(x,.41,.035);family.add(clip);}
  const camera=new THREE.Group();camera.position.set(1.3,.77,.07);group.add(camera);
  const disk=new THREE.Mesh(new THREE.CylinderGeometry(.205,.205,.042,48),metal);disk.rotation.x=Math.PI/2;camera.add(disk);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.211,.010,8,60),glow);ring.position.z=.027;camera.add(ring);
  const cameraIcon=canvasTexture(256,256,(ctx)=>{ctx.strokeStyle='#bdf9e9';ctx.lineWidth=9;ctx.lineJoin='round';ctx.strokeRect(48,85,160,109);ctx.beginPath();ctx.moveTo(75,85);ctx.lineTo(94,61);ctx.lineTo(155,61);ctx.lineTo(174,85);ctx.stroke();ctx.beginPath();ctx.arc(128,139,34,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f2c180';ctx.fillRect(178,101,12,12);});plane(camera,'COMMUNITY_CAMERA_BUTTON',.3,.3,cameraIcon,[0,0,.03]);
  text('CAMERA_CTA',zh?'拍照 · 留言 · 许愿':'PHOTO · NOTE · WISH',1.3,.43,1.22,.15,'#f2d1b0',36);
  const sectionLabels=zh?['照片墙','留言墙','许愿墙']:['PHOTOS','MESSAGES','WISHES'];
  const palette=['#eee9dd','#eddda5','#cce5db'];
  function wrap(ctx,value,x,y,maxWidth,lineHeight,maxLines){let line='',count=0;for(const char of [...value]){if(char==='\n'||ctx.measureText(line+char).width>maxWidth){ctx.fillText(line,x,y);line=char==='\n'?'':char;y+=lineHeight;if(++count>=maxLines)return;}else line+=char;}if(line&&count<maxLines)ctx.fillText(line,x,y);}
  ['photo','message','wish'].forEach((kind,col)=>{
    const x=(col-1)*1.28;const label=text(`WALL_SECTION_${kind}`,sectionLabels[col],x,-.055,1.08,.18,col===2?'#a9dfca':col===1?'#e7cc92':'#b3f5e9',69);label.userData.wallKind=kind;
    const items=rows.filter(e=>e.kind===kind).slice(0,2);
    for(let i=0;i<2;i++){
      const entry=items[i],card=new THREE.Group();card.position.set(x+(i?-.035:.025),-.43-i*.52,.075);card.rotation.z=(i?-.055:.045)*(col===1?-1:1);group.add(card);
      const cardWidth=kind==='photo'?.50:.91,cardHeight=kind==='photo'?.53:.43;
      const tex=canvasTexture(576,kind==='photo'?600:360,(ctx,w,h)=>{
        ctx.fillStyle=palette[col];ctx.fillRect(0,0,w,h);
        if(kind==='photo'){
          if(!entry){ctx.strokeStyle='#758a80';ctx.lineWidth=3;ctx.setLineDash([9,8]);ctx.strokeRect(25,24,w-50,h-135);ctx.fillStyle='#435d52';ctx.font='95px system-ui';ctx.textAlign='center';ctx.fillText('◎',w/2,h*.45);ctx.font='29px system-ui';ctx.fillText(zh?(i?'把此刻带来':'下一张，留给你'):'YOUR MOMENT GOES HERE',w/2,h-45,w-40);}
          else{ctx.fillStyle='#344d44';ctx.font='29px system-ui';ctx.textAlign='center';ctx.fillText(entry.name||(zh?'路过的创客':'A passing maker'),w/2,h-45,w-30);}
        } else {
          ctx.fillStyle='#203e34';ctx.font='42px system-ui';ctx.textAlign='left';wrap(ctx,entry?.text||(kind==='wish'?(zh?(i?'一个小小的愿望，\n也值得被认真对待。':'如果可以，\n你想一起实现什么？'):'What could we make\npossible together?'):(zh?(i?'一个灵感、一件小事，\n都可以留在这里。':'你好，路过的朋友。\n在这里留下一句话吧。'):'Hello, passing friend.\nLeave a little note.')),36,85,w-72,54,4);
          ctx.fillStyle='#738272';ctx.font='21px system-ui';ctx.fillText(entry?(entry.name||(zh?'匿名':'Anonymous')):(zh?'等待你的第一笔':'WAITING FOR YOUR STORY'),36,h-30,w-72);
        }
      });
      const surface=plane(card,`COMMUNITY_CARD_${kind}_${i}`,cardWidth,cardHeight,tex,[0,0,0]);surface.userData.wallKind=kind;
      if(entry?.displayURL&&kind==='photo'){const photo=image(card,entry.displayURL,cardWidth-.048,.38,[0,.05,.004]);photo.userData.wallKind=kind;}
      const clip=new THREE.Mesh(new THREE.BoxGeometry(.038,.06,.028),copper);clip.position.set(0,cardHeight/2,.018);card.add(clip);
      const line=new THREE.Mesh(new THREE.CylinderGeometry(.002,.002,1.16,6),copper);line.rotation.z=Math.PI/2;line.position.set(x,-.43-i*.52+cardHeight/2,.05);group.add(line);
    }
  });
  group.traverse(node=>{node.userData={...node.userData,assetId:'community-wall',communityWall:true,locallyAuthored:true};});
  group.userData.entryCount=rows.length;
  return group;
}
