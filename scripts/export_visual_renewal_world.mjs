/** Reproducible production export from ORIGINAL generated transparent game layers.
 * No concept board crops and no save/economy writes. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const source='assets/source/visual-renewal/world', runtime='assets/runtime/visual-renewal/world';
await fs.mkdir(runtime,{recursive:true});
const registrations=[];
async function cleaned(file,box){
 const input=sharp(`${source}/${file}`).ensureAlpha();const meta=await input.metadata();
 let {data,info}=await input.extract(box??{left:0,top:0,width:meta.width,height:meta.height}).raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<data.length;i+=4){if(data[i]<128)data[i]=0;else data[i]=255;}
 return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).trim({background:'#00000000',threshold:1}).png().toBuffer();
}
async function save(name,image,info={}){
 const buffer=await image.png().toBuffer();const meta=await sharp(buffer).metadata();
 await fs.writeFile(`${runtime}/${name}.png`,buffer);await sharp(buffer).webp({lossless:true,effort:6}).toFile(`${runtime}/${name}.webp`);
 registrations.push({id:name,source:`${source}/${info.source??'see-prompts.json'}`,runtime:`${runtime}/${name}.webp`,width:meta.width,height:meta.height,pivot:info.pivot??{x:meta.width/2,y:meta.height},layers:info.layers??[name],...info,source:`${source}/${info.source??'see-prompts.json'}`,sourceSha256:info.source?crypto.createHash('sha256').update(await fs.readFile(`${source}/${info.source}`)).digest('hex'):undefined,sha256:crypto.createHash('sha256').update(await fs.readFile(`${runtime}/${name}.webp`)).digest('hex')});
 return buffer;
}
const globe=await cleaned('globe-original.png');
await save('globe',sharp(globe).resize(752,752,{fit:'contain',kernel:'nearest',background:'#00000000'}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'}),{source:'globe-original.png',pivot:{x:384,y:384},world:{x:52,y:70,width:664,height:664},layers:['closed-sphere-terrain-and-lower-shell']});
// Preserve the original 256x235 registration; alpha layers share this exact canvas.
const station=await cleaned('station-original.png');
const stationBuffer=await sharp(station).resize(256,235,{fit:'fill',kernel:'nearest'}).png().toBuffer();
await save('station',sharp(stationBuffer),{source:'station-original.png',pivot:{x:128,y:235},world:{x:315,y:417,width:170,height:156},opening:[{x:52,y:135},{x:115,y:136},{x:115,y:211},{x:52,y:209}],windowPolygons:[[[166,119],[184,111],[184,133],[166,142]],[[197,105],[215,97],[215,120],[197,128]],[[226,91],[241,84],[241,107],[226,114]]]});
const fog=sharp(`${source}/fog-original.png`);const fogMeta=await fog.metadata();
for(let index=0;index<3;index++){
 const top=Math.floor(fogMeta.height*index/3),height=Math.floor(fogMeta.height*(index+1)/3)-top;
 const part=await cleaned('fog-original.png',{left:0,top,width:fogMeta.width,height});
 const layer=await sharp(part).resize(248,118,{fit:'inside',kernel:'nearest'}).png().toBuffer();const m=await sharp(layer).metadata();
 await save(['fog-back','fog-body','fog-rim'][index],sharp({create:{width:256,height:192,channels:4,background:'#00000000'}}).composite([{input:layer,left:Math.floor((256-m.width)/2),top:168-m.height}]),{source:'fog-original.png',pivot:{x:128,y:170},layer:index});
}
// Individual robot parts are cropped only from a dedicated six-part transparent source,
// not a reference poster; they are registered in an original compatible 160px pose cell.
const robotFile='robot-parts-cleaned.png';const parts={};
const partNames=['head','torso','scanner-hand','grip-hand','leg-left','leg-right'];
for(let index=0;index<6;index++){
 const part=await cleaned(robotFile,{left:index%3*512,top:Math.floor(index/3)*512,width:512,height:512});parts[partNames[index]]=part;
 await save(`robot-${partNames[index]}`,sharp(part),{source:robotFile,layer:partNames[index]});
}
const sized=async(name,width,height)=>sharp(parts[name]).resize(width,height,{fit:'fill',kernel:'nearest'}).png().toBuffer();
async function robotFrame(frame){
 const composites=[];const push=async(name,x,y,w,h)=>composites.push({input:await sized(name,w,h),left:x,top:y});
 const step=frame<4?[-2,0,2,0][frame]:0;
 await push('leg-left',49,119+step,26,38-step);await push('leg-right',84,119-step,26,38+step);
 await push('torso',48,73,64,50);await push('head',35,14,86,65);
 if(frame===5){await push('grip-hand',25,116,30,26);await push('grip-hand',87,116,30,26);}
 else if(frame===6){await push('grip-hand',32,91,30,26);await push('grip-hand',58,97,30,26);}
 else if(frame===7){await push('grip-hand',17,86,30,26);await push('grip-hand',42,93,30,26);}
 else {await push('scanner-hand',17,74,49,38);await push('grip-hand',98,90,35,31);}
 return sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite(composites).png().toBuffer();
}
const frames=await Promise.all(Array.from({length:8},(_,i)=>robotFrame(i)));
await save('robot-atlas',sharp({create:{width:640,height:320,channels:4,background:'#00000000'}}).composite(frames.map((input,index)=>({input,left:index%4*160,top:Math.floor(index/4)*160}))),{source:robotFile,pivot:{x:86.4,y:155.2},frame:{width:160,height:160,columns:4,rows:2},feet:{x:80,y:155},scanner:{x:23,y:83},hands:{pickup:[{x:40,y:129},{x:102,y:129}],carry:[{x:47,y:104},{x:73,y:110}],unload:[{x:32,y:99},{x:57,y:106}]}});
// Directional hulls retain one nozzle and one nose registration per view.
const shipFile='ship-original.png';const shipMeta=await sharp(`${source}/${shipFile}`).metadata();const shipFrames=[];const shipRegistrations=[];
for(let index=0;index<4;index++){
 const col=index%2,row=Math.floor(index/2),left=Math.floor(col*shipMeta.width/2),top=Math.floor(row*shipMeta.height/2);
 const width=Math.floor((col+1)*shipMeta.width/2)-left,height=Math.floor((row+1)*shipMeta.height/2)-top;
 const cut=await cleaned(shipFile,{left,top,width,height});const resized=await sharp(cut).resize(236,220,{fit:'inside',kernel:'nearest'}).png().toBuffer();const meta=await sharp(resized).metadata();
 const x=Math.floor((256-meta.width)/2),y=Math.floor((256-meta.height)/2);
 shipFrames.push(await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input:resized,left:x,top:y}]).png().toBuffer());
 shipRegistrations.push({...([{anchor:{x:12,y:139},nose:{x:244,y:137},light:{x:154,y:177}},{anchor:{x:128,y:60},nose:{x:128,y:232},light:{x:128,y:185}},{anchor:{x:244,y:139},nose:{x:12,y:137},light:{x:106,y:177}},{anchor:{x:128,y:225},nose:{x:128,y:25},light:{x:128,y:124}}][index]),cell:index,frame:{x:index%2*256,y:Math.floor(index/2)*256,width:256,height:256},bounds:{x,y,width:meta.width,height:meta.height}});
}
await save('ship-atlas',sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite(shipFrames.map((input,index)=>({input,left:index%2*256,top:Math.floor(index/2)*256}))),{source:shipFile,pivot:{x:128,y:128},frame:{width:256,height:256,columns:2,rows:2},views:shipRegistrations});
const mast=await cleaned('security-mast-original.png');
await save('security-mast',sharp(mast).resize(72,228,{fit:'inside',kernel:'nearest'}),{source:'security-mast-original.png',anchorWorld:{x:568,y:294},emitterWorld:{x:559,y:208}});
const sorter=await cleaned('sorter-original.png');
await save('sorter-complete',sharp(sorter).resize(296,286,{fit:'fill',kernel:'nearest'}).extend({left:12,right:12,top:17,bottom:17,background:'#00000000'}),{source:'sorter-original.png',pivot:{x:116,y:279},world:{x:410,y:315,width:148},layers:['rear-shell','moving-rollers','curtains','front-lip']});
// Separate machine parts inherit one native canvas and a registered conveyor plane.
const complete=await fs.readFile(`${runtime}/sorter-complete.png`);
const polygon=(points,w=320,h=320)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const rollerPoints=[[27,255],[95,215],[149,227],[90,274]];
const flapPoints=[[[78,142],[102,148],[96,190],[76,185]],[[103,149],[126,155],[119,198],[98,191]],[[128,156],[150,162],[143,204],[121,198]]];
const frontPoints=[[14,250],[99,270],[162,231],[165,250],[105,293],[27,282],[14,273]];
let shell=sharp(complete).composite([{input:polygon(rollerPoints),blend:'dest-out'},{input:polygon(frontPoints),blend:'dest-out'},...flapPoints.map(points=>({input:polygon(points),blend:'dest-out'}))]);
await save('sorter-back',shell,{source:'sorter-original.png',pivot:{x:116,y:279}});
await save('sorter-front',sharp(complete).composite([{input:polygon(frontPoints),blend:'dest-in'}]),{source:'sorter-original.png',pivot:{x:116,y:279}});
for(let index=0;index<3;index++)await save(`sorter-curtain-${index}`,sharp(complete).composite([{input:polygon(flapPoints[index]),blend:'dest-in'}]),{source:'sorter-original.png',pivot:[{x:90,y:145},{x:113,y:151},{x:139,y:158}][index]});
const rollerStrip=await sharp(complete).extract({left:69,top:241,width:36,height:7}).resize(128,10,{kernel:'nearest'}).png().toBuffer();
await save('sorter-rollers',sharp({create:{width:128,height:96,channels:4,background:'#382340'}}).composite(Array.from({length:8},(_,i)=>({input:rollerStrip,left:0,top:i*12}))),{source:'sorter-original.png',pivot:{x:0,y:0},plane:rollerPoints});
const jam=await cleaned('paper-jam-original.png');await save('sorter-paper-jam',sharp(jam).resize(224,112,{fit:'contain',kernel:'nearest',background:'#00000000'}),{source:'paper-jam-original.png',pivot:{x:112,y:106}});
await save('space',sharp(`${source}/space-original.png`).resize(832,740,{fit:'cover',kernel:'nearest'}),{source:'space-original.png',pivot:{x:0,y:0}});
const visitorsMeta=await sharp(`${source}/night-visitors-original.png`).metadata();
for(let index=0;index<6;index++){
 const cut=await cleaned('night-visitors-original.png',{left:index%3*512,top:Math.floor(index/3)*512,width:512,height:512});
 const sizedVisitor=await sharp(cut).resize(164,150,{fit:'inside',kernel:'nearest'}).png().toBuffer();const m=await sharp(sizedVisitor).metadata();
 await save(`visitor-${['box','moth','paper'][index%3]}-${index<3?'awake':'folded'}`,sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite([{input:sizedVisitor,left:Math.floor((192-m.width)/2),top:166-m.height}]),{source:'night-visitors-original.png',pivot:{x:96,y:166},state:index<3?'awake':'folded'});
}
const fieldMeta=await sharp(`${source}/field-case-original.png`).metadata();
for(let index=0;index<3;index++){
 const left=Math.floor(index*fieldMeta.width/3),right=Math.floor((index+1)*fieldMeta.width/3);
 const cut=await cleaned('field-case-original.png',{left,top:0,width:right-left,height:fieldMeta.height});
 let part=await sharp(cut).resize(index===1?276:304,index===2?74:index===1?124:174,{fit:'fill',kernel:'nearest'}).png().toBuffer();
 if(index===0){
  const {data,info}=await sharp(part).raw().toBuffer({resolveWithObject:true});
  const glassPolygons=[[[90,25],[286,42],[282,113],[90,91]],[[10,50],[72,11],[72,97],[10,137]]];
  const inside=(x,y,p)=>{let within=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])within=!within;}return within;};
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(glassPolygons.some(p=>inside(x,y,p))){const at=(y*info.width+x)*4;const highlight=data[at]>238&&x<132&&y<70;data[at]=214;data[at+1]=192;data[at+2]=239;data[at+3]=highlight?30:16;}
  part=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 }
 if(index===1){
  // Clear glass is a physical translucent layer; the painted frame remains solid.
  const {data,info}=await sharp(part).raw().toBuffer({resolveWithObject:true});
  for(let y=8;y<info.height-16;y++)for(let x=10;x<info.width-10;x++){const i=(y*info.width+x)*4;data[i+3]=Math.min(data[i+3],x>info.width-35?36:12);}
  part=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 }
 const name=['back','front','lid'][index];
 await save(`field-case-${name}`,sharp({create:{width:320,height:256,channels:4,background:'#00000000'}}).composite([{input:part,left:index===1?8:8,top:index===2?30:index===1?106:56}]),{source:'field-case-original.png',pivot:{x:168,y:57},layer:name});
}
const carrier={schema:1,canvas:{width:320,height:256},gripMidpoint:{x:168,y:57},handles:[{x:76,y:42},{x:260,y:62}],physicalBounds:{x:8,y:30,w:304,h:200},cavity:{x:47,y:104,w:215,h:105},hinge:{x:168,y:48},displayScale:.19114285714285714,source:'assets/source/visual-renewal/world/field-case-original.png',layers:['back','specimen','front','hinged-lid']};
await fs.writeFile(`${runtime}/field-case-registration.json`,JSON.stringify(carrier,null,2)+'\n');
for(let index=0;index<4;index++){
 const cut=await cleaned('engineering-original.png',{left:index%2*768,top:Math.floor(index/2)*512,width:768,height:512});
 const item=await sharp(cut).resize(176,166,{fit:'inside',kernel:'nearest'}).png().toBuffer();const meta=await sharp(item).metadata();
 await save(`engineering-${['dock','receiver','repair-bay','drive'][index]}`,sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite([{input:item,left:Math.floor((192-meta.width)/2),top:180-meta.height}]),{source:'engineering-original.png',pivot:{x:96,y:180},entitlement:['dock','receiver','repair-bay','drive'][index]});
}
await fs.writeFile(`${runtime}/registration.json`,JSON.stringify({schema:1,provenance:'OpenAI image_gen original production sprites; approved PNG boards used as style reference only; no reference-board crops',exportScript:'scripts/export_visual_renewal_world.mjs',alpha:'Original broad almost-transparent generation haze removed by alpha<128 threshold; no opaque background retained.',assets:registrations},null,2)+'\n');
console.log(`exported ${registrations.length} original world production textures`);
