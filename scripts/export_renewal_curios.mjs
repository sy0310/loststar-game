/** Reproducible production export. Never reads the approved concept boards. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const source='assets/source/visual-renewal/curios', runtime='assets/runtime/visual-renewal/curios';
await fs.mkdir(runtime,{recursive:true});
const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
const states=['found','clean','stabilized'];
const files={receipt:'receipt-three-states-v2.png',nested:'nested-three-states-v2.png'};
const records=[];
async function save(name,input,registration){
 const path=`${runtime}/${name}.png`;
 await sharp(input).png({compressionLevel:9}).toFile(path);
 await sharp(input).webp({quality:94,alphaQuality:100,effort:6}).toFile(`${runtime}/${name}.webp`);
 const b=await fs.readFile(path),m=await sharp(b).metadata();
 records.push({id:name,source:`${source}/${registration.sourceFile}`,runtime:path,webp:`${runtime}/${name}.webp`,width:m.width,height:m.height,sha256:crypto.createHash('sha256').update(b).digest('hex'),...registration});
}
for(const id of ids){
 const file=files[id]??`${id}-three-states.png`, path=`${source}/${file}`,m=await sharp(path).metadata();
 const side=m.height;
 if(m.width!==side*3)throw Error(`Not an equal-cell production atlas: ${file}`);
 for(const [i,state]of states.entries()){
  // Cells and native alpha are preserved; no recolouring, generated noise or repair overlay.
  const png=await sharp(path).extract({left:i*side,top:0,width:side,height:side}).resize(384,384,{kernel:'nearest'}).png().toBuffer();
  await save(`${id}-${state}`,png,{sourceFile:file,sourceCell:{x:i*side,y:0,width:side,height:side},pivot:{x:192,y:336},logicalSize:192,layer:'specimen',state,provenance:'Original built-in image_gen production sprite atlas, not a concept-board crop'});
 }
}
await sharp(`${source}/restoration-workbench.png`).resize(640,700,{fit:'fill',kernel:'nearest'}).webp({quality:93,effort:6}).toFile(`${runtime}/restoration-workbench.webp`);
// Measured tight boundaries from the authored 3x2 isolated tool atlas. Background alpha remains zero.
const tools={brush:{cell:[0,0],box:[158,32,234,447],contact:[276,467],pivot:[271,204]},tweezers:{cell:[1,0],box:[174,43,139,432],contact:[216,464],pivot:[266,122]},spatula:{cell:[2,0],box:[194,44,106,433],contact:[239,468],pivot:[241,170]},screwdriver:{cell:[0,1],box:[208,45,99,427],contact:[272,463],pivot:[269,151]},forearm:{cell:[1,1],box:[119,40,264,429],contact:[192,432],pivot:[315,109]},gripper:{cell:[2,1],box:[60,119,364,261],contact:[111,248],pivot:[367,250]}};
for(const [name,t]of Object.entries(tools)){
 const [left,top,width,height]=t.box;
 const png=await sharp(`${source}/tools-atlas-v2.png`).extract({left:t.cell[0]*512+left,top:t.cell[1]*512+top,width,height}).png().toBuffer();
 await save(`tool-${name}`,png,{sourceFile:'tools-atlas-v2.png',sourceRect:{left:t.cell[0]*512+left,top:t.cell[1]*512+top,width,height},contact:{x:t.contact[0]-left,y:t.contact[1]-top},pivot:{x:t.pivot[0]-left,y:t.pivot[1]-top},layer:'tool',provenance:'Original built-in image_gen isolated tool sprite; measured tip and grip'});
}
// Registered excavation rim halves are intentionally exported separately.
const trayMeta=await sharp(`${source}/excavation-tray-layers.png`).metadata(),traySide=trayMeta.width/2;
await save('excavation-rear',await sharp(`${source}/excavation-tray-layers.png`).extract({left:0,top:100,width:traySide,height:380}).resize(384,240,{kernel:'nearest'}).png().toBuffer(),{sourceFile:'excavation-tray-layers.png',pivot:{x:192,y:240},layer:'excavation-rear',provenance:'Original generated rear excavation sample rim, measured registration'});
await save('excavation-front',await sharp(`${source}/excavation-tray-layers.png`).extract({left:traySide,top:475,width:traySide,height:330}).resize(384,110,{kernel:'nearest'}).png().toBuffer(),{sourceFile:'excavation-tray-layers.png',pivot:{x:192,y:110},layer:'excavation-front',provenance:'Original generated front excavation sample rim, measured registration'});
const inner=await sharp(`${source}/receipt-inner-blank.png`).resize(180,226,{fit:'fill',kernel:'nearest'}).png().toBuffer();
const innerSheet=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:inner,left:48,top:18}]).png().toBuffer();
await save('receipt-inner-blank',innerSheet,{sourceFile:'receipt-inner-blank.png',pivot:{x:77,y:61},layer:'ability-paper',provenance:'Original blank inner fold, contains no invented records'});
const joints={receipt:[[0,137],[150,137],[150,192],[0,192]],tape:[[22,122],[33,108],[65,92],[85,92],[78,107],[57,126],[50,142],[23,142]],nested:[[30,85],[77,40],[166,57],[166,79],[132,113],[30,97]],stamp:[[43,0],[132,0],[142,119],[67,121]],'cosmic-parcel':[[22,39],[111,17],[174,41],[181,79],[68,105],[22,77]],bell:[[74,15],[119,15],[119,64],[74,64]]};
const layerSets=[];
for(const id of ids){
 const mask=Buffer.from(`<svg width="384" height="384"><polygon points="${joints[id].map(([x,y])=>`${x*2},${y*2}`).join(' ')}" fill="white"/></svg>`);
 const image=await fs.readFile(`${runtime}/${id}-stabilized.png`);
 for(const [part,blend]of [['joint','dest-in'],['body','dest-out']]){
  const path=`${runtime}/${id}-${part}.png`;
  await sharp(image).composite([{input:mask,blend}]).png({compressionLevel:9}).toFile(path);
  const b=await fs.readFile(path);layerSets.push({id:`${id}-${part}`,runtime:path,source:`${source}/${files[id]??`${id}-three-states.png`}`,sourceState:`${runtime}/${id}-stabilized.png`,width:384,height:384,logicalPolygon:joints[id],pivot:{x:192,y:336},sha256:crypto.createHash('sha256').update(b).digest('hex'),layer:part,provenance:'Deterministic alpha extraction from original production specimen state, not concept-board cropping'});
 }
}
await fs.writeFile(`${runtime}/registration.json`,JSON.stringify({schema:1,logicalSize:192,layers:layerSets,exportCommand:'node scripts/export_renewal_curios.mjs',assets:records},null,2)+'\n');
console.log(`${records.length} registered PNGs and WebPs exported (18 states + 6 tools).`);

await import("./export_renewal_curio_rig.mjs");

// User-approved modern single receipt supersedes its retired parchment rig only.
await import('./export_modern_receipt.mjs');

// Static-approved v042 tape/bell mechanisms replace only their six retired screenshot-cut states.
await import('./export_mechanisms_v042.mjs');
