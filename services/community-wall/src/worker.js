import adminPage from './admin.js';
import {handleSponsors} from './sponsors.js';
const HOUR=3600000,DAY=24*HOUR,MAX_BODY=1700000;
const uuid=/^[a-f0-9-]{36}$/i;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fault=(code,status)=>Object.assign(new Error(code),{status});
async function hash(value){const data=new TextEncoder().encode(value);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');}
async function adminAllowed(request,env){const supplied=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!supplied||!env.ADMIN_TOKEN)return false;const a=await hash(supplied),b=await hash(env.ADMIN_TOKEN);let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
async function limitedBody(request){if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw fault('too_large',413);const reader=request.body?.getReader();if(!reader)throw fault('empty',400);const chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY){await reader.cancel();throw fault('too_large',413);}chunks.push(value);}const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
// JPEG-only storage; strip EXIF, GPS, IPTC, comments and other application
// metadata on the server as well as re-encoding in the browser.
export function cleanJPEG(bytes){
  if(bytes.length<10||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw fault('invalid_image',400);
  const pieces=[bytes.slice(0,2)];let p=2,dimensions=false;
  while(p<bytes.length-2){if(bytes[p]!==255)throw fault('invalid_image',400);const start=p;while(bytes[p]===255)p++;const marker=bytes[p++];
    if(marker===218){const length=(bytes[p]<<8)|bytes[p+1];if(!dimensions||length<2||p+length>bytes.length-2)throw fault('invalid_image',400);pieces.push(bytes.slice(start));const result=new Uint8Array(pieces.reduce((sum,c)=>sum+c.length,0));let offset=0;for(const chunk of pieces){result.set(chunk,offset);offset+=chunk.length;}return result;}
    if(marker===0||marker===216||marker===217||p+2>bytes.length)throw fault('invalid_image',400);
    const length=(bytes[p]<<8)|bytes[p+1];if(length<2||p+length>bytes.length)throw fault('invalid_image',400);
    if([192,193,194].includes(marker)){const height=(bytes[p+3]<<8)|bytes[p+4],width=(bytes[p+5]<<8)|bytes[p+6];if(length<8||!width||!height||width>4096||height>4096)throw fault('invalid_dimensions',400);dimensions=true;}
    if(!(marker>=225&&marker<=239)&&marker!==254)pieces.push(bytes.slice(start,p+length));p+=length;
  }throw fault('invalid_image',400);
}
function publicEntry(row){return {id:row.id,kind:row.kind,name:row.name,text:row.text,createdAt:row.created_at,status:row.status,wishState:row.wish_state};}
async function handle(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  if(request.method==='GET'&&path==='/admin')return new Response(adminPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
  if(request.method==='GET'&&path==='/api/health')return json({service:'techland-community-wall',reviewRequired:true});
  const admin=path.startsWith('/api/admin/');if(admin&&!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  if(path.startsWith('/api/sponsors')||path.startsWith('/api/admin/sponsors')){
    const response=await handleSponsors(request,env,{path,admin,hash,limitedBody,cleanJPEG});if(response)return response;
  }
  if(request.method==='GET'&&(path==='/api/entries'||path==='/api/admin/entries')){
    const status=admin&&['pending','approved','rejected'].includes(url.searchParams.get('status'))?url.searchParams.get('status'):'approved';
    const data=await env.DB.prepare('SELECT id,kind,name,text,created_at,status,wish_state FROM entries WHERE status=? ORDER BY created_at DESC LIMIT 120').bind(status).all();return json({entries:data.results.map(publicEntry)});
  }
  if(request.method==='POST'&&path==='/api/receipts'){
    const input=JSON.parse(new TextDecoder().decode(await limitedBody(request)));if(!Array.isArray(input)||input.length>48)throw fault('invalid_receipts',400);
    const entries=[];
    for(const item of input){if(!uuid.test(item.id||'')||!/^[a-f0-9]{64}$/.test(item.token||''))throw fault('invalid_receipt',400);const row=await env.DB.prepare('SELECT delete_hash,status,wish_state FROM entries WHERE id=?').bind(item.id).first();if(!row)entries.push({id:item.id,status:'expired'});else if(row.delete_hash===await hash(item.token))entries.push({id:item.id,status:row.status,wishState:row.wish_state});}
    return json({entries});
  }
  const photoMatch=path.match(/^\/api\/(admin\/)?photos\/([a-f0-9-]{36})$/i);
  if(request.method==='GET'&&photoMatch){
    const row=await env.DB.prepare('SELECT photo_key,status FROM entries WHERE id=?').bind(photoMatch[2]).first();if(!row?.photo_key||(!admin&&row.status!=='approved')||row.status==='removed')return json({error:'not_found'},404);
    const object=await env.PHOTOS.get(row.photo_key);if(!object)return json({error:'not_found'},404);
    return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','Content-Disposition':'inline','X-Content-Type-Options':'nosniff'}});
  }
  if(request.method==='POST'&&path==='/api/entries'){
    if(!env.RATE_SALT)throw fault('not_configured',503);
    const bytes=await limitedBody(request);const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('Content-Type')||''},body:bytes}).formData();
    const kind=form.get('kind'),name=String(form.get('name')||'').trim(),text=String(form.get('text')||'').trim();
    if(!['photo','message','wish'].includes(kind)||name.length>24||text.length>160||(kind!=='photo'&&!text)||form.get('consent')!=='yes')throw fault('invalid_entry',400);
    const id=String(form.get('id')||''),deleteToken=String(form.get('deleteToken')||'');
    if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(deleteToken))throw fault('invalid_receipt',400);
    const deleteHash=await hash(deleteToken),existing=await env.DB.prepare('SELECT delete_hash,status FROM entries WHERE id=?').bind(id).first();
    if(existing){if(existing.delete_hash!==deleteHash)throw fault('id_conflict',409);return json({id,deleteToken,status:existing.status});}
    let image=null;
    if(kind==='photo'){const file=form.get('photo');if(!(file instanceof File)||file.type!=='image/jpeg'||file.size>1500000)throw fault('invalid_image',400);image=cleanJPEG(new Uint8Array(await file.arrayBuffer()));}
    const now=Date.now(),actor=await hash(`${env.RATE_SALT}:${request.headers.get('CF-Connecting-IP')||'local'}`);
    const admitted=await env.DB.prepare('INSERT INTO rate_events(id,actor,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM rate_events WHERE actor=? AND created_at>?)<5 AND (SELECT COUNT(*) FROM entries WHERE status=?)<?').bind(id,actor,now,actor,now-HOUR,'pending',Number(env.MAX_PENDING)||1000).run();
    if(!admitted.meta.changes)throw fault('rate_limited',429);
    const key=image?`${id}.jpg`:null;
    try{if(image)await env.PHOTOS.put(key,image,{httpMetadata:{contentType:'image/jpeg'}});await env.DB.prepare('INSERT INTO entries(id,kind,name,text,created_at,status,photo_key,delete_hash) VALUES(?,?,?,?,?,?,?,?)').bind(id,kind,name,text,now,'pending',key,deleteHash).run();}
    catch(error){if(key)await env.PHOTOS.delete(key);await env.DB.prepare('DELETE FROM rate_events WHERE id=?').bind(id).run();throw error;}
    return json({id,deleteToken,status:'pending'},201);
  }
  const entryMatch=path.match(/^\/api\/entries\/([a-f0-9-]{36})$/i);
  if(request.method==='DELETE'&&entryMatch){
    const row=await env.DB.prepare('SELECT delete_hash,photo_key FROM entries WHERE id=?').bind(entryMatch[1]).first();if(!row)return json({error:'not_found'},404);
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';if(!token||row.delete_hash!==await hash(token))return json({error:'unauthorized'},401);
    await env.DB.prepare('UPDATE entries SET status=?,text=?,name=?,reviewed_at=? WHERE id=?').bind('removed','','',Date.now(),entryMatch[1]).run();if(row.photo_key)await env.PHOTOS.delete(row.photo_key);return json({ok:true});
  }
  const moderateMatch=path.match(/^\/api\/admin\/entries\/([a-f0-9-]{36})$/i);
  if(request.method==='PATCH'&&moderateMatch){
    const data=JSON.parse(new TextDecoder().decode(await limitedBody(request)));if(!['approved','rejected'].includes(data.status)||!['open','making','fulfilled'].includes(data.wishState||'open'))throw fault('invalid_review',400);
    const result=await env.DB.prepare('UPDATE entries SET status=?,wish_state=?,reviewed_at=? WHERE id=? AND status!=?').bind(data.status,data.wishState||'open',Date.now(),moderateMatch[1],'removed').run();return result.meta.changes?json({ok:true}):json({error:'not_found'},404);
  }
  return json({error:'not_found'},404);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim());
    const sameOrigin=origin===url.origin,accepted=!origin||sameOrigin||allowed.includes(origin);
    if(!accepted)return json({error:'origin_not_allowed'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||url.origin,'Access-Control-Allow-Methods':'GET,POST,DELETE,PATCH,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Vary':'Origin'}});
    let response;try{response=await handle(request,env);}catch(error){response=json({error:error.status?error.message:'request_failed'},error.status||500);}
    const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Vary','Origin');if(origin)headers.set('Access-Control-Allow-Origin',origin);return new Response(response.body,{status:response.status,headers});
  },
  async scheduled(_event,env){
    const cutoff=Date.now()-30*DAY;const old=await env.DB.prepare('SELECT id,photo_key FROM entries WHERE status IN (?,?,?) AND created_at<? LIMIT 500').bind('pending','rejected','removed',cutoff).all();
    for(const row of old.results){const claimed=await env.DB.prepare('UPDATE entries SET status=? WHERE id=? AND status IN (?,?,?) RETURNING photo_key').bind('removed',row.id,'pending','rejected','removed').first();if(!claimed)continue;if(claimed.photo_key)await env.PHOTOS.delete(claimed.photo_key);await env.DB.prepare('DELETE FROM entries WHERE id=? AND status=?').bind(row.id,'removed').run();}
    await env.DB.prepare('DELETE FROM rate_events WHERE created_at<?').bind(Date.now()-DAY).run();
  }
};
