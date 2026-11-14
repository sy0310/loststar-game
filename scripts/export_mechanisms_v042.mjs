/** Production six-state export uses the same pure commands and small ribbon raster as Canvas. */
import fs from 'node:fs/promises';import sharp from 'sharp';import crypto from 'node:crypto';import {build} from 'vite';import {pathToFileURL} from 'node:url';
const out='assets/runtime/visual-renewal/mechanisms-v042',curios='assets/runtime/visual-renewal/curios',review='artifacts/mechanisms-v042-static';
const registry=JSON.parse(await fs.readFile(`${out}/static-registration.json`,'utf8')),entries=new Map(registry.assets.map(e=>[e.id,e]));
// Source PNGs stay full resolution. Shipped decoded sprites are capped at 384px; all placements use authored coordinates.
for(const file of await fs.readdir(out))if(file.endsWith('.png')){
 const png=await fs.readFile(`${out}/${file}`);await sharp(png).resize({width:384,height:384,fit:'inside',withoutEnlargement:true,kernel:'nearest'}).webp({lossless:true,effort:4}).toFile(`${out}/${file.replace('.png','.webp')}`);
}
await build({configFile:false,logLevel:'silent',build:{ssr:'src/fusion/curio-mechanism-model.ts',outDir:'releases/mechanisms-v042-model',emptyOutDir:true,minify:false,rollupOptions:{output:{entryFileNames:'model.js'}}}});
const model=await import(pathToFileURL(process.cwd()+'/releases/mechanisms-v042-model/model.js'));
const sprite=async key=>sharp(await fs.readFile(`${out}/${key}.webp`)).png().toBuffer();
const texture=async key=>{const {data,info}=await sharp(await sprite(key)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};};
const face=await texture('tape-band-face'),back=await texture('tape-band-back'),tip=await texture('tape-band-tip'),assets=new Map();
for(const key of entries.keys())assets.set(key,await sprite(key));
const image=(b,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" style="image-rendering:pixelated">${s}</svg>`);
const states=[];
for(const id of ['tape','bell'])for(const condition of ['found','clean','stabilized']){
 const state={condition},progress=model.mechanismStateProgress(state,0),frame=model.mechanismFrame(id,{corrections:progress.corrections,reducedMotion:true});
 let bandBytes;
 if(id==='tape'){const r=model.mechanismRibbonRegion,data=new Uint8ClampedArray(r.width*r.height*4);model.rasterMechanismRibbon(frame,face,back,tip,data);bandBytes=await sharp(Buffer.from(data.buffer),{raw:{width:r.width,height:r.height,channels:4}}).png().toBuffer();}
 let body='';for(const [i,c]of model.mechanismDrawCommands(frame).entries()){
  let part;if(c.key==='ribbon'){const r=model.mechanismRibbonRegion;part=image(bandBytes,r.x,r.y,r.width,r.height);}else{const e=entries.get(c.key);part=c.raw?`<g transform="matrix(${e.matrix.join(' ')})">${image(assets.get(c.key),0,0,e.width,e.height)}</g>`:image(assets.get(c.key),e.rect[0],e.rect[1]+(c.dy??0),e.rect[2],e.rect[3]);}
  if(c.matrix)part=`<g transform="matrix(${c.matrix.join(' ')})">${part}</g>`;
  if(c.clip||c.polygon){const clip=c.clip?`<rect x="${c.clip[0]}" y="${c.clip[1]}" width="${c.clip[2]}" height="${c.clip[3]}"/>`:`<polygon points="${c.polygon.map(p=>`${p.x},${p.y}`).join(' ')}"/>`;part=`<defs><clipPath id="m${i}">${clip}</clipPath></defs><g clip-path="url(#m${i})">${part}</g>`;}
  body+=part;
 }
 let result=await sharp(svg(body)).png().toBuffer();
 if(condition==='found'){
  let mask;if(id==='bell'){const e=entries.get('bell-shell');mask=await sharp(svg(image(assets.get('bell-shell'),...e.rect))).png().toBuffer();}else{const r=model.mechanismRibbonRegion;mask=await sharp(svg(image(bandBytes,r.x,r.y,r.width,r.height))).png().toBuffer();}
  const deposit=await sharp(await sprite(`${id}-deposits`)).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();result=await sharp(result).composite([{input:deposit}]).png().toBuffer();
 }
 await fs.writeFile(`${curios}/${id}-${condition}.png`,result);await sharp(result).webp({lossless:true,effort:4}).toFile(`${curios}/${id}-${condition}.webp`);
 states.push({id:`${id}-${condition}`,source:'assets/source/visual-renewal/mechanisms-v042',runtime:`${curios}/${id}-${condition}.png`,webp:`${curios}/${id}-${condition}.webp`,width:384,height:384,logicalSize:192,state:condition,layer:'canonical physical mechanism state',motionSource:'src/fusion/curio-mechanism-model.ts',composition:'Identical pure mechanismDrawCommands + rasterMechanismRibbon as room/workbench/abilities; no screenshot-cut bridge or paper props',sha256:crypto.createHash('sha256').update(result).digest('hex')});
}
for(const filename of ['registration.json','rig-registration.json']){
 const old=JSON.parse(await fs.readFile(`${curios}/${filename}`,'utf8')),ids=new Set(states.map(x=>x.id));old.mechanisms='../mechanisms-v042/registration.json';old.assets=old.assets.filter(a=>!ids.has(a.id)).map(a=>a.id.startsWith('tape-rig-')||a.id.startsWith('bell-rig-')?{...a,retiredFromPlayer:true}:a).concat(states);await fs.writeFile(`${curios}/${filename}`,JSON.stringify(old,null,2)+'\n');
}
const registered=[];for(const filename of await fs.readdir(out))if(filename.endsWith('.webp')){const p=`${out}/${filename}`,m=await sharp(p).metadata();registered.push({id:filename.replace('.webp',''),path:p,width:m.width,height:m.height,bytes:(await fs.stat(p)).size,sha256:crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex')});}
await fs.writeFile(`${out}/registration.json`,JSON.stringify({...registry,status:'runtime candidate, static approved; continuous motion requires root and phone audit',motionSource:'src/fusion/curio-mechanism-model.ts',renderer:'src/fusion/curio-mechanism-renderer.ts',exportCommand:'node scripts/export_mechanisms_v042_static.mjs && node scripts/export_mechanisms_v042_contacts.mjs && node scripts/export_mechanism_deposits_v042.mjs && node scripts/export_mechanisms_v042.mjs',states,shippedAssets:registered},null,2)+'\n');
console.log(`Same-model tape/bell six PNG states exported. ${registered.reduce((n,r)=>n+r.bytes,0)} mechanism WebP bytes, all decoded edges ≤384.`);
