import fs from 'node:fs';
const source=new URL('../../../static/maker-garage-preview/',import.meta.url),target=new URL('../public/',import.meta.url);
fs.mkdirSync(new URL('sponsor/',target),{recursive:true});fs.mkdirSync(new URL('community/',target),{recursive:true});
for(const file of ['sponsor-applications.js','sponsor-billboard.css'])fs.copyFileSync(new URL(file,source),new URL(file,target));
fs.copyFileSync(new URL('sponsors/index.html',source),new URL('sponsor/index.html',target));
fs.copyFileSync(new URL('community/config.json',source),new URL('community/config.json',target));
console.log('Public sponsor application assets synchronized; no secrets included.');
