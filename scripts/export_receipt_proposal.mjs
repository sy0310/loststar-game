/** Read-only art proposal export. Does not write any active curio, save, or price file. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source='assets/source/visual-renewal/receipt-proposal',out='assets/runtime/visual-renewal/receipt-proposal',review='artifacts/receipt-redesign-static';
await fs.mkdir(out,{recursive:true});await fs.mkdir(review,{recursive:true});
const states=['found','clean','stabilized'],papers={},records=[];
const transparent=(w,h)=>sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
const imageTag=(b,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const svg=(w,h,s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:'PingFang SC','Noto Sans CJK SC',sans-serif}</style>${s}</svg>`);
const label=(text,x,y,size=16,color='#ffe0a5')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${text}</text>`;
async function write(name,data,extra={}){const path=`${out}/${name}.png`;await sharp(data).png({compressionLevel:9}).toFile(path);records.push({id:name,path,...extra,sha256:crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex')});return fs.readFile(path);}
for(const [i,state]of states.entries()){
 const original=await sharp(`${source}/paper-atlas-v2.png`).extract({left:i*724,top:0,width:724,height:724}).resize(384,384,{kernel:'nearest'}).png().toBuffer();
 const {data}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=384,right=0;for(let y=20;y<340;y++)for(let x=0;x<384;x++)if(data[(y*384+x)*4+3]>239){left=Math.min(left,x);right=Math.max(right,x);}
 const dx=Math.round(192-(left+right)/2);
 papers[state]=await write(`paper-${state}`,svg(384,384,`<g transform="translate(${dx},0)">${imageTag(original,0,0,384,384)}</g>`),{source:`${source}/paper-atlas-v2.png`,sourceCell:[i*724,0,724,724],translation:[dx,0],pivot:[192,328],pixelScale:'Common cell resize 724→384, translation only; no per-state refit'});
}
const clamps={tl:{box:[204,190,296,263],contact:[315,310],target:[117,35],jaw:[[302,303],[449,306],[446,369],[295,366]]},tr:{box:[780,190,286,263],contact:[946,310],target:[305,43],jaw:[[812,303],[968,306],[971,368],[812,366]]},bl:{box:[199,790,287,254],contact:[310,947],target:[78,318],jaw:[[302,889],[437,892],[437,941],[300,941]]},br:{box:[780,790,289,254],contact:[946,946],target:[270,322],jaw:[[813,889],[969,892],[970,941],[811,941]]}};
const backs=[],fronts=[];
for(const [id,c]of Object.entries(clamps)){
 const [left,top,width,height]=c.box,raw=await sharp(`${source}/purple-clamps-atlas.png`).extract({left,top,width,height}).png().toBuffer();
 const points=c.jaw.map(([x,y])=>`${x-left},${y-top}`).join(' '),mask=svg(width,height,`<polygon points="${points}" fill="white"/>`);
 const back=await sharp(raw).composite([{input:mask,blend:'dest-in'}]).png().toBuffer(),front=await sharp(raw).composite([{input:mask,blend:'dest-out'}]).png().toBuffer();
 const scale=32/width,x=c.target[0]-(c.contact[0]-left)*scale,y=c.target[1]-(c.contact[1]-top)*scale;
 await write(`clamp-${id}-back`,back,{source:`${source}/purple-clamps-atlas.png`,sourceRect:c.box,contact:[c.contact[0]-left,c.contact[1]-top],target:c.target,displayWidth:32,layer:'behind paper'});
 await write(`clamp-${id}-front`,front,{source:`${source}/purple-clamps-atlas.png`,sourceRect:c.box,contact:[c.contact[0]-left,c.contact[1]-top],target:c.target,displayWidth:32,layer:'in front of paper edge'});
 backs.push(imageTag(back,x,y,32,height*scale));fronts.push(imageTag(front,x,y,32,height*scale));
}
const supported=await write('paper-clean-supported',svg(384,384,backs.join('')+imageTag(papers.clean,0,0,384,384)+fronts.join('')),{composition:'Rear jaws → original paper → clamp body/front lips; clamps never enter paper alpha or evidence'});
const glassBack=await sharp('assets/runtime/visual-renewal/museum/case-0-back.webp').png().toBuffer(),glassFront=await sharp('assets/runtime/visual-renewal/museum/case-0-front.webp').png().toBuffer();
const displayed=await write('display-context-only',svg(384,480,imageTag(glassBack,32,24,320,400)+'<ellipse cx="192" cy="313" rx="91" ry="4" fill="#21102e" opacity=".55"/>'+imageTag(papers.stabilized,46,62,292,292)+imageTag(glassFront,32,24,320,400)),{composition:'Existing Museum Lv0 rear glass → new paper → existing front glass',contextOnly:true,paperSpriteContainsGlass:false});
function affineFrom3(s,d){const [p,q,r]=s,[a,b,c]=d,det=(q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]);const xx=((b[0]-a[0])*(r[1]-p[1])-(c[0]-a[0])*(q[1]-p[1]))/det,xy=((c[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]))/det,yx=((b[1]-a[1])*(r[1]-p[1])-(c[1]-a[1])*(q[1]-p[1]))/det,yy=((c[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]))/det;return[xx,yx,xy,yy,a[0]-xx*p[0]-xy*p[1],a[1]-yx*p[0]-yy*p[1]];}
const holderSource=await fs.readFile(`${source}/archive-holder.png`),holderMatrix=affineFrom3([[381,164],[948,185],[266,1024]],[[107,29],[306,33],[78,326]]);
const holderMask=svg(1199,1312,'<rect x="236" y="955" width="104" height="116" fill="white"/><rect x="756" y="974" width="104" height="116" fill="white"/><rect x="212" y="1032" width="667" height="66" fill="white"/>');
const holderRawFront=await sharp(holderSource).composite([{input:holderMask,blend:'dest-in'}]).png().toBuffer(),holderRawBack=await sharp(holderSource).composite([{input:holderMask,blend:'dest-out'}]).png().toBuffer();
const holderBack=await write('archive-holder-back',svg(384,432,`<g transform="matrix(${holderMatrix.join(' ')})">${imageTag(holderRawBack,0,0,1199,1312)}</g>`),{source:`${source}/archive-holder.png`,sourceAnchors:[[381,164],[948,185],[266,1024]],targetAnchors:[[107,29],[306,33],[78,326]],layer:'archive backing plate, rear supports and feet; behind paper'});
const holderFront=await write('archive-holder-front',svg(384,432,`<g transform="matrix(${holderMatrix.join(' ')})">${imageTag(holderRawFront,0,0,1199,1312)}</g>`),{source:`${source}/archive-holder.png`,layer:'physical bottom ledge and copper corner retainers; in front of paper'});
const workbench=await sharp('assets/runtime/visual-renewal/curios/restoration-workbench.webp').png().toBuffer();
for(const [i,state]of states.entries()){
 const title=['01 发现态','02 整理态 · 四角夹持','03 展示完成态'][i];
 const art=state==='clean'?supported:papers[state];
 let scene=imageTag(workbench,0,0,640,700)+imageTag(art,128,178,384,384);
 if(state==='stabilized')scene=imageTag(workbench,0,0,640,700)+imageTag(glassBack,112,95,416,520)+'<ellipse cx="320" cy="500" rx="105" ry="5" fill="#21102e" opacity=".55"/>'+imageTag(holderBack,155,165,330,371.25)+imageTag(papers[state],155,165,330,330)+imageTag(holderFront,155,165,330,371.25)+imageTag(glassFront,112,95,416,520);
 const stage=await sharp(svg(640,700,scene)).png().toBuffer();await fs.writeFile(`${review}/stage-${state}-640.png`,stage);
 const footer=['同一张纸：压皱、接触污、短裂口与原缺角。','紫夹是独立承托；纸已展开，旧折痕尚未固定。','原票压稳入罩；缺角仍在，签收依旧留空。'][i];
 const phone=svg(390,844,`<rect width="390" height="844" fill="#241342"/><rect x="8" y="8" width="374" height="828" fill="none" stroke="#b88353"/>${label('收据重画 · 只读静态候选',20,37,18)}${label(title,20,78,17)}${label('未接运行存档 · 不扣零件',20,104,12,'#c8b7d8')}${imageTag(stage,12,128,366,400.3125)}${label(footer,18,566,12,'#e7d8e8')}${label('RET-031 / P03 · 原签收字段未补造',18,596,12,'#e7d8e8')}${label('实际像素画面 390 × 844',18,812,12,'#c8b7d8')}`);
 await sharp(phone).png().toFile(`${review}/receipt-${state}-390.png`);
}
const approved='design/visual-renewal/approved/03_curio_restoration_and_collection.png';
const refs=[{left:35,top:286,width:144,height:133},{left:188,top:286,width:139,height:133},{left:339,top:262,width:148,height:162}];
let comparison='';for(const [col,title]of ['认可原图 · 左上面板','439256旧版 · 用户拒绝','重画静态候选 · 待审核'].entries())comparison+=label(title,col*390+20,38,19);
for(const [row,state]of states.entries()){
 const y=64+row*330,ref=await sharp(approved).extract(refs[row]).png().toBuffer();await fs.writeFile(`${review}/reference-${state}.png`,ref);
 const old=execFileSync('git',['show',`f1397e268b4dec43a241833da077b08104451c8e:assets/runtime/visual-renewal/curios/receipt-${state}.png`]),art=state==='clean'?supported:state==='stabilized'?displayed:papers[state];
 comparison+=`<path d="M12 ${y}H1158" stroke="#78537b"/>`+label(['发现','整理','展示'][row],20,y+25,15)+imageTag(ref,70,y+50,240,235)+imageTag(old,420,y+37,300,300)+imageTag(art,state==='stabilized'?828:810,y+10,state==='stabilized'?256:300,state==='stabilized'?320:300);
}
await sharp(svg(1170,1070,`<rect width="1170" height="1070" fill="#241342"/>${comparison}`)).png().toFile(`${review}/comparison-1170.png`);
await sharp(svg(1152,384,states.map((s,i)=>imageTag(papers[s],i*384,0,384,384)).join(''))).png().toFile(`${review}/paper-only-three-states.png`);
await fs.writeFile(`${out}/proposal-registration.json`,JSON.stringify({status:'static proposal only; requires visual review before animation/runtime',source:'approved03 top-left receipt panel; old439 used ONLY as negative comparison',layers:records,originalReceiptFacts:{artifactCode:'RET-031',boxCode:'P03',signature:null},notIntegrated:true},null,2)+'\n');
await fs.writeFile(`${review}/index.html`,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>收据重画 · 静态审核</title><style>body{margin:0;background:#241342;color:#ffe0a5;font:16px sans-serif}main{max-width:1170px;margin:auto;padding:20px}img{max-width:100%;height:auto}section{display:flex;gap:12px;flex-wrap:wrap}section img{width:390px;max-width:100%}a{color:#83dce8}</style><main><h1>收据重画静态候选</h1><p>未接运行存档；旧18态和其他五件素材未改。C玻璃仅为Museum既有容器的上下文演示，纸面PNG不含玻璃或夹具。</p><img src="comparison-1170.png" alt="认可原稿、拒绝旧版、新静态三态对照"><h2>390×844实际像素静态画面</h2><section>${states.map(s=>`<img src="receipt-${s}-390.png" alt="${s}静态候选">`).join('')}</section><h2>纸面本体，夹具与玻璃之外</h2><img src="paper-only-three-states.png" alt="三态纸面同框，不含机械夹具或玻璃"><p>原字保留RET-031、P03，签收仍为空。后续动画须在视觉审核后再做。</p></main>`);
console.log('Static receipt proposal exported; no current runtime/save/economy files modified.');
