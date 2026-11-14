import sharp from 'sharp';import fs from 'node:fs/promises';
const source='assets/source/visual-renewal/mechanisms-v042',out='assets/runtime/visual-renewal/mechanisms-v042';
const fibers=await sharp(`${source}/tape-lint-mat-v3.png`).trim({threshold:12}).resize(54,70,{fit:'fill',kernel:'nearest'}).png().toBuffer();
const oxidation=await sharp(`${source}/material-deposits-v1.png`).metadata();const half=Math.floor(oxidation.width/2);
const patinaCell=await sharp(`${source}/material-deposits-v1.png`).extract({left:half,top:0,width:half,height:oxidation.height}).png().toBuffer();
const patina=await sharp(patinaCell).trim({threshold:12}).resize(191,113,{fit:'fill',kernel:'nearest'}).png().toBuffer();
for(const [id,image,left,top]of [['tape',fibers,112,197],['bell',patina,91,158]]){
 if(process.argv.includes('--tape-only')&&id!=='tape')continue;
 const bytes=await sharp({create:{width:384,height:384,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:image,left,top}]).png().toBuffer();await fs.writeFile(`${out}/${id}-deposits.png`,bytes);await sharp(bytes).webp({lossless:true,effort:4}).toFile(`${out}/${id}-deposits.webp`);
}
