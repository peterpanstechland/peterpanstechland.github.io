import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadingPhases,runLoadingPhase,optimizedModel,initialLoadingProgress,loadAssetManifests,essentialAssetsReady} from '../static/maker-garage-preview/loading-plan.js';
const config=JSON.parse(await fs.readFile('static/maker-garage-preview/assets.json','utf8'));
const manifest=JSON.parse(await fs.readFile('static/maker-garage-preview/optimized-assets.json','utf8'));
const entries=config.assets.map(config=>({config}));
assert.equal(essentialAssetsReady([]),false);
assert.equal(essentialAssetsReady(entries.map(entry=>({...entry,state:'ready'}))),true);
assert.equal(essentialAssetsReady(entries.map(entry=>({...entry,state:entry.config.id==='01_garage_shell'?'error':'ready'}))),false,'A missing exterior must produce an explicit failure, not wait for readiness forever');
const requested=[];
const manifests=await loadAssetManifests(async(url,options)=>{
  requested.push(url);
  assert.ok(options.signal instanceof AbortSignal);
  return {ok:true,json:async()=>url==='./assets.json'?config:manifest};
});
assert.deepEqual(manifests,[config,manifest]);
assert.deepEqual(requested,['./assets.json','./optimized-assets.json']);
const slowManifests=await loadAssetManifests(async url=>{
  if(url==='./optimized-assets.json')await new Promise(resolve=>setTimeout(resolve,5500));
  return {ok:true,json:async()=>url==='./assets.json'?config:manifest};
});
assert.equal(slowManifests[1],manifest,'A manifest taking over five seconds must still select optimized previews');
await assert.rejects(loadAssetManifests(async url=>({ok:url!=='./optimized-assets.json',status:503,json:async()=>config})),/optimized-assets.json.*503/,'An unavailable optimization manifest must not silently fall back to raw models');
await assert.rejects(loadAssetManifests((_url,{signal})=>new Promise((_,reject)=>{
  signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
}),10),{name:'AbortError'},'Unresponsive manifests must stop at the deadline');
const phases=loadingPhases(entries);
assert.equal(phases[0].length,7);
assert.deepEqual(initialLoadingProgress([]),{completed:0,total:0});
assert.deepEqual(initialLoadingProgress(entries),{completed:0,total:7});
const states=entries.map(entry=>({...entry,state:entry.config.id==='04_lucky_cat'?'ready':'pending'}));
assert.deepEqual(initialLoadingProgress(states),{completed:1,total:7});
for(const entry of states)if(!phases[0].some(hero=>hero.config.id===entry.config.id))entry.state='ready';
assert.deepEqual(initialLoadingProgress(states),{completed:1,total:7},'Background equipment must not inflate initial progress');
assert.ok(phases[0].some(e=>e.config.id==='04_lucky_cat'));
const all=phases.flat();assert.equal(new Set(all).size,21);assert.equal(all.length,21);
assert.ok(phases[2].some(e=>e.config.id==='23_workbench'));
assert.ok(phases[2].some(e=>e.config.id==='14_bambu_x1c'));
assert.ok(loadingPhases(entries,'interior')[1].some(e=>e.config.id==='23_workbench'));
let active=0,peak=0,finished=0;
await runLoadingPhase(phases[0],async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,3));active--;finished++;});
assert.equal(peak,3);assert.equal(finished,7);
for(const tier of ['desktop','mobile'])for(const {config} of all){
  const download=optimizedModel(config,manifest,tier);
  assert.ok(download.file.startsWith('models/optimized/'+tier+'/'));
  await fs.access('static/maker-garage-preview/'+download.file);
}
const sample=all[0].config;
assert.equal(optimizedModel(sample,null,'desktop').file,sample.file);
assert.equal(optimizedModel(sample,{assets:{[sample.file]:{desktop:{file:'models/optimized/../../outside.glb'}}}},'desktop').file,sample.file);
const budgets={};
for(const tier of ['desktop','mobile'])budgets[tier]={heroBytes:phases[0].reduce((n,e)=>n+manifest.assets[e.config.file][tier].bytes,0),allBytes:all.reduce((n,e)=>n+manifest.assets[e.config.file][tier].bytes,0)};
console.log(JSON.stringify({heroModels:7,totalModels:21,parallelDecoders:peak,pathsValidated:true,budgets}));
