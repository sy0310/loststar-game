import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='assets/source/visual-renewal/museum',out='assets/runtime/visual-renewal/museum';
await mkdir(out,{recursive:true});
const entries=[];
async function record(file,from,extra={}){const b=await readFile(`${out}/${file}`),m=await sharp(b).metadata();entries.push({id:file.replace(/\.(png|webp)$/,''),source:`${source}/${from}`,runtime:`${out}/${file}`,width:m.width,height:m.height,sha256:createHash('sha256').update(b).digest('hex'),sourceSha256:createHash('sha256').update(await readFile(`${source}/${from}`)).digest('hex'),provenance:'Original generated production art using built-in image_gen; approved boards are style reference only. Deterministic nearest-neighbour registration export.',...extra});}
await sharp(`${source}/room-empty-source.png`).resize(384,480,{fit:'fill',kernel:'nearest'}).resize(768,960,{kernel:'nearest'}).webp({lossless:true}).toFile(`${out}/room.webp`);
await record('room.webp','room-empty-source.png',{pivot:[384,960],layers:['architecture','unobstructed floor'],floorBoundaryY:354,aisles:{hub:[384,918],verticalX:[244,524],cabinetContacts:[[104,500],[384,500],[664,500],[104,825],[384,825],[664,825]]}});
const cavities=[{x:59,y:59,w:201,h:215,floor:300},{x:63,y:72,w:186,h:169,floor:270},{x:60,y:77,w:179,h:150,floor:248},{x:70,y:80,w:164,h:131,floor:232}];
for(let level=0;level<4;level++){
 const from=`case-${level}-source.png`,file=`case-${level}-back.webp`;
 const normalized=await sharp(`${source}/${from}`).resize(320,400,{fit:'contain',kernel:'nearest',background:'#00000000'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 await sharp(normalized.data,{raw:normalized.info}).webp({lossless:true}).toFile(`${out}/${file}`);
 await record(file,from,{level,pivot:[160,394],base:{x:160,y:394,w:296},cavity:cavities[level],layers:['rear glass','base','frame'],empty:true});
 const front=Buffer.from(normalized.data);const cavity=cavities[level];
 // Export reflection-only authored glass edge pixels. Omit all cabinet cap/base pixels:
 // the structural body exists only once in the back layer.
 for(let y=0;y<400;y++)for(let x=0;x<320;x++){
  const o=(y*320+x)*4;const edge=(x>=cavity.x-9&&x<cavity.x+4||x>=cavity.x+cavity.w-4&&x<cavity.x+cavity.w+9)&&y>cavity.y&&y<cavity.y+cavity.h;
  if(!edge)front[o+3]=0;else front[o+3]=Math.round(front[o+3]*.38);
 }
 const frontFile=`case-${level}-front.webp`;
 await sharp(front,{raw:normalized.info}).webp({lossless:true}).toFile(`${out}/${frontFile}`);
 await record(frontFile,from,{level,pivot:[160,394],cavity,layers:['front reflection only'],opacity:.38,pairedWith:file});
}
for(const id of ['mouse','hermit','tagbird']){
 const from=`${id}-poses-source.png`,m=await sharp(`${source}/${from}`).metadata();
 for(let pose=0;pose<3;pose++){
  const square=Math.floor(m.width/3);const region=await sharp(`${source}/${from}`).extract({left:pose*square,top:0,width:square,height:m.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=square,top=m.height,right=0,bottom=0;
  for(let y=0;y<m.height;y++)for(let x=0;x<square;x++)if(region.data[(y*square+x)*4+3]>20){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  // Individual pose silhouettes preserve physical baseline after transparent padding.
  const crop=await sharp(region.data,{raw:region.info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(154,142,{fit:'inside',kernel:'nearest'}).png().toBuffer();
  const cm=await sharp(crop).metadata();const x=Math.round((176-cm.width)/2),y=158-cm.height;
  const file=`${id}-${pose}.webp`;
  await sharp({create:{width:176,height:176,channels:4,background:'#00000000'}}).composite([{input:crop,left:x,top:y}]).webp({lossless:true}).toFile(`${out}/${file}`);
  await record(file,from,{species:id,pose,pivot:[88,id==='tagbird'?142:158],feet:[88,id==='tagbird'?142:158],sourceCell:pose,sourceBounds:{left:pose*square+left,top,width:right-left+1,height:bottom-top+1},layers:['resident'],frames:1});
 }
 const background=`habitat-${id}.webp`;
 await sharp(`${source}/habitat-${id}-source.png`).resize(600,200,{fit:'fill',kernel:'nearest'}).webp({lossless:true}).toFile(`${out}/${background}`);
 await record(background,`habitat-${id}-source.png`,{pivot:[300,200],layers:['habitat rear','ground contact']});
}
const furnishingNames=['string-lights','paper-garden','memorial-plaque','armillary'];
for(let index=0;index<4;index++){
 const from='furnishings-source.png',m=await sharp(`${source}/${from}`).metadata(),cell=Math.floor(m.width/4);
 const region=await sharp(`${source}/${from}`).extract({left:index*cell,top:0,width:cell,height:m.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=cell,top=m.height,right=0,bottom=0;
 for(let y=0;y<m.height;y++)for(let x=0;x<cell;x++){const offset=(y*cell+x)*4;if(region.data[offset+3]<128)region.data[offset+3]=0;else{left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
 const dimensions=[[200,110],[144,144],[180,72],[124,160]][index],file=`${furnishingNames[index]}.webp`;
 await sharp(region.data,{raw:region.info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(dimensions[0],dimensions[1],{fit:'inside',kernel:'nearest'}).webp({lossless:true}).toFile(`${out}/${file}`);
 await record(file,from,{growthId:`deco-${index}`,layers:['furnishing'],sourceCell:index,alpha:'below128 removed to eliminate generation haze; no opaque background',pivot:index===0?'top bracket':'floor or wall centre'});
}
await writeFile(`${source}/REGISTRATION.json`,JSON.stringify({schema:1,tool:'image_gen built-in',camera:'near-frontal slight top-down',palette:{purple:'#241342',brass:'#e3a454',paper:'#f5c986',eye:'#68dafa'},mainLight:'upper-left',roomCanvas:[768,960],runtimeRegistration:{registrationSource:'src/render/museum-space.ts',caseContacts:[[104,500],[384,500],[664,500],[104,825],[384,825],[664,825]],aisleCenters:[244,524],caseWidth:172,caseInnerWidth:128,aisleClearWidth:108,transitBodyWidth:96,aisleFootprintWidth:80,caseLayers:['rear hood and interior','moving fitted tray and registered specimen','fixed near posts and base face','five telescoping transparent panes and fixed rails','real Canvas Chinese nameplate inside the base face'],caseInnerHeight:168,caseBaseHeights:[44,54,62,72],specimenContact:'curio-renewal-model.support aligned with floor-13; cell centre is not the contact',robot:'shared renewal-robot rig; width136 world unchanged; rebase -2/+2 after measured alpha+joint transit envelope; stowed transit; museum-only finite 49/48 local links; real same-side two-point specimen grips'},exportCommand:'node scripts/export_renewal_museum.mjs',assets:entries},null,2)+'\n');
const tiles=[];for(let l=0;l<4;l++)tiles.push({input:await sharp(`${out}/case-${l}-back.webp`).resize(250,312,{kernel:'nearest'}).toBuffer(),left:l*268+12,top:20});
await sharp({create:{width:1080,height:356,channels:4,background:'#241342'}}).composite(tiles).png().toFile(`${source}/four-levels-preview.png`);
console.log(`Exported ${entries.length} registered museum assets.`);
