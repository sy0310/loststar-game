/** Static contact proofs from genuine isolated mechanism components; no production/player replacement. */
import fs from 'node:fs/promises';import sharp from 'sharp';import crypto from 'node:crypto';
const src='assets/source/visual-renewal/mechanisms-v042',out='assets/runtime/visual-renewal/mechanisms-v042',review='artifacts/mechanisms-v042-static';
const registry=JSON.parse(await fs.readFile(`${out}/static-registration.json`,'utf8'));
const svg=(w,h,s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">${s}</svg>`);
const tag=(b,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" xlink:href="data:image/png;base64,${b.toString('base64')}"/>`;
async function part(id,file,box,rect,extra={}){
 const {data,info}=await sharp(`${src}/${file}`).extract({left:box[0],top:box[1],width:box[2],height:box[3]}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Remove only saturated generated matte spill at the alpha contour; leave material pixels unchanged.
 const copy=Buffer.from(data);for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4,r=copy[i],g=copy[i+1],b=copy[i+2];
  let edge=false;if(copy[i+3]>0&&(r>225&&g<85&&(b<90||b>150))){for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=info.width||yy>=info.height||copy[(yy*info.width+xx)*4+3]<128){edge=true;break;}}}
  if(edge||data[i+3]===0){if(edge)data[i+3]=0;data[i]=data[i+1]=data[i+2]=0;}
 }
 const bytes=await sharp(data,{raw:info}).png().toBuffer();await fs.writeFile(`${out}/${id}.png`,bytes);await sharp(bytes).webp({lossless:true,effort:4}).toFile(`${out}/${id}.webp`);
 registry.assets=registry.assets.filter(a=>a.id!==id);registry.assets.push({id,source:`${src}/${file}`,sourceCrop:box,runtime:`${out}/${id}.png`,webp:`${out}/${id}.webp`,rect,width:info.width,height:info.height,logicalSize:192,layer:'isolated physical mechanism part',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...extra});return bytes;
}
await part('tape-frame-back','tape-support-parts-v2.png',[24,35,548,590],[28.13,62.27,252.08,271.4],{sourceBearing:[234.5,125.5],bearing:[136,120]});
await part('tape-frame-front','tape-support-parts-v2.png',[637,109,655,522],[35.56,97.55,301.3,240.12],{sourceBearing:[564,107.5],bearing:[295,147]});
await part('tape-spindle','tape-support-parts-v2.png',[34,826,612,225],undefined,{sourceJournals:[[36,48],[575,181]],worldJournals:[[136,120],[295,147]]});
await part('tape-spindle-cap','tape-support-parts-v2.png',[914,827,242,280],[283,133,24,28]);
await part('tape-roll','tape-roll-open-v2.png',[0,0,1212,1298],[98.86,22.2,199.2,213.6],{sourceBore:[840.5,698.5],worldBore:[237,137.15],openAlphaBore:true});
const layer=async id=>fs.readFile(`${out}/${id}.png`),draw=async(id,dy=0)=>{const e=registry.assets.find(a=>a.id===id),r=e.rect;return tag(await layer(id),r[0],r[1]+dy,r[2],r[3]);};
// True isolated screw -> head/thread components. No purple panel pixels are present in either.
const screw=await layer('bell-screw'),sm=await sharp(screw).metadata();
const headMask=svg(sm.width,sm.height,'<path d="M83 35 Q121 17 157 29 Q193 39 209 77 Q222 113 209 151 Q195 186 160 199 Q123 211 90 188 Q57 166 53 129 Q47 91 66 58 Z" fill="white"/>');
for(const [id,blend]of [['bell-screw-head','dest-in'],['bell-screw-thread','dest-out']]){
 const bytes=await sharp(screw).composite([{input:headMask,blend}]).png().toBuffer();await fs.writeFile(`${out}/${id}.png`,bytes);await sharp(bytes).webp({lossless:true,effort:4}).toFile(`${out}/${id}.webp`);
 registry.assets=registry.assets.filter(a=>a.id!==id);registry.assets.push({id,source:`${src}/bell-parts-v1.png`,derivedFrom:'bell-screw',runtime:`${out}/${id}.png`,webp:`${out}/${id}.webp`,width:sm.width,height:sm.height,rect:[257,266.3,43,40.55],layer:'isolated head'===id?'head':'thread/head from isolated screw only; no housing',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
for(const [id,rect]of [['bell-plunger',[157.32,59.04,82,114.02]],['bell-collar-back',[176.0,118.25,44,24.71]],['bell-collar-front',[176,129,44,16.75]]])registry.assets.find(a=>a.id===id).rect=rect;
// One constant-length, nonstretching shaft, genuinely registered to both fixed support holes.
const axle=await layer('tape-spindle'),ax=registry.assets.find(a=>a.id==='tape-spindle');
const s0={x:36,y:48},s1={x:575,y:181},d0={x:136,y:120},d1={x:295,y:147};
const sl=Math.hypot(s1.x-s0.x,s1.y-s0.y),dl=Math.hypot(d1.x-d0.x,d1.y-d0.y),angle=Math.atan2(d1.y-d0.y,d1.x-d0.x)-Math.atan2(s1.y-s0.y,s1.x-s0.x),scale=dl/sl;
const ma=Math.cos(angle)*scale,mb=Math.sin(angle)*scale,mc=-mb,md=ma,me=d0.x-ma*s0.x-mc*s0.y,mf=d0.y-mb*s0.x-md*s0.y;
ax.matrix=[ma,mb,mc,md,me,mf];
const axleTag=`<g transform="matrix(${ax.matrix.join(' ')})">${tag(axle,0,0,612,225)}</g>`;
async function ribbon(loose){
 const face=await sharp(await layer('tape-band-face')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),back=await sharp(await layer('tape-band-back')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),tip=await sharp(await layer('tape-band-tip')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const points=loose?[{x:150,y:190},{x:142,y:214},{x:128,y:240},{x:110,y:259},{x:93,y:276},{x:94,y:292}]:[{x:150,y:190},{x:137,y:220},{x:123,y:245},{x:111,y:268},{x:95,y:288},{x:81,y:309}];
 let total=0;const segments=points.slice(1).map((b,i)=>{const a=points[i],length=Math.hypot(b.x-a.x,b.y-a.y),value={a,b,length,start:total};total+=length;return value;});
 const pixels=Buffer.alloc(384*384*4);
 for(let y=0;y<384;y++)for(let x=0;x<384;x++){
  let best=Infinity,arc=0,v=0;
  for(const s of segments){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,rawT=((x+.5-s.a.x)*dx+(y+.5-s.a.y)*dy)/(s.length*s.length);if(s===segments[0]&&rawT<0||s===segments.at(-1)&&rawT>1)continue;const t=Math.max(0,Math.min(1,rawT)),px=s.a.x+t*dx,py=s.a.y+t*dy,side=((x+.5-px)*-dy+(y+.5-py)*dx)/s.length,d=Math.hypot(x+.5-px,y+.5-py),width=23-(s.start+t*s.length)/total*3;if(d<best&&Math.abs(side)<width&&d<width+.2){best=d;arc=s.start+t*s.length;v=(side/width+1)/2;}}
  if(!Number.isFinite(best))continue;
  let source=loose&&arc>total*.72?back:face,sx=Math.floor((arc*3.2)%source.info.width),sy=Math.floor(v*(source.info.height-1));
  if(arc>total-20){source=tip;sx=Math.floor(v*(source.info.width-1));sy=Math.floor((arc-(total-20))/20*(source.info.height-1));}
  const from=(sy*source.info.width+sx)*4,to=(y*384+x)*4;source.data.copy(pixels,to,from,from+4);
 }
 return sharp(pixels,{raw:{width:384,height:384,channels:4}}).png().toBuffer();
}
const frontAxisClip='<defs><clipPath id="frontaxis"><path d="M229 114L326 130L317 169L225 152Z"/></clipPath></defs>';
const tapeBase=await draw('tape-frame-back')+axleTag+await draw('tape-roll')+frontAxisClip+`<g clip-path="url(#frontaxis)">${axleTag}</g>`;
const stableBand=await ribbon(false),looseBand=await ribbon(true);
async function bandFront(bytes){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let y=0;y<384;y++)for(let x=0;x<384;x++)if(y<279+(x-50)*.18)data[(y*384+x)*4+3]=0;return sharp(data,{raw:info}).png().toBuffer();}
const tapes={stable:tapeBase+tag(stableBand,0,0,384,384)+await draw('tape-frame-front')+await draw('tape-spindle-cap')+tag(await bandFront(stableBand),0,0,384,384),loose:tapeBase+tag(looseBand,0,0,384,384)+await draw('tape-frame-front')+await draw('tape-spindle-cap')+tag(await bandFront(looseBand),0,0,384,384)};
const bellBase=await draw('bell-shell')+await draw('bell-collar-back'),bellFront=await draw('bell-collar-front')+await draw('bell-screw-head');
const bells={rest:bellBase+'<defs><clipPath id="stem"><rect width="384" height="135"/></clipPath></defs>'+`<g clip-path="url(#stem)">${await draw('bell-plunger')}</g>`+bellFront,half:bellBase+'<defs><clipPath id="stem"><rect width="384" height="135"/></clipPath></defs>'+`<g clip-path="url(#stem)">${await draw('bell-plunger',4)}</g>`+bellFront};
const pad=registry.assets.find(a=>a.id==='mechanism-press-pad'),padBytes=await layer('mechanism-press-pad'),padScale=42/pad.width,contact=pad.contact;
bells.half+=tag(padBytes,198-contact.x*padScale,80.5-contact.y*padScale,42,pad.height*padScale);
const workbench=await sharp('assets/runtime/visual-renewal/curios/restoration-workbench.webp').png().toBuffer();
const label=(s,x,y,color='#83e9ed')=>`<text x="${x}" y="${y}" fill="${color}" font-size="10" font-family="monospace">${s}</text>`;
const debugTapes=tapes.stable+'<path d="M136 120L295 147" stroke="#68dafa" stroke-width="1" stroke-dasharray="4 2" fill="none"/>'+[[136,120,'rear'],[237,137.15,'bore'],[295,147,'front'],[111,268,'guide'],[96,287.3,'outlet'],[81,309,'tip']].map(([x,y,s])=>`<circle cx="${x}" cy="${y}" r="3" stroke="#68dafa" fill="none"/>`+label(s,x+4,y-5)).join('');
const debugBell=bells.half+'<path d="M198 45V160" stroke="#68dafa" stroke-width="1" stroke-dasharray="4 2"/>'+[[198,80.5,'pad/contact'],[198,130.5,'fixed bore'],[284,291,'seated head']].map(([x,y,s])=>`<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="#68dafa"/>`+label(s,x+5,y)).join('');
const all={'tape-v2-stable':tapes.stable,'tape-v2-loose':tapes.loose,'tape-v2-axis-debug':debugTapes,'bell-v2-rest':bells.rest,'bell-v2-halfpress':bells.half,'bell-v2-axis-debug':debugBell};
for(const [name,body]of Object.entries(all)){
 const bytes=await sharp(svg(384,384,body)).png().toBuffer();await fs.writeFile(`${review}/${name}-384.png`,bytes);
 const stage=await sharp(svg(640,700,tag(workbench,0,0,640,700)+tag(bytes,106,191,428,428))).png().toBuffer();
 await sharp(svg(390,844,`<rect width="390" height="844" fill="#241342"/><text x="18" y="36" fill="#f5c986" font-family="sans-serif" font-size="18">${name}</text><text x="18" y="65" fill="#c5b5d3" font-family="sans-serif" font-size="12">物理接触静态审核 · 未接玩家renderer</text>${tag(stage,12,92,366,400.3125)}<text x="18" y="548" fill="#c5b5d3" font-size="12" font-family="sans-serif">青线仅为审核标记，不是运行素材。</text>`)).png().toFile(`${review}/${name}-390.png`);
}
registry.anchorsNative384={tape:{rearBearing:[136,120],rollBore:[237,137.15],frontBearing:[295,147],guide:[111,268],outlet:[96,287.3],tip:[81,309]},bell:{axis:[198,130.5],buttonBBoxTop:[198,60],buttonContact:[198,76.5],frontLipY:135,screwSeat:[284,291]}};
registry.status='v2 contact/shaft/halfpress static proof; requires root review before player integration';registry.exportCommand='node scripts/export_mechanisms_v042_static.mjs && node scripts/export_mechanisms_v042_contacts.mjs';
await fs.writeFile(`${out}/static-registration.json`,JSON.stringify(registry,null,2)+'\n');
console.log('v2 source-supported shaft, true bore and isolated head/halfpress proofs written; player assets unchanged.');
