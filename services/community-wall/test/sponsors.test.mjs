import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../src/worker.js';
import {sponsorSchedule} from '../src/sponsors.js';
function fixture(t){
 const db=new DatabaseSync(':memory:');for(const file of ['0001_wall.sql','0002_sponsors.sql'])db.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));t.after(()=>db.close());const objects=new Map();
 const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}},PHOTOS:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}},ADMIN_TOKEN:'admin',RATE_SALT:'salt',ALLOWED_ORIGINS:'https://site.test'};
 async function req(path,method='GET',body,admin=false){const headers={Origin:'https://site.test','CF-Connecting-IP':'test'};if(admin)headers.Authorization='Bearer admin';if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}return worker.fetch(new Request('https://api.test/api/'+path,{method,body,headers}),env);}
 const start=new Date(Date.now()+8*3600000).toISOString().slice(0,10),end=new Date(Date.now()+7*86400000+8*3600000).toISOString().slice(0,10);
 function form(changes={}){const f=new FormData();Object.entries({id:crypto.randomUUID(),receiptToken:'b'.repeat(64),tier:'core',page:'1',term:'month',brand:'TEST',website:'https://example.com',tagline:'Build',contact:'PRIVATE CONTACT',association:'PROJECT',contribution:'A dev board',start,end,consent:'yes',amountCents:'1',...changes}).forEach(([k,v])=>f.set(k,v));f.set('logo',new Blob([fs.readFileSync(new URL('../../../static/maker-garage-preview/community/family.jpg',import.meta.url))],{type:'image/jpeg'}),'logo.jpg');return f;}
 const review=(id,changes={})=>req('admin/sponsors/'+id,'PATCH',{version:1,status:'approved',paymentStatus:'manual_confirmed',start,end,note:'',...changes},true);
 return {db,objects,req,form,review,start,end};
}
test('server quotes exact page price; no client payment or status can publish; receipts private',async t=>{
 const {req,form,review}=fixture(t),f=form({page:'2',term:'year',status:'approved',paymentStatus:'manual_confirmed'}),id=f.get('id');
 let r=await req('sponsors/applications','POST',f);assert.equal(r.status,201);assert.equal((await r.json()).amountCents,80000);
 assert.equal((await req('sponsors/applications','POST',f)).status,200);
 assert.equal((await req('sponsors/logos/'+id)).status,404);assert.equal((await req('admin/sponsors')).status,401);
 assert.equal((await review(id,{paymentStatus:'pending'})).status,400);
 assert.equal((await review(id)).status,200);
 const publicData=await (await req('sponsors')).json();assert.equal(publicData.sponsors.length,1);assert(!JSON.stringify(publicData).includes('PRIVATE CONTACT'));assert(!JSON.stringify(publicData).includes('receipt_hash'));
 assert.equal((await req('sponsors/logos/'+id)).status,200);
 assert.equal((await (await req('sponsors/receipts','POST',[{id,token:'c'.repeat(64)}])).json()).applications.length,0);
 assert.equal((await (await req('sponsors/receipts','POST',[{id,token:'b'.repeat(64)}])).json()).applications[0].status,'approved');
});
test('approved reservations reject overlap, stale edits; pause and expiration remove logo and ad',async t=>{
 const {db,req,form,review}=fixture(t),a=form(),b=form();await req('sponsors/applications','POST',a);await req('sponsors/applications','POST',b);
 assert.equal((await review(a.get('id'))).status,200);const conflict=await review(b.get('id'));assert.equal(conflict.status,409);assert.equal((await conflict.json()).error,'slot_conflict');
 assert.equal((await review(a.get('id'))).status,409);
 assert.equal((await review(a.get('id'),{version:2,status:'paused'})).status,200);assert.equal((await req('sponsors/logos/'+a.get('id'))).status,404);
 assert.equal((await review(b.get('id'))).status,200);db.prepare('UPDATE sponsor_applications SET end_at=? WHERE id=?').run(Date.now()-1,b.get('id'));
 assert.equal((await (await req('sponsors')).json()).sponsors.length,0);assert.equal((await req('sponsors/logos/'+b.get('id'))).status,404);
});
test('hardware and community need project/event resources and in-kind confirmation',async t=>{
 const {req,form,review}=fixture(t);
 for(const [tier,term] of [['hardware','project'],['community','event']]){
  assert.equal((await req('sponsors/applications','POST',form({tier,term,association:''}))).status,400);
  const f=form({tier,term});const response=await req('sponsors/applications','POST',f);assert.equal(response.status,201);assert.equal((await response.json()).amountCents,0);
  assert.equal((await review(f.get('id'))).status,409);assert.equal((await review(f.get('id'),{paymentStatus:'in_kind_confirmed'})).status,200);
 }
 assert.equal((await (await req('sponsors')).json()).sponsors.length,2);
});
test('calendar schedules clamp month-end, use exclusive Beijing midnight, validate ranges',()=>{
 assert.equal(new Date(sponsorSchedule('2027-01-31','month').endAt).toISOString(),'2027-02-27T16:00:00.000Z');
 assert.equal(new Date(sponsorSchedule('2028-02-29','year').endAt).toISOString(),'2029-02-27T16:00:00.000Z');
 assert.equal(sponsorSchedule('2027-03-01','event','2027-03-01').endAt-sponsorSchedule('2027-03-01','event','2027-03-01').startAt,86400000);
 assert.throws(()=>sponsorSchedule('2027-02-30','month'));assert.throws(()=>sponsorSchedule('2027-03-02','event','2027-03-01'));
});
