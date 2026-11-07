/** Read-only receipt I/II proposal. No game/save import, no records are granted. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
const root='assets/runtime/visual-renewal/receipt-proposal',out='artifacts/receipt-redesign-static';
const img=async(name,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${(await fs.readFile(`${root}/${name}.png`)).toString('base64')}"/>`;
const svg=(w,h,s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:'PingFang SC',sans-serif}</style>${s}</svg>`);
const text=(s,x,y,size=14,color='#f5dab8')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}">${s}</text>`;
const paper=await img('paper-stabilized',38,136,314,314),back=await img('archive-holder-back',38,136,314,353.25),front=await img('archive-holder-front',38,136,314,353.25);
const states=[{name:'未研究 · 免费读票',mode:'读票',record:'RET-031 · P03',line:'仅读原有票面；空签收保持空。',scan:178},{name:'本体Ⅰ · 主动对照',mode:'Ⅰ 对照',record:'P03  0° · 已记录',line:'实际箱标齐全时，核验6轮→3轮。',scan:195},{name:'本体Ⅱ · 自动核验',mode:'Ⅱ 自动',record:'P03 ↔ P30 · 已记录',line:'自动核验实际箱标；无来源就等待。',scan:216}];
const buffers=[];
for(const [i,s]of states.entries()){
 // The scan remains within existing printed rows, above the empty signature field.
 const band=`<path d="M111 ${s.scan}L277 ${s.scan+3}" stroke="#68dafa" stroke-width="5" opacity=".35"/><path d="M111 ${s.scan+1}L277 ${s.scan+4}" stroke="#b4ffff" stroke-width="1.2"/>`;
 const module=`<path d="M113 424V432M277 424V432" stroke="#a76b42" stroke-width="5"/><rect x="112" y="432" width="168" height="36" rx="3" fill="#3c254d" stroke="#e3a454" stroke-width="3"/><rect x="118" y="437" width="156" height="24" fill="#182c38"/>${text(s.mode,122,447,8,'#7de1e9')}${text(s.record,122,458,9,'#c4fbf2')}`;
 const scene=svg(390,844,`<rect width="390" height="844" fill="#241342"/><rect x="8" y="8" width="374" height="828" fill="none" stroke="#b88353"/>${text(s.name,20,40,18)}${text('单张票据 · 无新增纸翼',20,72,13,'#c7b9d2')}${back}${paper}${band}${front}${module}${text(s.line,20,548,13)}${text('读数来自既有观测，不写入新签收或奖励。',20,578,12)}${text('静态能力方案，Ⅱ框的P30仅示意已有真实记录时',20,622,11,'#c7b9d2')}${text('未取得该记录时显示「等待现场线索」。',20,642,11,'#c7b9d2')}${text('独立电子读数夹在归档架上；纸面与字迹固定。',20,684,11,'#c7b9d2')}${text('静态方案 · 非实机截图 · 未接存档',20,812,12,'#c7b9d2')}`);
 const buf=await sharp(scene).png().toBuffer();await fs.writeFile(`${out}/receipt-reading-${i}-390.png`,buf);buffers.push({input:buf,left:i*390,top:0});
}
await sharp({create:{width:1170,height:844,channels:4,background:'#241342'}}).composite(buffers).png().toFile(`${out}/receipt-reading-ability-proposal.png`);
console.log('Receipt reading proposal written, no runtime state changed.');
