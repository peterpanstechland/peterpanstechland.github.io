// The local preview never claims that a contribution is publicly published.
export const WALL_TYPES = ['photo', 'message', 'wish'];
export function validateContribution({kind, name, text, photo}) {
  if (!WALL_TYPES.includes(kind)) throw new Error('kind');
  name = String(name || '').trim().slice(0, 24);
  text = String(text || '').trim();
  if (text.length > 160 || (kind !== 'photo' && !text)) throw new Error('text');
  if (kind === 'photo' && (!photo || photo.type !== 'image/jpeg' || photo.size > 1500000)) throw new Error('photo');
  return {kind, name, text, photo: kind === 'photo' ? photo : null};
}
export async function createCommunityStore() {
  const config = await fetch(new URL('./community/config.json', import.meta.url), {cache:'no-cache'}).then(r => {if(!r.ok)throw Error('config');return r.json();});
  const remote = config.mode === 'shared' && !!config.apiBase;
  const base = remote ? new URL(config.apiBase, location.href) : null;
  if (base && base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw Error('HTTPS required');
  const db = await new Promise((resolve,reject) => {
    const req=indexedDB.open('techland-community-v1',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('entries',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  function transaction(mode, operation) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('entries',mode),request=operation(tx.objectStore('entries'));
      tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  const locals=()=>transaction('readonly',store=>store.getAll());
  const endpoint=path=>new URL(path,base.href.endsWith('/')?base:new URL(base.href+'/'));
  async function list() {
    const mine=await locals();
    if(!remote)return mine.sort((a,b)=>b.createdAt-a.createdAt);
    const receipts=mine.filter(e=>e.deleteToken);
    if(receipts.length){
      const response=await fetch(endpoint('receipts'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipts.map(e=>({id:e.id,token:e.deleteToken}))),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('network');
      const data=await response.json();
      for(const receipt of data.entries||[]){const entry=mine.find(e=>e.id===receipt.id);if(entry&&['pending','approved','rejected','removed','expired'].includes(receipt.status)){entry.status=receipt.status;entry.wishState=receipt.wishState;await transaction('readwrite',s=>s.put(entry));}}
    }
    const response=await fetch(endpoint('entries'),{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('network');
    const data=await response.json();
    const publicEntries=(Array.isArray(data.entries)?data.entries:[]).filter(e=>WALL_TYPES.includes(e.kind)&&e.status==='approved').map(e=>({...mine.find(m=>m.id===e.id),...e,photoURL:e.kind==='photo'?endpoint(`photos/${encodeURIComponent(e.id)}`).href:null}));
    return [...mine.filter(e=>!publicEntries.some(p=>p.id===e.id)),...publicEntries].sort((a,b)=>b.createdAt-a.createdAt);
  }
  let attempt=null;
  async function add(input) {
    const value=validateContribution(input),mine=await locals();
    if(mine.length>=Math.min(config.maxLocalEntries||48,100))throw Error('full');
    const sameAttempt=attempt&&attempt.kind===value.kind&&attempt.name===value.name&&attempt.text===value.text&&attempt.photo===value.photo;
    const entry=sameAttempt?attempt:{...value,id:crypto.randomUUID(),createdAt:Date.now(),status:'local',owned:true};
    if(remote) {
      entry.deleteToken ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');attempt=entry;
      const form=new FormData();form.set('kind',value.kind);form.set('name',value.name);form.set('text',value.text);form.set('consent','yes');
      form.set('id',entry.id);form.set('deleteToken',entry.deleteToken);
      if(value.photo)form.set('photo',value.photo,'photo.jpg');
      const response=await fetch(endpoint('entries'),{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error(response.status===429?'rate':'network');
      const result=await response.json();entry.id=result.id;entry.deleteToken=result.deleteToken;entry.status=result.status;
    }
    try {await transaction('readwrite',store=>store.put(entry));}
    catch(error) { if(remote) { error.message='savedRemote'; } throw error; }
    attempt=null;return entry;
  }
  async function remove(id) {
    const entry=(await locals()).find(e=>e.id===id);if(!entry)throw Error('owner');
    if(remote&&entry.deleteToken){
      const response=await fetch(endpoint(`entries/${encodeURIComponent(id)}`),{method:'DELETE',headers:{Authorization:`Bearer ${entry.deleteToken}`},signal:AbortSignal.timeout(15000)});
      if(!response.ok&&response.status!==404)throw Error('network');
    }
    await transaction('readwrite',store=>store.delete(id));
  }
  return {remote,list,add,remove};
}
