const labels={core:'核心赞助',hardware:'硬件赞助',community:'社区赞助'};
const errors={slot_conflict:'档期已占用，请联系 Peter 调整。',rate_limited:'提交较频繁，请稍后再试。',invalid_date_range:'请选择有效的未来档期，最长一年。',invalid_date:'请检查日期。',invalid_website:'官网须为有效的 HTTPS 地址。',invalid_image:'请重新选择 JPEG、PNG 或 WebP Logo。',invalid_fields:'请检查必填项与字数。'};
const localKey='techland-sponsor-receipts-v1';
const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const dateCN=ms=>ms?new Date(ms+8*3600000).toISOString().slice(0,10):'';
export async function createSponsorService(){
 const config=await (await fetch(new URL('./community/config.json',import.meta.url),{cache:'no-cache'})).json();
 if(config.mode!=='shared'||!config.apiBase)throw Error('赞助申请暂未连接，请稍后再试。');
 const base=new URL(config.apiBase);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Invalid API');
 async function request(path,options={}){const response=await fetch(new URL(path,base),{...options,signal:AbortSignal.timeout(25000)});const data=await response.json();if(!response.ok)throw Error(errors[data.error]||'暂时无法连接，请稍后重试。');return data;}
 const plans=await request('sponsors/plans');
 return {plans,request};
}
export function createSponsorApplication(service,zh){
 const dialog=document.createElement('dialog');dialog.id='sponsor-application';dialog.setAttribute('aria-labelledby','sa-title');
 dialog.innerHTML=`<button type="button" class="sp-close" aria-label="关闭申请">×</button><header><span class="sp-kicker">SPONSOR TECHLAND</span><h2 id="sa-title">把你的品牌，带进创造现场。</h2><p>先提交合作意向，Peter 审核并确认收款或合作资源后安排投放。</p></header>
 <form class="sa-form"><div class="sa-grid">
 <label>合作类别<select name="tier"><option value="core">核心赞助</option><option value="hardware">硬件赞助</option><option value="community">社区赞助</option></select></label>
 <label>轮播页面<select name="page"><option value="1">第 1 页</option><option value="2">第 2 页</option><option value="3">第 3 页</option></select></label>
 <label class="sa-term">赞助周期<select name="term"><option value="month">一个自然月</option><option value="year">一个自然年</option></select></label>
 <div class="sa-quote" role="status"></div>
 <label>品牌 / 组织名称<input name="brand" maxlength="60" required autocomplete="organization"></label>
 <label>官方网站<input name="website" type="url" placeholder="https://" maxlength="500" required></label>
 <label class="sa-wide">一句介绍<input name="tagline" maxlength="80" placeholder="希望大家记住什么？"></label>
 <label class="sa-wide">联系邮箱或微信 · 仅 Peter 可见<input name="contact" maxlength="160" required></label>
 <label class="sa-association sa-wide"><span>关联项目 / 活动</span><input name="association" maxlength="120"></label>
 <label class="sa-contribution sa-wide"><span>提供的硬件 / 展位 / swag 等资源</span><textarea name="contribution" maxlength="400" rows="3"></textarea></label>
 <label>希望开始日期 · 北京时间<input name="start" type="date" required></label>
 <label class="sa-end">希望最后投放日 · 含当天<input name="end" type="date"></label>
 <label class="sa-logo sa-wide">品牌 Logo<input name="logo" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPEG / PNG / WebP，最大 6 MB；透明背景将转为白底，保持原比例。</small><img class="sa-preview" alt="Logo 预览" hidden></label>
 </div><p class="sa-payment">尚未开放在线支付。此表只提交合作意向，不扣款、不自动占位。最终档期以审核结果为准。</p>
 <label class="sa-consent"><input name="consent" type="checkbox" required>我有权使用提交的素材，同意审核后公开展示品牌和官网，联系方式仅用于合作沟通。</label>
 <button type="submit" class="sa-submit">提交赞助申请 ↗</button><p class="sa-status" role="status"></p></form>
 <section class="sa-history"><h3>此设备提交的申请</h3><button type="button" class="sa-refresh">刷新进度</button><p>回执只保存在当前浏览器；清除浏览器数据后，请通过联系方式向 Peter 查询。</p><div class="sa-records"></div></section>`;
 const q=s=>dialog.querySelector(s),form=q('form'),field=name=>form.elements.namedItem(name);let logo=null,previewURL=null,attempt=null,busy=false,uploadTicket=0;
 const status=value=>q('.sa-status').textContent=value;
 const read=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'[]').filter(r=>r.id&&r.token).slice(-20);}catch{return [];}};
 function remember(entry){const rows=read().filter(r=>r.id!==entry.id);rows.push(entry);localStorage.setItem(localKey,JSON.stringify(rows.slice(-20)));}
 function update(){const tier=field('tier').value,core=tier==='core';q('.sa-term').hidden=!core;q('.sa-end').hidden=core;field('end').required=!core;q('.sa-association').hidden=core;field('association').required=!core;q('.sa-contribution').hidden=core;field('contribution').required=!core;
 q('.sa-association span').textContent=tier==='hardware'?'关联制作项目':'关联活动与日期';
 q('.sa-contribution span').textContent=tier==='hardware'?'提供哪些硬件、数量与支持方式':'提供哪些展位 / swag / 活动资源';
 const amount=service.plans.prices[field('page').value][field('term').value]/100;q('.sa-quote').textContent=core?'¥'+amount+' / '+(field('term').value==='year'?'年':'月')+' · 第 '+field('page').value+' 页':tier==='hardware'?'按项目协商硬件支持与档期':'按活动安排展位 / swag 与档期';}
 async function history(){const receipts=read();q('.sa-records').replaceChildren();if(!receipts.length){q('.sa-records').textContent='还没有提交过申请。';return;}try{const {applications}=await service.request('sponsors/receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipts.map(r=>({id:r.id,token:r.token})))});for(const entry of applications){const row=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p');title.textContent=entry.brand+' / '+labels[entry.tier]+' / 第 '+entry.page+' 页';const stage=entry.status==='approved'?(entry.endAt<=Date.now()?'已到期':entry.startAt>Date.now()?'已排期':'投放中'):({pending:'待审核',rejected:'未通过',paused:'暂停投放'}[entry.status]||entry.status);info.textContent=stage+' · '+(entry.paymentStatus==='pending'?'合作待确认':'合作已确认')+(entry.amountCents?' · ¥'+entry.amountCents/100:'')+(entry.startAt?' · '+dateCN(entry.startAt)+' 至 '+dateCN(entry.endAt-1):'')+(entry.reviewNote?'\nPeter：'+entry.reviewNote:'');row.append(title,info);q('.sa-records').append(row);}if(!applications.length)q('.sa-records').textContent='暂未收到申请记录；如刚提交超时，可使用原表单重试。';}catch(e){q('.sa-records').textContent=e.message;}}
 form.addEventListener('input',()=>{if(!busy)attempt=null;});for(const name of ['tier','page','term'])field(name).onchange=update;
 field('logo').onchange=async()=>{const ticket=++uploadTicket;logo=null;status('');q('.sa-preview').hidden=true;const file=field('logo').files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>6*1024*1024){status('请选择 6 MB 以内的 JPEG / PNG / WebP 图片。');field('logo').value='';return;}try{const bitmap=await createImageBitmap(file),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#f0f2ef';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const processed=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(ticket!==uploadTicket)return;logo=processed;if(!logo||logo.size>1500000)throw Error('图片处理失败，请选择较小图片。');if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(logo);q('.sa-preview').src=previewURL;q('.sa-preview').hidden=false;}catch(e){logo=null;status(e.message);}};
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;if(!logo){status('请先选择并预览 Logo。');return;}if(!field('website').value.startsWith('https://')){status('官网地址请使用 https://。');return;}
 busy=true;q('.sa-submit').disabled=true;status('正在提交……');try{
   attempt ||= {id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')};remember({...attempt,brand:field('brand').value});
   const payload=new FormData(form);payload.set('logo',logo,'logo.jpg');payload.set('consent','yes');payload.set('id',attempt.id);payload.set('receiptToken',attempt.token);if(field('tier').value!=='core')payload.set('term',field('tier').value==='hardware'?'project':'event');for(const element of form.elements)element.disabled=true;
   const response=await service.request('sponsors/applications',{method:'POST',body:payload});status('已收到申请 '+response.id.slice(0,8)+'。审核通过、合作确认并进入档期后才会上架。');attempt=null;form.reset();logo=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;q('.sa-preview').hidden=true;field('start').value=today();update();await history();
 }catch(e){status(e.message+' 如提交超时，请直接重试，避免重复申请。');}finally{busy=false;for(const element of form.elements)element.disabled=false;}};
 q('.sp-close').onclick=()=>dialog.close();q('.sa-refresh').onclick=history;document.body.append(dialog);field('start').value=today();update();
 return {open(tier='core',page=1){field('tier').value=tier;field('page').value=String(page);update();if(!dialog.open)dialog.showModal();history();}};
}
