import {createCommunityStore} from './community-store.js?v=community-v1';
const FAMILY=new URL('./community/family.jpg',import.meta.url).href;
export {FAMILY};
export function createCommunityWall(zh,onChange=()=>{}) {
  const t=(en,cn)=>zh?cn:en;
  const labels={photo:t('Photo wall','照片墙'),message:t('Message wall','留言墙'),wish:t('Wish wall','许愿墙')};
  const dialog=document.createElement('dialog');dialog.id='community-wall';dialog.setAttribute('aria-labelledby','community-title');
  dialog.innerHTML=`<button class="cw-close" type="button" aria-label="${t('Close community wall','关闭共创墙')}">×</button>
    <header class="cw-header"><div><span class="cw-kicker">THE OTHER SIDE OF TECHLAND / 001</span><h2 id="community-title">${t('You were here.','到此一游。')}</h2><p>${t('A little piece of you, in our corner of the world.','把这一刻留在这里，让这面墙和我们一起长大。')}</p></div><span class="cw-mode"></span></header>
    <section class="cw-family"><figure><img src="${FAMILY}" alt="${t('Peter and his family','Peter 的全家福')}"><figcaption>OUR LITTLE CREW <span>♥</span></figcaption></figure><div><span class="cw-kicker">PINNED BY PETER</span><h3>${t('Made with curiosity.\nKept with love.','好奇心造物，\n爱让这里成为家。')}</h3><p>${t('Welcome to our garage. A photo, a few words, or a wish for something we could build together.','欢迎来我们的车库。留一张合影，说几句话，或者许下一个可以一起实现的愿望。')}</p></div></section>
    <div class="cw-workspace"><section class="cw-collection"><div class="cw-tabs" role="tablist" aria-label="${t('Choose a wall','选择墙面')}"></div><div class="cw-cards" role="tabpanel" tabindex="0"></div><p class="cw-count"></p></section>
    <aside class="cw-compose"><span class="cw-kicker">LEAVE A LITTLE TRACE</span><h3>${t('Your corner of the wall','留下一点你的痕迹')}</h3><div class="cw-kinds" role="group" aria-label="${t('Contribution type','选择照片或文字')}"></div>
    <form class="cw-form"><div class="cw-photo-tools"><div class="cw-photo-preview"><span class="cw-photo-empty">${t('One moment. One Polaroid.','把这一刻，装进拍立得。')}</span><video muted autoplay playsinline hidden></video><img alt="${t('Your photo preview','你的照片预览')}" hidden></div>
    <div class="cw-photo-buttons"><button class="cw-camera" type="button">◎ ${t('Open camera','打开相机')}</button><button class="cw-upload" type="button">↥ ${t('Choose photo','选择照片')}</button><button class="cw-capture" type="button" hidden>● ${t('Take photo','拍照')}</button><button class="cw-stop" type="button" hidden>${t('Close camera','关闭相机')}</button></div><input class="cw-file" type="file" accept="image/jpeg,image/png,image/webp" hidden><p class="cw-photo-help">${t('JPEG, PNG or WebP · up to 12 MB. You review it before posting.','JPEG、PNG、WebP · 最大 12 MB。拍完先预览，再决定是否上墙。')}</p></div>
    <label>${t('What would you like to leave?','想留下一句什么？')}<textarea class="cw-text" rows="3" maxlength="160"></textarea></label><div class="cw-counter">0 / 160</div>
    <label>${t('Name · optional','署名 · 可不填')}<input class="cw-name" autocomplete="nickname" maxlength="24" placeholder="${t('A passing maker','路过的创客')}"></label>
    <label class="cw-consent"><input type="checkbox" required><span></span></label><button class="cw-submit" type="submit" disabled></button><p class="cw-status" role="status" aria-live="polite"></p></form>
    <p class="cw-policy"></p></aside></div>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),tabs=$('.cw-tabs'),kinds=$('.cw-kinds'),grid=$('.cw-cards');
  let selected='photo',entries=[],store=null,photo=null,photoURL=null,stream=null,cameraTicket=0,saving=false,processing=false;
  const urls=new Map();
  function status(message){$('.cw-status').textContent=message;}
  function stopCamera(){cameraTicket++;stream?.getTracks().forEach(track=>track.stop());stream=null;const video=$('video');video.srcObject=null;video.hidden=true;$('.cw-capture').hidden=true;$('.cw-stop').hidden=true;$('.cw-camera').disabled=false;$('.cw-photo-empty').hidden=!!photo;$('.cw-photo-preview img').hidden=!photo;}
  function resetPhoto(){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;photo=null;$('.cw-photo-preview img').removeAttribute('src');$('.cw-photo-preview img').hidden=true;$('.cw-photo-empty').hidden=false;$('.cw-file').value='';}
  function reflectType(){
    stopCamera();tabs.querySelectorAll('button').forEach(b=>{const active=b.dataset.kind===selected;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    kinds.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===selected)));
    grid.id=`cw-panel-${selected}`;grid.setAttribute('aria-labelledby',`cw-tab-${selected}`);
    $('.cw-photo-tools').hidden=selected!=='photo';$('.cw-text').required=selected!=='photo';
    $('.cw-text').placeholder=selected==='wish'?t('What should we make possible together?','想和大家一起实现什么？'):selected==='message'?t('A hello, a thought, a story…','一句问候、一个灵感、一段故事……'):t('Caption · optional','照片背后的小故事 · 可不填');
    renderCards();
  }
  for(const [kind,label] of Object.entries(labels)){
    const button=document.createElement('button');button.type='button';button.id=`cw-tab-${kind}`;button.dataset.kind=kind;button.role='tab';button.setAttribute('aria-controls',`cw-panel-${kind}`);button.textContent=label;button.addEventListener('click',()=>{selected=kind;reflectType();});tabs.append(button);
    button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const all=[...tabs.children],i=all.indexOf(button),index=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;all[index].click();all[index].focus();});
    const choice=document.createElement('button');choice.type='button';choice.dataset.kind=kind;choice.textContent=kind==='photo'?t('◎ Photo','◎ 照片'):kind==='message'?t('✎ Message','✎ 留言'):t('✧ Wish','✧ 许愿');choice.addEventListener('click',()=>{selected=kind;reflectType();$('.cw-text').focus();});kinds.append(choice);
  }
  function displayURL(entry){if(entry.photo instanceof Blob){if(!urls.has(entry.id))urls.set(entry.id,URL.createObjectURL(entry.photo));return urls.get(entry.id);}return entry.photoURL;}
  function renderCards(){
    grid.replaceChildren();const filtered=entries.filter(e=>e.kind===selected);
    if(!filtered.length){const empty=document.createElement('div');empty.className=`cw-empty cw-empty-${selected}`;const icon=document.createElement('span');icon.textContent=selected==='photo'?'◎':selected==='wish'?'✧':'✎';const heading=document.createElement('h4');heading.textContent=selected==='photo'?t('The next frame is yours.','下一张拍立得，留给你。'):selected==='wish'?t('Big things start with a small wish.','大大的可能，从小小的愿望开始。'):t('A hello is a good beginning.','从一句「你好」开始。');const hint=document.createElement('p');hint.textContent=t('Be the first to leave a trace here.','这里还没有访客作品，来留下第一份吧。');empty.append(icon,heading,hint);grid.append(empty);}
    filtered.forEach((entry,index)=>{
      const card=document.createElement('article');card.className=`cw-card cw-${entry.kind}`;card.style.setProperty('--tilt',`${[-2,1.5,-1,2][index%4]}deg`);
      if(entry.kind==='photo'){const img=document.createElement('img');img.src=displayURL(entry);img.alt=entry.text||t('Visitor photo','访客照片');img.loading='lazy';card.append(img);}
      const body=document.createElement('p');body.textContent=entry.text||(entry.kind==='photo'?t('I was here.','到此一游。'):'');card.append(body);
      const signature=document.createElement('small');signature.textContent=`${entry.name||t('A passing maker','路过的创客')} · ${new Date(entry.createdAt).toLocaleDateString(zh?'zh-CN':'en-GB',{month:'short',day:'numeric'})}`;card.append(signature);
      const badge=document.createElement('span');badge.className='cw-card-status';badge.textContent=entry.status==='local'?t('Only on this device','仅本机可见'):entry.status==='pending'?t('Awaiting review · only you','待审核 · 仅你可见'):['rejected','removed','expired'].includes(entry.status)?t('Not public · your saved copy','未公开 · 本机留存'):entry.kind==='wish'?({open:t('A wish is planted','愿望已种下'),making:t('In the making','正在实现'),fulfilled:t('Wish fulfilled','愿望已实现')}[entry.wishState||'open']):t('On the wall','已上墙');card.append(badge);
      if(entry.owned){const remove=document.createElement('button');remove.type='button';remove.className='cw-remove';remove.textContent=t('Remove mine','撤下我的作品');let confirmed=false;remove.addEventListener('click',async()=>{if(!confirmed){confirmed=true;remove.textContent=t('Confirm removal','确认撤下');return;}remove.disabled=true;try{await store.remove(entry.id);if(urls.has(entry.id)){URL.revokeObjectURL(urls.get(entry.id));urls.delete(entry.id);}await refresh();}catch{status(t('Could not remove it. Please try again.','撤下失败，请重试。'));remove.disabled=false;}});card.append(remove);}
      grid.append(card);
    });
    $('.cw-count').textContent=t(`${filtered.length} traces · Your story belongs here.`,`${filtered.length} 份痕迹 · 这里也有你的位置。`);
  }
  async function refresh(){entries=await store.list();renderCards();onChange(entries.map(e=>({...e,displayURL:displayURL(e)})));}
  function setMode(){const remote=store.remote;$('.cw-mode').textContent=remote?t('COMMUNITY / LIVE','共创墙 / 已连接'):t('LOCAL PREVIEW','本机体验');$('.cw-submit').textContent=remote?t('Submit to the wall ↗','提交上墙 ↗'):t('Pin to my preview ↗','贴到我的预览墙 ↗');$('.cw-consent span').textContent=remote?t('I have permission to share this. It may be shown publicly after review.','我有权分享这些内容，并同意审核通过后公开展示。'):t('Save this on this browser only. It will not be uploaded.','保存到当前浏览器，仅本机可见，不会上传。');$('.cw-policy').textContent=remote?t('You see your work right away. Others see it after Peter reviews it. You can remove your own work on this device.','你可以立即预览，Peter 审核后大家才能看到。可在当前设备撤下自己的作品。'):t('This preview is saved on this browser only. Shared posting is not connected yet. Clearing browser data removes these pieces.','目前是本机体验，尚未接通多人共享。刷新仍保留；清除浏览器数据会移除这些作品。');$('.cw-submit').disabled=false;}
  async function acceptPhoto(blob){
    if(blob.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('format');
    const bitmap=await createImageBitmap(blob);try{if(bitmap.width*bitmap.height>50000000)throw Error('size');const canvas=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const encoded=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));if(!encoded||encoded.size>1500000)throw Error('size');resetPhoto();photo=encoded;photoURL=URL.createObjectURL(photo);$('.cw-photo-preview img').src=photoURL;$('.cw-photo-preview img').hidden=false;$('.cw-photo-empty').hidden=true;}finally{bitmap.close();}
  }
  $('.cw-upload').addEventListener('click',()=>{stopCamera();$('.cw-file').click();});
  $('.cw-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;processing=true;$('.cw-submit').disabled=true;try{await acceptPhoto(file);status(t('Photo ready. Add a caption or pin it below.','照片已准备好，确认预览后即可上墙。'));}catch{status(t('Choose a valid JPEG, PNG or WebP under 12 MB.','请选一张有效的 JPEG、PNG 或 WebP 图片，大小不超过 12 MB。'));}finally{processing=false;$('.cw-submit').disabled=!store;}});
  $('.cw-camera').addEventListener('click',async()=>{
    stopCamera();const ticket=++cameraTicket;$('.cw-camera').disabled=true;status(t('Waiting for camera permission…','等待相机授权……'));
    try{if(!navigator.mediaDevices?.getUserMedia)throw Error('unavailable');const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});if(ticket!==cameraTicket||!dialog.open||selected!=='photo'){acquired.getTracks().forEach(track=>track.stop());return;}stream=acquired;const video=$('video');video.srcObject=stream;video.hidden=false;$('.cw-photo-preview img').hidden=true;$('.cw-photo-empty').hidden=true;await video.play();$('.cw-capture').hidden=false;$('.cw-stop').hidden=false;status(t('Ready when you are. Nothing uploads automatically.','准备好就按拍照，不会自动上传。'));}
    catch{if(ticket===cameraTicket){stopCamera();status(t('Camera unavailable or permission denied. You can choose a photo instead.','相机不可用或未获授权，也可以选择已有照片。'));}}
  });
  $('.cw-stop').addEventListener('click',()=>{stopCamera();status('');});
  $('.cw-capture').addEventListener('click',async()=>{const video=$('video');if(!video.videoWidth)return;processing=true;$('.cw-capture').disabled=true;$('.cw-submit').disabled=true;try{const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));stopCamera();await acceptPhoto(blob);status(t('Captured. Review your photo before posting.','拍好了。确认照片后再上墙。'));}catch{status(t('Could not take the photo. Please try again.','拍照失败，请重试。'));}finally{processing=false;$('.cw-capture').disabled=false;$('.cw-submit').disabled=!store;}});
  $('.cw-text').addEventListener('input',()=>$('.cw-counter').textContent=`${$('.cw-text').value.length} / 160`);
  $('.cw-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!store||saving||processing)return;if(selected==='photo'&&!photo){status(t('Take or choose a photo first.','请先拍照或选择一张照片。'));return;}
    saving=true;$('.cw-submit').disabled=true;status(t('Pinning your piece…','正在贴上你的作品……'));
    try{await store.add({kind:selected,name:$('.cw-name').value,text:$('.cw-text').value,photo});await refresh();$('.cw-text').value='';$('.cw-counter').textContent='0 / 160';$('.cw-consent input').checked=false;resetPhoto();stopCamera();status(store.remote?t('Received. Your preview is here; public display follows review.','收到啦！你可以看到预览，审核后会向所有人展示。'):t('Pinned here. Saved on this browser only.','贴好啦！已保存在本机，刷新后仍然可见。'));}
    catch(error){status(error.message==='full'?t('This browser wall is full. Remove an old piece to make room.','本机墙已满，请先撤下一份旧作品。'):error.message==='rate'?t('A little too fast. Try again later.','发布太频繁，稍后再试。'):error.message==='savedRemote'?t('Submitted, but this browser could not save your receipt. Please do not submit again.','已提交，但浏览器未能保存回执，请勿重复提交。'):t('Could not save. Your draft is still here; try again.','保存失败，草稿还在，请重试。'));}
    finally{saving=false;$('.cw-submit').disabled=false;}
  });
  $('.cw-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',stopCamera);dialog.addEventListener('cancel',stopCamera);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});window.addEventListener('pagehide',stopCamera);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();});
  reflectType();
  const ready=createCommunityStore().then(async value=>{store=value;setMode();await refresh();}).catch(()=>{status(t('Storage is unavailable. Allow site storage and reload to leave a piece.','暂时无法保存，请允许网站存储后刷新再试。'));});
  return {open(kind){if(labels[kind]){selected=kind;reflectType();}if(!dialog.open)dialog.showModal();if(store?.remote)refresh().catch(()=>status(t('Could not refresh the shared wall. Please try again.','共享墙刷新失败，请稍后重试。')));},ready,getEntries:()=>entries.map(e=>({...e,displayURL:displayURL(e)}))};
}
