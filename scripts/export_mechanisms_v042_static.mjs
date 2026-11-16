/** Isolated original production parts -> read-only static assembly. Does not replace player assets. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
const source='assets/source/visual-renewal/mechanisms-v042',out='assets/runtime/visual-renewal/mechanisms-v042',review='artifacts/mechanisms-v042-static';
await fs.mkdir(out,{recursive:true});await fs.mkdir(review,{recursive:true});
const entries=[],layers=new Map();
const parts={
 tape:[{id:'tape-frame-back',cell:0,rect:[40,60,270,260.72]},{id:'tape-frame-front',cell:1,rect:[45,110.72,270,210.28]},{id:'tape-roll',cell:2,rect:[101.8,23,199.2,213.6]},{id:'tape-band-face',cell:3},{id:'tape-band-back',cell:4},{id:'tape-band-tip',cell:5}],
 bell:[{id:'bell-shell',cell:0,rect:[54,106,284,233.24]},{id:'bell-collar-back',cell:1,rect:[175.6,116,44,24.71]},{id:'bell-plunger',cell:2,rect:[151.2,60,82,114.02]},{id:'bell-screw',cell:3,rect:[257,266.3,43,40.55]},{id:'bell-collar-front',cell:4,rect:[175.6,126,44,16.75]},{id:'mechanism-press-pad',cell:5,contact:[249,416]}],
};
const svg=(w,h,s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">${s}</svg>`);
const image=(b,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" xlink:href="data:image/png;base64,${b.toString('base64')}"/>`;
for(const [family,group]of Object.entries(parts)){
 const raw=await sharp(`${source}/${family}-parts-v1.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const part of group){
  const sx=part.cell%3*512,sy=Math.floor(part.cell/3)*512;let l=512,t=512,r=0,b=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(raw.data[((sy+y)*raw.info.width+sx+x)*4+3]>128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  l=Math.max(0,l-3);t=Math.max(0,t-3);r=Math.min(511,r+3);b=Math.min(511,b+3);
  const bytes=await sharp(`${source}/${family}-parts-v1.png`).extract({left:sx+l,top:sy+t,width:r-l+1,height:b-t+1}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Preserve original alpha; invisible RGB is zeroed only for reliable preview compositing.
  for(let i=0;i<bytes.data.length;i+=4)if(bytes.data[i+3]===0){bytes.data[i]=bytes.data[i+1]=bytes.data[i+2]=0;}
  const png=await sharp(bytes.data,{raw:bytes.info}).png({compressionLevel:9}).toBuffer();
  await fs.writeFile(`${out}/${part.id}.png`,png);await sharp(png).webp({lossless:true,effort:4}).toFile(`${out}/${part.id}.webp`);
  layers.set(part.id,{bytes:png,...part,width:bytes.info.width,height:bytes.info.height});
  entries.push({id:part.id,source:`${source}/${family}-parts-v1.png`,sourceCell:[sx,sy,512,512],sourceCrop:[sx+l,sy+t,r-l+1,b-t+1],runtime:`${out}/${part.id}.png`,webp:`${out}/${part.id}.webp`,width:bytes.info.width,height:bytes.info.height,rect:part.rect,contact:part.contact?{x:part.contact[0]-l,y:part.contact[1]-t}:undefined,logicalSize:192,layer:'independently drawn isolated mechanism part',sha256:crypto.createHash('sha256').update(png).digest('hex')});
 }
}
const p=(id,dy=0)=>{const v=layers.get(id),[x,y,w,h]=v.rect;return image(v.bytes,x,y+dy,w,h);};
const face=layers.get('tape-band-face'),tip=layers.get('tape-band-tip');
// A single continuous band occupies the real roll-to-outlet plane; no paper props or cropped assembled sprite.
const tapeRibbon=`<defs><clipPath id="band"><path d="M126 178 C119 208 105 242 88 257 Q79 268 68 278 L106 305 Q132 290 137 272 C154 234 162 215 172 196 Z"/></clipPath></defs><g clip-path="url(#band)"><g transform="matrix(-.28 .68 -.36 -.15 182 180)">${image(face.bytes,0,0,face.width,face.height)}</g>${image(tip.bytes,67,271,42,36)}</g>`;
const tape=p('tape-frame-back')+p('tape-roll')+tapeRibbon+p('tape-frame-front');
const bell=p('bell-shell')+p('bell-collar-back')+`<g clip-path="url(#stem-occlusion)">${p('bell-plunger')}</g>`+p('bell-collar-front')+p('bell-screw');
const bellDefs='<defs><clipPath id="stem-occlusion"><rect x="0" y="0" width="384" height="133"/></clipPath></defs>';
const scenes={tape,bell:bellDefs+bell};
const workbench=await sharp('assets/runtime/visual-renewal/curios/restoration-workbench.webp').png().toBuffer();
for(const [id,body]of Object.entries(scenes)){
 await sharp(svg(384,384,body)).png().toFile(`${review}/${id}-assembled-384.png`);
 const stage=await sharp(svg(640,700,image(workbench,0,0,640,700)+image(await sharp(svg(384,384,body)).png().toBuffer(),106,191,428,428))).png().toBuffer();await fs.writeFile(`${review}/${id}-stage-640.png`,stage);
 await sharp(svg(390,844,`<rect width="390" height="844" fill="#241342"/><text x="18" y="36" fill="#f5c986" font-size="19" font-family="sans-serif">${id==='tape'?'胶带 · 唯一带面/固定出口':'铃 · 固定壳与孔圈/独立顶杆'}</text><text x="18" y="66" fill="#c8b9d5" font-size="12" font-family="sans-serif">新源静态分层装配 · 未接玩家renderer</text>${image(stage,12,92,366,400.3125)}<text x="18" y="540" fill="#f5d9b4" font-size="13" font-family="sans-serif">${id==='tape'?'后架 → 轴/卷 → 连续带 → 前架/出带唇':'固定壳 → 孔后圈 → 顶杆 → 孔前圈 → 螺钉'}</text><text x="18" y="574" fill="#c8b9d5" font-size="12" font-family="sans-serif">实际静态像素390×844；非浏览器/手机截图</text>`)).png().toFile(`${review}/${id}-390.png`);
 const group=entries.filter(e=>e.id.startsWith(id+'-')||id==='bell'&&e.id==='mechanism-press-pad');
 let sheet='<rect width="1152" height="768" fill="#241342"/>';
 for(const [i,e]of group.entries()){const v=layers.get(e.id),x=i%3*384,y=Math.floor(i/3)*384,scale=Math.min(320/v.width,300/v.height);sheet+=image(v.bytes,x+(384-v.width*scale)/2,y+20+(300-v.height*scale)/2,v.width*scale,v.height*scale)+`<text x="${x+16}" y="${y+359}" font-family="monospace" font-size="16" fill="#f5c986">${e.id}</text>`;}
 await sharp(svg(1152,768,sheet)).png().toFile(`${review}/${id}-parts-sheet.png`);
}
await fs.writeFile(`${out}/static-registration.json`,JSON.stringify({schema:1,status:'static assembly only; root review required before player integration',logicalSize:192,artStyle:'same 3/4 pixel art, upper-left warm key light',exportCommand:'node scripts/export_mechanisms_v042_static.mjs',anchorsNative384:{tape:{axis:[238,137],outlet:[111,268],tip:[88,290]},bell:{axis:[197,128],buttonTop:[197,60],collarFrontY:133,screwSeat:[284,291]}},assets:entries},null,2)+'\n');
console.log('12 new isolated parts exported; tape/bell player assets and save logic untouched.');
