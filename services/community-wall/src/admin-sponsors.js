export const sponsorAdminScript=String.raw`
function dateCN(ms){return ms?new Date(ms+8*3600000).toISOString().slice(0,10):'';}
async function loadSponsors(){
 clear();const current=generation;status('正在加载赞助申请……');
 try{
  const data=await(await api('sponsors?status='+q('#sponsor-filter').value)).json();if(current!==generation)return;
  status(data.applications.length+' 份申请 · 先确认合作，再审核排期；起止日期按北京时间。');
  for(const entry of data.applications){
   const card=document.createElement('article'),img=document.createElement('img');img.alt=entry.brand+' Logo';card.append(img);
   api('sponsors/logos/'+entry.id).then(r=>r.blob()).then(blob=>{if(current!==generation)return;const url=URL.createObjectURL(blob);urls.push(url);img.src=url;}).catch(()=>status('Logo 加载失败，请刷新'));
   const title=document.createElement('h2');title.textContent=entry.brand;
   const detail=document.createElement('p');detail.textContent={core:'核心赞助',hardware:'硬件赞助',community:'社区赞助'}[entry.tier]+' / 第 '+entry.page+' 页 / '+(entry.tier==='core'?'¥'+entry.amount_cents/100+' / '+(entry.term==='month'?'月':'年'):'实物或资源合作');
   const contact=document.createElement('p');contact.textContent='联系方式：'+entry.contact;
   const association=document.createElement('p');association.textContent=[entry.association,entry.contribution,entry.tagline].filter(Boolean).join('\n');
   const website=document.createElement('a');website.textContent='查看官网 ↗';website.href=entry.website;website.target='_blank';website.rel='noopener noreferrer';website.style.color='#124e45';
   const state=document.createElement('small');state.textContent='申请 '+entry.requested_start+(entry.requested_end?' 至 '+entry.requested_end:'')+' · '+(entry.live?'投放中':entry.status==='approved'?(entry.end_at<=Date.now()?'已到期':'待开始'):entry.status==='paused'?'已暂停':'未投放');
   card.append(title,detail,contact,association,website,state);
   const form=document.createElement('form');
   function field(label,element){const wrapper=document.createElement('label');wrapper.textContent=label;wrapper.append(element);form.append(wrapper);return element;}
   const approval=field('审核状态',document.createElement('select'));[['pending','待审核'],['approved','审核通过并按档期上架'],['paused','暂停投放'],['rejected','不通过']].forEach(v=>approval.add(new Option(v[1],v[0])));approval.value=entry.status;
   const payment=field(entry.tier==='core'?'线下收款确认（尚未接微信支付）':'项目 / 活动资源确认',document.createElement('select'));
   payment.add(new Option('尚未确认','pending'));payment.add(new Option(entry.tier==='core'?'已人工核实收款':'已确认硬件 / 展位 / swag 合作',entry.tier==='core'?'manual_confirmed':'in_kind_confirmed'));payment.value=entry.payment_status;
   const start=field('开始日期 · 北京时间 00:00',document.createElement('input'));start.type='date';start.required=true;start.value=dateCN(entry.start_at)||entry.requested_start;
   let end;if(entry.tier!=='core'){end=field('最后投放日 · 含当天',document.createElement('input'));end.type='date';end.required=true;end.value=entry.end_at?dateCN(entry.end_at-86400000):entry.requested_end;}
   else{const duration=document.createElement('small');duration.textContent='从开始日期起按自然'+(entry.term==='month'?'月':'年')+'计算，到期自动停止。月末日期取目标月最后一天。';form.append(duration);}
   const note=field('审核备注 · 申请人可见',document.createElement('textarea'));note.maxLength=400;note.value=entry.review_note;note.rows=3;
   const save=document.createElement('button');save.textContent='保存审核与档期';form.append(save);card.append(form);
   form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await api('sponsors/'+entry.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:entry.version,status:approval.value,paymentStatus:payment.value,start:start.value,end:end?.value||'',note:note.value})});await loadSponsors();}catch(e){status(e.message);save.disabled=false;}};
   q('#cards').append(card);
  }
 }catch(e){status(e.message);}
}
q('#wall-mode').onclick=()=>{mode='wall';q('#filter').hidden=false;q('#sponsor-filter').hidden=true;load();};
q('#sponsor-mode').onclick=()=>{mode='sponsors';q('#filter').hidden=true;q('#sponsor-filter').hidden=false;load();};
q('#sponsor-filter').onchange=load;
`;
