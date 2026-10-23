const DAY=86400000,OFFSET=8*3600000;
export const SPONSOR_PRICES={1:{month:10000,year:100000},2:{month:8000,year:80000},3:{month:5000,year:50000}};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw fail('invalid_date');const n=Date.parse(value+'T00:00:00+08:00');if(!Number.isFinite(n)||new Date(n+OFFSET).toISOString().slice(0,10)!==value)throw fail('invalid_date');return n;}
export function sponsorSchedule(start,term,end){
 const startAt=date(start);let endAt;
 if(['month','year'].includes(term)){
   const [y,m,d]=start.split('-').map(Number),next=new Date(Date.UTC(y,m-1+(term==='year'?12:1),1));
   const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
   endAt=Date.UTC(next.getUTCFullYear(),next.getUTCMonth(),Math.min(d,last))-OFFSET;
 }else endAt=date(end)+DAY;
 if(endAt<=startAt||endAt-startAt>366*DAY)throw fail('invalid_date_range');
 return {startAt,endAt};
}
function text(value,max,required=false){const s=String(value||'').trim();if(s.length>max||(required&&!s))throw fail('invalid_fields');return s;}
function receipt(row){return {id:row.id,tier:row.tier,page:row.page,term:row.term,brand:row.brand,status:row.status,paymentStatus:row.payment_status,amountCents:row.amount_cents,requestedStart:row.requested_start,requestedEnd:row.requested_end,startAt:row.start_at,endAt:row.end_at,reviewNote:row.review_note};}
const active=(r,now)=>r.status==='approved'&&r.start_at<=now&&r.end_at>now&&(r.tier==='core'?r.payment_status==='manual_confirmed':r.payment_status==='in_kind_confirmed');
export async function handleSponsors(request,env,{path,admin,hash,limitedBody,cleanJPEG}){
 const now=Date.now(),url=new URL(request.url);
 if(path==='/api/sponsors/plans'&&request.method==='GET')return json({prices:SPONSOR_PRICES,currency:'CNY',timezone:'Asia/Shanghai',rotationSeconds:8,paymentMode:'manual'});
 if(path==='/api/sponsors'&&request.method==='GET'){
   const rows=await env.DB.prepare("SELECT * FROM sponsor_applications WHERE status='approved' AND start_at<=? AND end_at>? ORDER BY page,tier").bind(now,now).all();
   return json({serverTime:now,rotationSeconds:8,sponsors:rows.results.filter(r=>active(r,now)).map(r=>({id:r.id,tier:r.tier,page:r.page,name:r.brand,url:r.website,tagline:r.tagline,startAt:r.start_at,endAt:r.end_at,logo:new URL('/api/sponsors/logos/'+r.id,url).href}))});
 }
 const image=path.match(/^\/api\/(admin\/)?sponsors\/logos\/([a-f0-9-]{36})$/i);
 if(image&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT * FROM sponsor_applications WHERE id=?').bind(image[2]).first();if(!row||(!admin&&!active(row,now)))return json({error:'not_found'},404);
   const object=await env.PHOTOS.get(row.logo_key);if(!object)return json({error:'not_found'},404);
   return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/sponsors/applications'&&request.method==='POST'){
   if(!env.RATE_SALT)throw fail('not_configured',503);
   const raw=await limitedBody(request),form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('Content-Type')||''},body:raw}).formData();
   const id=String(form.get('id')||''),token=String(form.get('receiptToken')||'');if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/.test(token))throw fail('invalid_receipt');
   const digest=await hash(token),existing=await env.DB.prepare('SELECT * FROM sponsor_applications WHERE id=?').bind(id).first();if(existing){if(existing.receipt_hash!==digest)throw fail('id_conflict',409);return json(receipt(existing));}
   const tier=form.get('tier'),page=Number(form.get('page')),term=form.get('term');
   if(!['core','hardware','community'].includes(tier)||![1,2,3].includes(page)||!(tier==='core'?['month','year'].includes(term):term===(tier==='hardware'?'project':'event'))||form.get('consent')!=='yes')throw fail('invalid_plan');
   const brand=text(form.get('brand'),60,true),tagline=text(form.get('tagline'),80),contact=text(form.get('contact'),160,true),association=text(form.get('association'),120,tier!=='core'),contribution=text(form.get('contribution'),400,tier!=='core');
   let website;try{website=new URL(form.get('website'));}catch{throw fail('invalid_website');}if(website.protocol!=='https:'||website.username||website.password||website.href.length>500)throw fail('invalid_website');
   const start=text(form.get('start'),10,true),end=tier==='core'?'':text(form.get('end'),10,true);const dates=sponsorSchedule(start,term,end);
   if(dates.endAt<=now||dates.startAt>now+730*DAY)throw fail('invalid_date_range');
   const file=form.get('logo');if(!(file instanceof File)||file.type!=='image/jpeg'||file.size>1500000)throw fail('invalid_image');const bytes=cleanJPEG(new Uint8Array(await file.arrayBuffer()));
   const actor=await hash(`${env.RATE_SALT}:sponsor:${request.headers.get('CF-Connecting-IP')||'local'}`);
   const admitted=await env.DB.prepare("INSERT INTO rate_events(id,actor,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM rate_events WHERE actor=? AND created_at>?)<5 AND (SELECT COUNT(*) FROM sponsor_applications WHERE status='pending')<500").bind(id,actor,now,actor,now-3600000).run();if(!admitted.meta.changes)throw fail('rate_limited',429);
   const key=`sponsors/${id}.jpg`,amount=tier==='core'?SPONSOR_PRICES[page][term]:0;
   try{await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});await env.DB.prepare('INSERT INTO sponsor_applications(id,tier,page,term,brand,website,tagline,contact,association,contribution,requested_start,requested_end,amount_cents,logo_key,receipt_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,tier,page,term,brand,website.href,tagline,contact,association,contribution,start,end,amount,key,digest,now,now).run();}
   catch(e){await env.PHOTOS.delete(key);await env.DB.prepare('DELETE FROM rate_events WHERE id=?').bind(id).run();throw e;}
   return json({id,tier,page,term,brand,status:'pending',paymentStatus:'pending',amountCents:amount,requestedStart:start,requestedEnd:end},201);
 }
 if(path==='/api/sponsors/receipts'&&request.method==='POST'){
   const input=JSON.parse(new TextDecoder().decode(await limitedBody(request)));if(!Array.isArray(input)||input.length>20)throw fail('invalid_receipts');const applications=[];
   for(const item of input){if(!/^[a-f0-9-]{36}$/i.test(item.id||'')||!/^[a-f0-9]{64}$/.test(item.token||''))throw fail('invalid_receipt');const row=await env.DB.prepare('SELECT * FROM sponsor_applications WHERE id=?').bind(item.id).first();if(row&&row.receipt_hash===await hash(item.token))applications.push(receipt(row));}
   return json({applications});
 }
 if(path==='/api/admin/sponsors'&&request.method==='GET'){
   const status=url.searchParams.get('status')||'pending';if(!['pending','approved','rejected','paused'].includes(status))throw fail('invalid_status');
   const rows=await env.DB.prepare('SELECT * FROM sponsor_applications WHERE status=? ORDER BY created_at DESC LIMIT 200').bind(status).all();return json({applications:rows.results.map(r=>{const {receipt_hash,logo_key,...safe}=r;return {...safe,live:active(r,now)};})});
 }
 const review=path.match(/^\/api\/admin\/sponsors\/([a-f0-9-]{36})$/i);
 if(review&&request.method==='PATCH'){
   const data=JSON.parse(new TextDecoder().decode(await limitedBody(request))),row=await env.DB.prepare('SELECT * FROM sponsor_applications WHERE id=?').bind(review[1]).first();if(!row)throw fail('not_found',404);
   if(!['pending','approved','rejected','paused'].includes(data.status)||!['pending',row.tier==='core'?'manual_confirmed':'in_kind_confirmed'].includes(data.paymentStatus)||data.version!==row.version)throw fail('stale_or_invalid_review',409);
   const note=text(data.note,400),start=data.start||row.requested_start,end=data.end||row.requested_end,dates=sponsorSchedule(start,row.term,end);
   if(data.status==='approved'&&(data.paymentStatus==='pending'||dates.endAt<=now))throw fail('confirmation_and_future_end_required');
   try{
     const updated=await env.DB.prepare('UPDATE sponsor_applications SET status=?,payment_status=?,start_at=?,end_at=?,review_note=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(data.status,data.paymentStatus,dates.startAt,dates.endAt,note,now,row.id,row.version).run();if(!updated.meta.changes)throw fail('stale_or_invalid_review',409);
   }catch(e){if(String(e.message).includes('sponsor_slot_conflict'))throw fail('slot_conflict',409);throw e;}
   await env.DB.prepare('INSERT INTO sponsor_audit(application_id,action,details,created_at) VALUES(?,?,?,?)').bind(row.id,'review',JSON.stringify({status:data.status,paymentStatus:data.paymentStatus,...dates,note,previousVersion:row.version}),now).run();
   return json({ok:true,...dates});
 }
 return null;
}
