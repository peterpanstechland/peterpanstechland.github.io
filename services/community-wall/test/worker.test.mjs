import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker,{cleanJPEG} from '../src/worker.js';
const schema=fs.readFileSync(new URL('../migrations/0001_wall.sql',import.meta.url),'utf8');
const jpeg=fs.readFileSync(new URL('../../../static/maker-garage-preview/community/family.jpg',import.meta.url));
function fixture(t){
  const db=new DatabaseSync(':memory:');db.exec(schema);t.after(()=>db.close());const objects=new Map();
  const env={
    DB:{prepare(sql){return {bind(...args){return {
      async first(){return db.prepare(sql).get(...args)||null;},
      async all(){return {results:db.prepare(sql).all(...args)};},
      async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}
    };}};}},
    PHOTOS:{async put(key,body){objects.set(key,body);},async get(key){const body=objects.get(key);return body?{body}:null;},async delete(key){objects.delete(key);}},
    ADMIN_TOKEN:'test-admin-secret',RATE_SALT:'test-rate-salt',ALLOWED_ORIGINS:'https://example.test'
  };
  async function request(path,{method='GET',body,admin=false,token,origin='https://example.test',ip='1.2.3.4'}={}){const headers={Origin:origin,'CF-Connecting-IP':ip};if(admin||token)headers.Authorization=`Bearer ${token||env.ADMIN_TOKEN}`;if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}return worker.fetch(new Request(`https://wall.test/api/${path}`,{method,headers,body}),env);}
  return {db,env,objects,request};
}
function form(kind='message',overrides={}){const f=new FormData();Object.entries({id:crypto.randomUUID(),deleteToken:'a'.repeat(64),kind,name:'访客',text:'一起做点有趣的事。',consent:'yes',...overrides}).forEach(([key,value])=>f.set(key,value));if(kind==='photo')f.set('photo',new Blob([jpeg],{type:'image/jpeg'}),'photo.jpg');return f;}
test('photo stays private until approval; owner can withdraw after approval',async t=>{
  const {request,objects}=fixture(t),body=form('photo'),id=body.get('id');
  let response=await request('entries',{method:'POST',body});assert.equal(response.status,201);assert.equal((await response.json()).status,'pending');assert.equal(objects.size,1);
  assert.equal((await request(`photos/${id}`)).status,404);assert.deepEqual((await(await request('entries')).json()).entries,[]);
  assert.equal((await request('admin/entries?status=pending')).status,401);
  assert.equal((await(await request('admin/entries?status=pending',{admin:true})).json()).entries.length,1);
  assert.equal((await request(`admin/photos/${id}`,{admin:true})).status,200);
  assert.equal((await request(`admin/entries/${id}`,{method:'PATCH',admin:true,body:{status:'approved'}})).status,200);
  assert.equal((await(await request('entries')).json()).entries[0].id,id);assert.equal((await request(`photos/${id}`)).status,200);
  assert.equal((await request(`entries/${id}`,{method:'DELETE',token:'wrong'})).status,401);
  assert.equal((await request(`entries/${id}`,{method:'DELETE',token:'a'.repeat(64)})).status,200);assert.equal(objects.size,0);assert.equal((await request(`photos/${id}`)).status,404);
});
test('same submission receipt is idempotent; rate cap and origin boundary enforced',async t=>{
  const {request,db}=fixture(t),body=form();assert.equal((await request('entries',{method:'POST',body})).status,201);
  assert.equal((await request('entries',{method:'POST',body})).status,200);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM entries').get().count,1);
  for(let i=0;i<4;i++)assert.equal((await request('entries',{method:'POST',body:form()})).status,201);
  assert.equal((await request('entries',{method:'POST',body:form()})).status,429);
  assert.equal((await request('entries',{method:'POST',body:form(),origin:'https://unrelated.test'})).status,403);
});
test('validates content, consent, image format, lengths and wish progress',async t=>{
  const {request}=fixture(t);
  for(const changes of [{text:''},{text:'x'.repeat(161)},{name:'x'.repeat(25)},{consent:'no'},{kind:'script'}])assert.equal((await request('entries',{method:'POST',body:form('message',changes)})).status,400);
  const invalid=form('photo');invalid.set('photo',new Blob(['<svg></svg>'],{type:'image/jpeg'}),'bad.jpg');assert.equal((await request('entries',{method:'POST',body:invalid})).status,400);
  const wish=form('wish'),id=wish.get('id');assert.equal((await request('entries',{method:'POST',body:wish})).status,201);
  assert.equal((await request(`admin/entries/${id}`,{method:'PATCH',admin:true,body:{status:'approved',wishState:'making'}})).status,200);
  assert.equal((await(await request('entries')).json()).entries[0].wishState,'making');
});
test('server strips camera metadata; old private entries expire, approved entries remain',async t=>{
  const {request,env,db,objects}=fixture(t);const sentinel=Buffer.from('Exif\0\0GPS-PRIVATE-LOCATION');const segment=Buffer.concat([Buffer.from([255,225,0,sentinel.length+2]),sentinel]);
  const cleaned=cleanJPEG(Buffer.concat([jpeg.subarray(0,2),segment,jpeg.subarray(2)]));assert.equal(Buffer.from(cleaned).includes(sentinel),false);
  const a=form('photo'),b=form('photo');await request('entries',{method:'POST',body:a});await request('entries',{method:'POST',body:b});await request(`admin/entries/${b.get('id')}`,{method:'PATCH',admin:true,body:{status:'approved'}});
  db.prepare('UPDATE entries SET created_at=?').run(Date.now()-31*86400000);await worker.scheduled({},env);
  assert.equal(db.prepare('SELECT count(*) AS n FROM entries').get().n,1);assert.equal(objects.size,1);assert.equal((await request(`photos/${b.get('id')}`)).status,200);
});
