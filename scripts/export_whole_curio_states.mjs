/** Complete images only: trim transparent exterior, scale uniformly and register; never cut interior parts. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
const source='assets/source/visual-renewal/whole-states-v043';
const output='assets/runtime/visual-renewal/whole-states-v043';
const stages=['found','clean','stabilized'];
// Existing192px specimen envelope/sole is preserved so owned cases and hands stay registered.
const bounds={receipt:[39,12,151,164],tape:[16,12,164,163],nested:[30,32.5,174.5,172],stamp:[43,4,173,183],'cosmic-parcel':[17,20,177,174],bell:[28,30.5,168,168.5]};
const inputs=new Map(await Promise.all(Object.keys(bounds).flatMap(id=>stages.map(async state=>{const name=`${id}-${state}`;return[name,await fs.readFile(`${source}/${id}/${name}.png`)];}))));
await fs.mkdir(output,{recursive:true});const assets=[];
for(const [id,b]of Object.entries(bounds))for(const state of stages){
 const name=`${id}-${state}`,path=`${source}/${id}/${name}.png`,raw=inputs.get(name),metadata=await sharp(raw).metadata();
 if(!metadata.hasAlpha)throw Error(`${path}: real alpha required`);
 const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0,count=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);count++;}
 if(!count||count/info.width/info.height>.9)throw Error(`${path}: not an isolated complete transparent object`);
 const fit={width:Math.round((b[2]-b[0])*2),height:Math.round((b[3]-b[1])*2)},trim={left,top,width:right-left,height:bottom-top};
 const object=await sharp(raw).extract(trim).resize({...fit,fit:'inside',kernel:'nearest'}).png().toBuffer(),size=await sharp(object).metadata();
 const position={left:Math.round((b[0]+b[2])-size.width/2),top:Math.round(b[3]*2-size.height)};
 const canonicalReuse=state==='stabilized'&&metadata.width===384&&metadata.height===384;
 const png=canonicalReuse?raw:await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite([{input:object,...position}]).png({compressionLevel:9}).toBuffer();
 await fs.writeFile(`${output}/${name}.png`,png);await sharp(png).webp({lossless:true,effort:5}).toFile(`${output}/${name}.webp`);
 assets.push({id:name,curio:id,state,source:path,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),canonicalReuse,sourceExteriorCrop:canonicalReuse?null:trim,wholeImagePlacement:canonicalReuse?{left:0,top:0}:position,wholeImageSize:canonicalReuse?{width:384,height:384}:{width:size.width,height:size.height},runtime:`${output}/${name}.png`,webp:`${output}/${name}.webp`,width:384,height:384,logicalSize:192,sha256:crypto.createHash('sha256').update(png).digest('hex'),composition:'One entire authored image; exterior trim + uniform scale + placement only. No internal parts, masks, dirt overlays or pixel warp.'});
}
await fs.writeFile(`${output}/registration.json`,JSON.stringify({schema:1,version:'0.4.3',renderer:'src/fusion/curio-state-images.ts',stateSource:'Saved found/clean/stabilized only; in-flight progress cannot select the next image',exportCommand:'node scripts/export_whole_curio_states.mjs',assets},null,2)+'\n');
console.log('18 complete state PNG/WebP images exported without internal composition.');
