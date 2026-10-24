// Present a grounded, branded exterior before downloading the workshop tools.
const hero=['13_street_base','01_garage_shell','02_roller_shutter','03_profile_sign','04_lucky_cat','05_project_vending','08_street_lamp'];
const essential=['13_street_base','01_garage_shell'];
export function essentialAssetsReady(entries) {
  const all=[...entries];
  return essential.every(id=>all.some(entry=>entry.config.id===id&&entry.state==='ready'));
}
export async function loadAssetManifests(fetcher=fetch,timeoutMs=20000) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    // Both small manifests are required. A slow connection must never silently
    // switch the visitor from optimized previews to the much larger originals.
    return await Promise.all(['./assets.json','./optimized-assets.json'].map(async url=>{
      const response=await fetcher(url,{signal:controller.signal});
      if(!response.ok)throw new Error(`Asset manifest unavailable: ${url} (${response.status})`);
      return response.json();
    }));
  } finally {clearTimeout(timeout);controller.abort();}
}
export function initialLoadingProgress(entries) {
  const initial=[...entries].filter(entry=>entry.config.file&&hero.includes(entry.config.id));
  return {completed:initial.filter(entry=>entry.state==='ready').length,total:initial.length};
}
export function loadingPhases(entries,view='overview') {
  const available=[...entries].filter(entry=>entry.config.file);
  const first=hero.map(id=>available.find(entry=>entry.config.id===id)).filter(Boolean);
  const rest=available.filter(entry=>!first.includes(entry));
  const outside=rest.filter(entry=>!entry.config.supportAsset&&!entry.config.tabletop&&!entry.config.levelFeet);
  const inside=rest.filter(entry=>!outside.includes(entry));
  return view==='interior'?[first,inside,outside]:[first,outside,inside];
}
export async function runLoadingPhase(entries,load,concurrency=3) {
  const queue=[...entries];
  await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{
    while(queue.length)await load(queue.shift());
  }));
}
export function optimizedModel(config,manifest,tier) {
  const record=manifest?.assets?.[config.file]?.[tier];
  if(!record?.file||!/^models\/optimized\/[a-zA-Z0-9_./-]+\.glb$/.test(record.file)||record.file.split('/').includes('..'))return {file:config.file,revision:config.modelRevision};
  return {file:record.file,revision:record.sha256||record.revision};
}
