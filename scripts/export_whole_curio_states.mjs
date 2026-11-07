/** Complete authored images only; an explicitly registered production master is byte-copied. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import crypto from 'node:crypto';
const source='assets/source/visual-renewal/whole-states-v043';
const output='assets/runtime/visual-renewal/whole-states-v043';
const stages=['found','clean','stabilized'];
// Existing192px specimen envelope/sole is preserved so owned cases and hands stay registered.
const bounds={receipt:[39,12,151,164],tape:[16,12,164,163],nested:[30,32.5,174.5,172],stamp:[43,4,173,183],'cosmic-parcel':[17,20,177,174],bell:[28,30.5,168,168.5]};
const registeredWholeStateMasters={
 'tape-clean':{
  path:'assets/source/visual-renewal/whole-states-v043/tape/tape-clean-master384.png',
  sha256:'78507b7d016f4fe79effcd08718a532ed6e75144b828da14c9b67f81978164a4',
  originCommit:'ff917872227b0f28a452dee1642d9cc8606251db',
  originRuntimePath:'assets/runtime/visual-renewal/whole-states-v043/tape-clean.png',
  originBlobSha1:'514e4da1a31184e641abf9736936015a4307d852',
  originalSourceSha256:'6dfe2ecf80888259f5b8b8f84afd5eda37359bda469f4f86855ae51dbfebea2b',
  originalSourceDimensions:{width:1254,height:1254},
  originalExport:{sourceExteriorCrop:{left:109,top:86,width:982,height:992},wholeImageSize:{width:296,height:299},wholeImagePlacement:{left:32,top:27}},
  provenance:'assets/source/visual-renewal/whole-states-v043/tape/provenance.json',
  reason:'Byte-identical isolated V0.4.3 production master preserves the established B image across libvips platforms. The unchanged 1254px authoring original and its source/crop/support mapping remain registered. This is existing production output, not a new drawing, screenshot or user acceptance.'
 }
};
export {registeredWholeStateMasters};
const sha256=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const gitBlobSha1=raw=>crypto.createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/** Pure single-asset export: tests can inject files and inspect bytes without changing runtime files. */
export async function exportWholeCurioState({id,state,raw,readFile=name=>fs.readFile(name)}){
 const b=bounds[id];if(!b||!stages.includes(state))throw Error(`Unknown whole state ${id}/${state}`);
 const name=`${id}-${state}`,sourcePath=`${source}/${id}/${name}.png`;
 raw??=await readFile(sourcePath);
 const metadata=await sharp(raw).metadata();
 if(metadata.format!=='png'||!metadata.hasAlpha)throw Error(`${sourcePath}: real PNG alpha required`);
 const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0,count=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);count++;}
 if(!count||count/info.width/info.height>.9)throw Error(`${sourcePath}: not an isolated complete transparent object`);
 const trim={left,top,width:right-left,height:bottom-top},master=registeredWholeStateMasters[name];
 const canonicalReuse=state==='stabilized'&&metadata.width===384&&metadata.height===384;
 let png,size,position;
 if(master){
  if(canonicalReuse||sha256(raw)!==master.originalSourceSha256||!equal({width:metadata.width,height:metadata.height},master.originalSourceDimensions)||!equal(trim,master.originalExport.sourceExteriorCrop))throw Error(`${name}: original authoring source or mapping differs from registered production master`);
  const masterRaw=await readFile(master.path),masterMetadata=await sharp(masterRaw).metadata();
  if(sha256(masterRaw)!==master.sha256||gitBlobSha1(masterRaw)!==master.originBlobSha1||masterMetadata.format!=='png'||masterMetadata.width!==384||masterMetadata.height!==384||!masterMetadata.hasAlpha)throw Error(`${name}: registered production master bytes/dimensions/alpha differ`);
  const alpha=await sharp(masterRaw).ensureAlpha().raw().toBuffer();let hasTransparent=false,hasVisible=false;
  for(let i=3;i<alpha.length;i+=4){hasTransparent||=alpha[i]===0;hasVisible||=alpha[i]>8;}
  if(!hasTransparent||!hasVisible)throw Error(`${name}: production master must be an isolated visible transparent object`);
  // No resize, composite, crop or re-encode: the whole production PNG is the source of these pixels.
  png=masterRaw;size=master.originalExport.wholeImageSize;position=master.originalExport.wholeImagePlacement;
 }else if(canonicalReuse){png=raw;size={width:384,height:384};position={left:0,top:0};}
 else{
  const fit={width:Math.round((b[2]-b[0])*2),height:Math.round((b[3]-b[1])*2)};
  const object=await sharp(raw).extract(trim).resize({...fit,fit:'inside',kernel:'nearest'}).png().toBuffer(),metadata=await sharp(object).metadata();
  size={width:metadata.width,height:metadata.height};position={left:Math.round((b[0]+b[2])-size.width/2),top:Math.round(b[3]*2-size.height)};
  png=await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite([{input:object,...position}]).png({compressionLevel:9}).toBuffer();
 }
 const webp=await sharp(png).webp({lossless:true,effort:5}).toBuffer();
 const entry={id:name,curio:id,state,source:sourcePath,sourceSha256:sha256(raw),canonicalReuse,sourceExteriorCrop:canonicalReuse?null:trim,wholeImagePlacement:position,wholeImageSize:size,runtime:`${output}/${name}.png`,webp:`${output}/${name}.webp`,width:384,height:384,logicalSize:192,sha256:sha256(png),...(master?{registeredMaster:structuredClone(master)}:{}),composition:master?'One complete registered isolated production PNG, copied byte-identically. Original generated source and V0.4.3 crop/support mapping retained; no new drawing, screenshot, internal parts, masks, dirt overlays or pixel warp.':'One entire authored image; exterior trim + uniform scale + placement only. No internal parts, masks, dirt overlays or pixel warp.'};
 return{entry,png,webp};
}

async function main(){
 const prepared=[];
 for(const id of Object.keys(bounds))for(const state of stages){
  prepared.push(await exportWholeCurioState({id,state}));
 }
 // Resolve and validate every input before replacing any runtime file.
 await fs.mkdir(output,{recursive:true});const assets=[];
 for(const result of prepared){
  await fs.writeFile(result.entry.runtime,result.png);await fs.writeFile(result.entry.webp,result.webp);assets.push(result.entry);
 }
 await fs.writeFile(`${output}/registration.json`,JSON.stringify({schema:1,version:'0.4.4',schemaFamily:'complete-images-v043',renderer:'src/fusion/curio-state-images.ts',stateSource:'Saved found/clean/stabilized only; in-flight progress cannot select the next image',exportCommand:'node scripts/export_whole_curio_states.mjs',assets},null,2)+'\n');
 console.log('18 complete state PNG/WebP images exported without internal composition; registered production masters retain their exact PNG bytes.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
