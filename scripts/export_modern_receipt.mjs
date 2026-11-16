/** Receipt-only production export; five other curios and all game/save/economy files untouched. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {build} from 'vite';
import {pathToFileURL} from 'node:url';
const proposal='assets/runtime/visual-renewal/receipt-proposal',out='assets/runtime/visual-renewal/receipt-modern',curios='assets/runtime/visual-renewal/curios';
await fs.mkdir(out,{recursive:true});
await build({configFile:false,logLevel:'silent',build:{ssr:'src/fusion/receipt-paper-model.ts',outDir:'releases/receipt-modern-model',emptyOutDir:true,minify:false,rollupOptions:{output:{entryFileNames:'model.js'}}}});
const model=await import(pathToFileURL(process.cwd()+'/releases/receipt-modern-model/model.js'));
const svg=(s,w=384,h=384)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w/2} ${h/2}">${s}</svg>`);
const tag=(b,w=192,h=192)=>`<image width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const registry=[];
async function layer(id,bytes,extra={}){await sharp(bytes).png({compressionLevel:9}).toFile(`${out}/${id}.png`);await sharp(bytes).webp({lossless:true,effort:4}).toFile(`${out}/${id}.webp`);registry.push({id,runtime:`${out}/${id}.png`,webp:`${out}/${id}.webp`,source:'assets/source/visual-renewal/receipt-proposal/paper-atlas-v2.png',sha256:crypto.createHash('sha256').update(await fs.readFile(`${out}/${id}.png`)).digest('hex'),...extra});return fs.readFile(`${out}/${id}.png`);}
// One C sheet supplies ALL original print. Discard only stray chroma spill outside the paper silhouette.
const masterRaw=await sharp(`${proposal}/paper-stabilized.png`).ensureAlpha().raw().toBuffer();
const outline=[[112,29],[304,34],[303,69],[290,241],[278,245],[290,248],[282,316],[274,329],[83,324],[79,319],[108,45]];
function inside(x,y){let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
for(let y=0;y<384;y++)for(let x=0;x<384;x++)if(!inside(x,y))masterRaw[(y*384+x)*4+3]=0;
const master=await layer('receipt-paper-master',await sharp(masterRaw,{raw:{width:384,height:384,channels:4}}).png().toBuffer(),{layer:'single printed rectangular paper; all facts immutable',bounds:model.modernReceiptBounds});
// Extract ONLY neutral dirt from the new A source. Purple original printing is excluded.
const dirtRaw=await sharp(`${proposal}/paper-found.png`).ensureAlpha().raw().toBuffer();
for(let y=0;y<384;y++)for(let x=0;x<384;x++){
 const i=(y*384+x)*4,r=dirtRaw[i],g=dirtRaw[i+1],b=dirtRaw[i+2],neutral=Math.max(r,g,b)-Math.min(r,g,b)<32&&g>b*.84;
 const area=x>75&&x<285&&y>100&&y<263;
 const a=neutral&&area?Math.max(0,Math.min(160,(211-(r+g+b)/3)*3)):0;
 dirtRaw[i]=92;dirtRaw[i+1]=84;dirtRaw[i+2]=94;dirtRaw[i+3]=Math.min(dirtRaw[i+3],a);
}
const dirt=await layer('receipt-paper-deposits',await sharp(dirtRaw,{raw:{width:384,height:384,channels:4}}).composite([{input:master,blend:'dest-in'}]).png().toBuffer(),{layer:'localized original contact soil only; never original ink'});
// Crease shading is independent from original ink. It can flatten under local pressure without printing a new sheet.
const creaseSvg=svg('<path d="M48 57 Q95 63 146 57" fill="none" stroke="#9b8a9b" stroke-width="2.8" opacity=".32"/><path d="M48 56 Q95 62 146 56" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".7"/><path d="M44 125 Q91 117 143 128" fill="none" stroke="#a193a6" stroke-width="3" opacity=".34"/><path d="M44 124 Q91 116 143 127" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".7"/>');
const creases=await layer('receipt-paper-creases',await sharp(creaseSvg).composite([{input:master,blend:'dest-in'}]).png().toBuffer(),{layer:'crease ridge shadow/highlight, no extra paper pieces'});
for(const id of ['tl','tr','bl','br'])for(const side of ['back','front'])await layer(`receipt-clamp-${id}-${side}`,await fs.readFile(`${proposal}/clamp-${id}-${side}.png`),{source:'assets/source/visual-renewal/receipt-proposal/purple-clamps-atlas.png',layer:`independent clamp ${side}`,registration:JSON.parse(await fs.readFile(`${proposal}/proposal-registration.json`,'utf8')).layers.find(l=>l.id===`clamp-${id}-${side}`)});
for(const side of ['back','front'])await layer(`receipt-holder-${side}`,await fs.readFile(`${proposal}/archive-holder-${side}.png`),{source:'assets/source/visual-renewal/receipt-proposal/archive-holder.png',layer:`independent archival support ${side}`,width:384,height:432,sole:[192,390]});
function commandSvg(bytes,commands){return commands.map((c,i)=>{const clipping=c.clip?`<defs><clipPath id="r${i}"><rect x="${c.clip[0]}" y="${c.clip[1]}" width="${c.clip[2]}" height="${c.clip[3]}"/></clipPath></defs>`:'';return clipping+`<g transform="matrix(${c.matrix.join(' ')})"><g ${c.clip?`clip-path="url(#r${i})"`:''}>${tag(bytes)}</g></g>`;}).join('');}
for(const condition of ['found','clean','stabilized']){
 const cleaning=condition==='found'?0:1,corrections=condition==='stabilized'?[1,1]:[0,0];
 const pose=model.modernReceiptPose(cleaning,corrections),commands=model.modernReceiptCommands(pose);
 const unwarped=await sharp(master).composite([...(condition==='found'?[{input:dirt}]:[]),...(condition!=='stabilized'?[{input:creases}]:[])]).png().toBuffer();
 const sourcePixels=await sharp(unwarped).ensureAlpha().raw().toBuffer(),warped=new Uint8ClampedArray(384*384*4);model.warpModernReceiptPixels(sourcePixels,pose,warped);
 const bytes=await sharp(Buffer.from(warped.buffer),{raw:{width:384,height:384,channels:4}}).png().toBuffer();
 await sharp(bytes).png({compressionLevel:9}).toFile(`${curios}/receipt-${condition}.png`);await sharp(bytes).webp({lossless:true,effort:4}).toFile(`${curios}/receipt-${condition}.webp`);
 registry.push({id:`receipt-${condition}`,runtime:`${curios}/receipt-${condition}.png`,webp:`${curios}/receipt-${condition}.webp`,width:384,height:384,source:'assets/source/visual-renewal/receipt-proposal/paper-atlas-v2.png',layer:'canonical-single-sheet-state',condition,composition:'One modern printed master, connected row field, independent crease/soil. No crossfade or paper wings.',sha256:crypto.createHash('sha256').update(await fs.readFile(`${curios}/receipt-${condition}.png`)).digest('hex')});
}
await fs.writeFile(`${out}/registration.json`,JSON.stringify({schema:1,approvedReference:'design/visual-renewal/approved/03_curio_restoration_and_collection.png',logicalSize:192,paperBounds:model.modernReceiptBounds,support:model.modernReceiptSupport,sourceProposalApproved:true,motionSource:'src/fusion/receipt-paper-model.ts',exportCommand:'node scripts/export_modern_receipt.mjs',originalFacts:{artifactCode:'RET-031',boxCode:'P03',signature:null},retiredSourceBackup:'releases/receipt-rejected-439256/manifest.json',assets:registry},null,2)+'\n');
const publicRegistry=JSON.parse(await fs.readFile(`${curios}/registration.json`,'utf8'));
publicRegistry.modernReceipt='../receipt-modern/registration.json';publicRegistry.assets=publicRegistry.assets.filter(a=>!['receipt-found','receipt-clean','receipt-stabilized'].includes(a.id)).concat(registry.filter(a=>a.id==='receipt-found'||a.id==='receipt-clean'||a.id==='receipt-stabilized'));
await fs.writeFile(`${curios}/registration.json`,JSON.stringify(publicRegistry,null,2)+'\n');
console.log('Modern single-paper receipt exported; five other curios unchanged.');
