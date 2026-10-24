// Locally authored illustrative geometry, based on the published 51 x 21 x 11 mm
// proportions. This is a display concept, not manufacturer CAD or a test result.
export function createNotePinModel(THREE){
 const group=new THREE.Group();group.name='PLAUD_NOTEPIN_S_ILLUSTRATIVE_MODEL';
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.30,10,28),new THREE.MeshPhysicalMaterial({color:'#a9a5ad',metalness:.72,roughness:.3,clearcoat:.5}));body.scale.z=.524;group.add(body);
 const button=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.009,28),new THREE.MeshStandardMaterial({color:'#d7d5d9',metalness:.76,roughness:.28}));button.rotation.x=Math.PI/2;button.position.set(0,.045,.058);group.add(button);
 const led=new THREE.Mesh(new THREE.SphereGeometry(.005,8,8),new THREE.MeshBasicMaterial({color:'#ff4455'}));led.position.set(0,.12,.056);group.add(led);
 const seam=new THREE.Mesh(new THREE.CapsuleGeometry(.106,.30,8,24),new THREE.MeshStandardMaterial({color:'#35313b',metalness:.5,roughness:.45}));seam.scale.set(1,.99,.065);seam.position.z=-.026;group.add(seam);
 const label=document.createElement('canvas');label.width=256;label.height=64;const ctx=label.getContext('2d');ctx.fillStyle='#a9a5ad';ctx.fillRect(0,0,256,64);ctx.fillStyle='#46404d';ctx.textAlign='center';ctx.font='500 30px Arial';ctx.fillText('PLAUD',128,42);const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
 const mark=new THREE.Mesh(new THREE.PlaneGeometry(.115,.029),new THREE.MeshStandardMaterial({map:texture,roughness:.4,metalness:.4}));mark.position.set(0,-.09,.056);group.add(mark);
 group.userData={locallyAuthored:true,illustrativeModel:true,dimensionsMillimeters:[51,21,11],source:'https://www.plaud.ai/pages/plaud-notepin-s'};
 group.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});return group;
}

export function createPlaudBooth(THREE,entries,zh){
 const entry=entries.get('06_showcase_zone');if(entry?.state!=='ready'||!entry.mount.visible)return null;
 const placement=entry.mount.children[0];placement.updateWorldMatrix(true,true);
 const root=new THREE.Group();root.name='PLAUD_TOP_LEFT_SHOWCASE_EXHIBIT';root.matrix.copy(placement.matrixWorld);root.matrixAutoUpdate=false;
 const stage=new THREE.Group();stage.position.set(-.705,1.686,.06);root.add(stage);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.168,.18,.032,48),new THREE.MeshStandardMaterial({color:'#142630',roughness:.34,metalness:.65}));base.position.y=.016;stage.add(base);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.164,.005,6,48),new THREE.MeshBasicMaterial({color:'#7af7e3',toneMapped:false}));ring.rotation.x=Math.PI/2;ring.position.y=.034;stage.add(ring);
 const device=createNotePinModel(THREE);device.scale.setScalar(.79);device.position.y=.241;device.rotation.y=-.08;stage.add(device);
 const card=document.createElement('canvas');card.width=768;card.height=192;const ctx=card.getContext('2d');ctx.fillStyle='#101b25';ctx.fillRect(0,0,768,192);ctx.fillStyle='#7af7e3';ctx.fillRect(0,0,768,8);ctx.font='bold 64px Arial';ctx.fillStyle='#f4f2ed';ctx.fillText('PLAUD NotePin S',30,85);ctx.font='25px "Microsoft YaHei",Arial';ctx.fillStyle='#f2dc63';ctx.fillText(zh?'展位示意 / 测评计划  ↗':'BOOTH CONCEPT / REVIEW PLANNED  ↗',30,146);
 const map=new THREE.CanvasTexture(card);map.colorSpace=THREE.SRGBColorSpace;const plate=new THREE.Mesh(new THREE.PlaneGeometry(.43,.1075),new THREE.MeshBasicMaterial({map,toneMapped:false}));plate.position.set(0,-.015,.25);stage.add(plate);
 const glow=new THREE.PointLight('#8df7e4',.12,.65);glow.position.set(0,.28,.22);stage.add(glow);
 root.userData={locallyAuthored:true,shelf:'top-left',reviewStatus:'planned',sponsorStatus:'example-not-confirmed',anchorLocal:stage.position.toArray(),modelSource:device.userData.source};
 root.traverse(node=>{if(node.isMesh)node.userData={...node.userData,assetId:'06_showcase_zone',plaudExhibit:true};});
 return root;
}

export function openPlaudExhibit(zh){
 let dialog=document.querySelector('#plaud-exhibit-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='plaud-exhibit-dialog';dialog.style.cssText='width:min(680px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:32px;border:1px solid #6eddd0;border-radius:12px;background:#111523;color:#f4f2ed;font:16px/1.8 system-ui;box-shadow:0 24px 100px #000a';
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label',zh?'关闭产品介绍':'Close product details');close.style.cssText='float:right;background:transparent;border:0;color:#f3f1ed;font-size:30px;cursor:pointer';close.onclick=()=>dialog.close();
  const kicker=document.createElement('small');kicker.textContent='CYBER BOOTH / REVIEW PLANNED';kicker.style.color='#7af7e3';
  const title=document.createElement('h2');title.textContent='PLAUD NotePin S';
  const description=document.createElement('p');description.textContent=zh?'拟测评：AI native 独立工作室如何把黑客松讨论和发散灵感，整理成需求文档与开发 Spec。':'Planned review: turning hackathon discussions and scattered ideas into requirements and a development spec in an AI-native independent studio.';
  const flow=document.createElement('p');flow.textContent=zh?'记录与重点标记 → 转写 / 摘要导出 → AI 整理 PRD / Spec → WorkBuddy / Cursor / Codex':'Capture and highlight → Export transcript / summary → AI-assisted PRD / spec → WorkBuddy / Cursor / Codex';flow.style.color='#7af7e3';
  const status=document.createElement('p');status.textContent=zh?'当前为展位与外观示意，非厂商 CAD；测评与工作流尚待实测，合作待洽谈。':'Illustrative booth and product geometry, not manufacturer CAD. Review and workflow testing are planned; partnership is not confirmed.';status.style.cssText='color:#b8adc8;font-size:13px';
  const link=document.createElement('a');link.href='https://www.plaud.ai/pages/plaud-notepin-s';link.target='_blank';link.rel='noopener noreferrer';link.textContent=zh?'了解产品官网 ↗':'Visit the product website ↗';link.style.color='#f6dc62';
  dialog.append(close,kicker,title,description,flow,status,link);document.body.append(dialog);
 }
 if(!dialog.open)dialog.showModal();
}
