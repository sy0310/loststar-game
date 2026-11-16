/** Canonical physical layers: the browser and exported states share the same pure draw commands. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {build} from 'vite';
const root='assets/source/visual-renewal/curios',out='assets/runtime/visual-renewal/curios';
await build({configFile:false,logLevel:'silent',build:{ssr:'src/fusion/curio-rig-motion.ts',outDir:'releases/renewal-curio-rig',emptyOutDir:true,minify:false,rollupOptions:{output:{entryFileNames:'motion.js'}}}});
const {curioRigCommands}=await import(pathToFileURL(process.cwd()+'/releases/renewal-curio-rig/motion.js'));
const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
const cells={receipt:'receipt-three-states-v2.png',nested:'nested-three-states-v2.png'};
const layers=new Map(),registry=[];
const transparent=()=>sharp({create:{width:384,height:384,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
const src={};for(const id of ids){const file=`${root}/${cells[id]??`${id}-three-states.png`}`,m=await sharp(file).metadata();src[id]=await Promise.all([0,1,2].map(i=>sharp(file).extract({left:i*m.height,top:0,width:m.height,height:m.height}).resize(384,384,{kernel:'nearest'}).png().toBuffer()));}
const svg=(body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="384" height="384" viewBox="0 0 192 192">${body}</svg>`);
const href=b=>`data:image/png;base64,${b.toString('base64')}`;
const image=b=>`<image x="0" y="0" width="192" height="192" xlink:href="${href(b)}"/>`;
async function crop(image,polygons,invert=false){const mask=svg(polygons.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}" fill="white"/>`).join(''));return sharp(image).composite([{input:mask,blend:invert?'dest-out':'dest-in'}]).png().toBuffer();}
async function layer(name,data,source,extra={}){layers.set(name,data);await sharp(data).png({compressionLevel:9}).toFile(`${out}/${name}.png`);await sharp(data).webp({quality:95,alphaQuality:100,effort:4}).toFile(`${out}/${name}.webp`);const m=await sharp(data).metadata();registry.push({id:name,source,runtime:`${out}/${name}.png`,webp:`${out}/${name}.webp`,width:m.width,height:m.height,layer:'physical-rig',logicalSize:192,sha256:crypto.createHash('sha256').update(await fs.readFile(`${out}/${name}.png`)).digest('hex'),...extra});}
async function fitted(file,rect){const s=await sharp(`${root}/rig-v2/${file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=s.info.width,t=s.info.height,r=0,b=0;for(let y=0;y<s.info.height;y++)for(let x=0;x<s.info.width;x++)if(s.data[(y*s.info.width+x)*4+3]>=128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}const bytes=await sharp(`${root}/rig-v2/${file}`).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(rect[2]*2,rect[3]*2,{fit:'fill',kernel:'nearest'}).png().toBuffer();return transparent().composite([{input:bytes,left:rect[0]*2,top:rect[1]*2}]).png().toBuffer();}
function affineFrom3(s,d){const [p,q,r]=s,[a,b,c]=d,det=(q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]);const xx=((b[0]-a[0])*(r[1]-p[1])-(c[0]-a[0])*(q[1]-p[1]))/det,xy=((c[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]))/det,yx=((b[1]-a[1])*(r[1]-p[1])-(c[1]-a[1])*(q[1]-p[1]))/det,yy=((c[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]))/det;return[xx,yx,xy,yy,a[0]-xx*p[0]-xy*p[1],a[1]-yx*p[0]-yy*p[1]];}
const masks={
 receipt:[[[118,20],[170,24],[156,68]],[[16,169],[22,141],[65,171]]],
 tape:[[[69,98],[69,66],[77,45],[95,30],[124,29],[145,40],[154,62],[153,76],[127,92],[107,102],[84,105]],[[22,122],[33,108],[65,92],[85,92],[78,107],[57,126],[50,142],[23,142]]],
 nested:[[[30,85],[77,40],[166,57],[166,79],[132,113],[30,97]],[[27,126],[60,126],[65,176],[24,176]]],
 stamp:[[[56,0],[129,0],[138,45],[119,74],[114,102],[77,102],[76,73],[56,64]],[[64,96],[124,96],[127,117],[119,123],[68,120]]],
 'cosmic-parcel':[[[105,23],[123,26],[64,80],[62,160],[48,158],[49,78]],[[65,84],[94,86],[99,93],[100,132],[63,131],[62,91]]],
 bell:[[[132,130],[155,130],[157,151],[132,153]],[[76,23],[119,23],[119,46],[107,49],[108,56],[115,59],[111,65],[82,65],[80,59],[91,54],[90,45],[76,44]]],
};
// Paper: common original fixed sheet and real corner fibres. Printed facts never change.
await layer('receipt-rig-fixed',await crop(src.receipt[2],masks.receipt,true),`${root}/${cells.receipt}`);
for(let i=0;i<2;i++)await layer(`receipt-rig-joint${i}`,await crop(src.receipt[2],[masks.receipt[i]]),`${root}/${cells.receipt}`,{joint:i});
const blank=await sharp(`${root}/receipt-inner-blank.png`).trim().resize(384,384,{fit:'fill',kernel:'nearest'}).png().toBuffer();
for(let i=0;i<2;i++){const alpha=await sharp(await crop(src.receipt[2],[masks.receipt[i]])).extractChannel('alpha').raw().toBuffer();const rgb=await sharp(blank).removeAlpha().raw().toBuffer();const back=await sharp(rgb,{raw:{width:384,height:384,channels:3}}).joinChannel(alpha,{raw:{width:384,height:384,channels:1}}).png().toBuffer();await layer(`receipt-rig-joint${i}-back`,back,`${root}/receipt-inner-blank.png`,{joint:i,side:'back'});}
await layer('receipt-rig-fibre',await crop(src.receipt[2],[[[18,138],[44,137],[43,147],[16,151]]]),`${root}/${cells.receipt}`);
// A real empty frame fills the space when roll/tail move, instead of a copied broken roll.
await layer('tape-rig-fixed',await fitted('tape-empty-frame.png',[22,58,149,105]),`${root}/rig-v2/tape-empty-frame.png`);
for(let i=0;i<2;i++)await layer(`tape-rig-joint${i}`,await crop(src.tape[2],[masks.tape[i]]),`${root}/tape-three-states.png`,{joint:i});
await layer('tape-rig-front',await crop(src.tape[2],[[[86,102],[166,61],[173,65],[173,145],[89,156]]]),`${root}/tape-three-states.png`);
// The actual rear wall meets the very same two hinge anchors as the lid projection.
const open=await fs.readFile(`${root}/rig-v2/nested-empty-body.png`),mat=affineFrom3([[509,339],[1050,430],[228,625]],[[78,43],[166,57],[34,91]]);
const openPng=await sharp(svg(`<g transform="matrix(${mat.join(' ')})"><image x="0" y="0" width="1280" height="1280" xlink:href="${href(open)}"/></g>`)).png().toBuffer();
await layer('nested-rig-fixed',await crop(openPng,[masks.nested[1]],true),`${root}/rig-v2/nested-empty-body.png`,{rearHinge:[[80,43],[166,57]],sourceAnchors:[[509,339],[1050,430],[228,625]],targetAnchors:[[78,43],[166,57],[34,91]]});
await layer('nested-rig-joint0',await crop(src.nested[2],[masks.nested[0]]),`${root}/${cells.nested}`,{joint:0,rearHinge:[[80,43],[166,57]]});
await layer('nested-rig-corner',await crop(openPng,[masks.nested[1]]),`${root}/rig-v2/nested-empty-body.png`,{joint:1});
await layer('nested-rig-inner',src.nested[2],`${root}/${cells.nested}`,{joint:1,reuse:'Same first layer, miniature internal box; no new reward'});
await layer('nested-rig-front',await crop(await crop(openPng,[masks.nested[1]],true),[[[0,111],[137,111],[137,192],[0,192]]]),`${root}/rig-v2/nested-empty-body.png`);
await layer('stamp-rig-fixed',await fitted('stamp-base.png',[43,109,130,74]),`${root}/rig-v2/stamp-base.png`);
for(let i=0;i<2;i++)await layer(`stamp-rig-joint${i}`,await crop(src.stamp[2],[masks.stamp[i]]),`${root}/stamp-three-states.png`,{joint:i});
await layer('cosmic-parcel-rig-fixed',await fitted('cosmic-box-body.png',[17,20,160,154]),`${root}/rig-v2/cosmic-box-body.png`);
const cross=[[44,41],[58,36],[128,56],[123,69],[49,52]];
const clothMasked=await sharp(await crop(src['cosmic-parcel'][2],[masks['cosmic-parcel'][0],cross])).ensureAlpha().raw().toBuffer();
for(let y=0;y<384;y++)for(let x=0;x<384;x++){const i=(y*384+x)*4,r=clothMasked[i],g=clothMasked[i+1],b=clothMasked[i+2],buckle=x/2>75&&x/2<106&&y/2>44&&y/2<64;if(!buckle&&!(b>g*1.06&&b>r*.82))clothMasked[i+3]=0;}
await layer('cosmic-parcel-rig-joint0',await sharp(clothMasked,{raw:{width:384,height:384,channels:4}}).png().toBuffer(),`${root}/cosmic-parcel-three-states.png`,{joint:0});
await layer('cosmic-parcel-rig-joint1',await crop(src['cosmic-parcel'][2],[masks['cosmic-parcel'][1]]),`${root}/cosmic-parcel-three-states.png`,{joint:1});
await layer('cosmic-parcel-rig-string',await crop(src['cosmic-parcel'][2],[[[84,61],[88,61],[87,77],[83,87],[79,86],[82,75]]]),`${root}/cosmic-parcel-three-states.png`);
await layer('bell-rig-fixed',await fitted('bell-body.png',[27,53,142,114]),`${root}/rig-v2/bell-body.png`);
for(let i=0;i<2;i++)await layer(`bell-rig-joint${i}`,await crop(src.bell[2],[masks.bell[i]]),`${root}/bell-three-states.png`,{joint:i});
// Six separately authored material deposits, no old printed ink or full-body blend.
const depositFile=`${root}/rig-v2/material-deposits.png`,dm=await sharp(depositFile).metadata(),cell=dm.width/3;
const depositTargets={receipt:[39,61,91,66],tape:[37,43,80,96],nested:[36,66,117,40],stamp:[43,133,113,46],'cosmic-parcel':[64,83,39,51],bell:[42,62,109,73]};
for(const [i,id]of ids.entries()){
 const [x,y,w,h]=depositTargets[id],part=await sharp(depositFile).extract({left:i%3*cell,top:Math.floor(i/3)*cell,width:cell,height:cell}).resize(w*2,h*2,{fit:'fill',kernel:'nearest'}).png().toBuffer();
 const data=await transparent().composite([{input:part,left:x*2,top:y*2}]).png().toBuffer();
 await layer(`${id}-rig-deposits`,data,depositFile,{layer:'authored-material-deposits',sourceCell:[i%3,Math.floor(i/3)],target:[x,y,w,h]});
}
function renderCommands(id,corrections){const commands=curioRigCommands(id,corrections);const defs=[],body=[];commands.forEach((c,i)=>{const b=layers.get(c.key);if(!b)throw Error('Missing physical layer '+c.key);let piece=image(b);if(c.polygon){defs.push(`<clipPath id="poly${i}"><polygon points="${c.polygon.map(p=>`${p.x},${p.y}`).join(' ')}"/></clipPath>`);piece=`<g clip-path="url(#poly${i})">${piece}</g>`;}if(c.clip){defs.push(`<clipPath id="clip${i}"><rect x="${c.clip[0]}" y="${c.clip[1]}" width="${c.clip[2]}" height="${c.clip[3]}"/></clipPath>`);piece=`<g clip-path="url(#clip${i})">${piece}</g>`;}body.push(`<g transform="matrix(${c.matrix.join(' ')})">${piece}</g>`);});return svg(`<defs>${defs.join('')}</defs>${body.join('')}`);}
for(const id of ids)for(const state of ['found','clean','stabilized']){
 const base=await sharp(renderCommands(id,state==='stabilized'?[1,1]:[0,0])).png().toBuffer();
 let final=base;
 if(state==='found'){
  const clipped=await sharp(layers.get(`${id}-rig-deposits`)).composite([{input:base,blend:'dest-in'}]).png().toBuffer();final=await sharp(base).composite([{input:clipped}]).png().toBuffer();
 }
 await sharp(final).png({compressionLevel:9}).toFile(`${out}/${id}-${state}.png`);
 await sharp(final).webp({quality:95,alphaQuality:100,effort:4}).toFile(`${out}/${id}-${state}.webp`);
 registry.push({id:`${id}-${state}`,source:`${root}/rig-v2`,runtime:`${out}/${id}-${state}.png`,webp:`${out}/${id}-${state}.webp`,width:384,height:384,logicalSize:192,layer:'canonical-specimen-state',state,sha256:crypto.createHash('sha256').update(await fs.readFile(`${out}/${id}-${state}.png`)).digest('hex'),composition:'Same curioRigCommands physical layers as runtime; no B/C crossfade',corrections:state==='stabilized'?[1,1]:[0,0]});
}
await fs.writeFile(`${out}/rig-registration.json`,JSON.stringify({schema:2,logicalSize:192,exportCommand:'node scripts/export_renewal_curios.mjs',motionSource:'src/fusion/curio-rig-motion.ts',assets:registry},null,2)+'\n');
console.log(`Canonical physical rig: ${layers.size} layers; all 18 PNG states replaced from the same continuous geometry.`);

// The public registry follows the canonical output hashes; retired clip-only layers are not production inputs.
const old=JSON.parse(await fs.readFile(`${out}/registration.json`,'utf8')),allIds=new Set(registry.map(a=>a.id));
old.schema=2;old.physicalRig='rig-registration.json';old.layers=[];old.assets=old.assets.filter(a=>!allIds.has(a.id)).concat(registry);
await fs.writeFile(`${out}/registration.json`,JSON.stringify(old,null,2)+'\n');
for(const id of ids)for(const suffix of ['body','joint'])await fs.unlink(`${out}/${id}-${suffix}.png`).catch(()=>{});
