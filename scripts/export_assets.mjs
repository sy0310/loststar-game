import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const src=new URL('assets/src/generated/',root),out=new URL('assets/runtime/',root);
await mkdir(out,{recursive:true});
const input=name=>new URL(name,src).pathname;
const output=name=>new URL(name,out).pathname;
await sharp(input('parcel-globe.png')).resize(768,768,{kernel:'nearest'}).webp({quality:94,alphaQuality:100}).toFile(output('parcel-globe.webp'));
await sharp(input('station.png')).resize({width:768,kernel:'nearest'}).webp({quality:90}).toFile(output('station.webp'));
const {width,height}=await sharp(input('units-sheet.png')).metadata();
const entries=[['robot',0,0],['ship',1,0],['warehouse',0,1],['mouse',1,1]];
const info={};
for(const [name,x,y] of entries){
  const quadrant=await sharp(input('units-sheet.png')).extract({left:x*width/2,top:y*height/2,width:width/2,height:height/2}).png().toBuffer();
  const buffer=await sharp(quadrant).trim({background:'#00000000',threshold:10}).png().toBuffer();
  await sharp(buffer).resize({width:256,kernel:'nearest'}).webp({quality:95,alphaQuality:100}).toFile(output(name+'.webp'));
  info[name]=await sharp(output(name+'.webp')).metadata();
}
console.log('Exported globe, station, and 4 transparent sprites.');
const itemSheet=input('items-sheet.png');
const im=await sharp(itemSheet).metadata();
for(const [name,x,y] of [['receipt',0,0],['tape',1,0],['nested',0,1],['signal',1,1]]){
 const quadrant=await sharp(itemSheet).extract({left:x*im.width/2,top:y*im.height/2,width:im.width/2,height:im.height/2}).png().toBuffer();
 const trimmed=await sharp(quadrant).trim({background:'#00000000',threshold:10}).png().toBuffer();
 await sharp(trimmed).resize({width:192,kernel:'nearest'}).webp({quality:95,alphaQuality:100}).toFile(output(name+'.webp'));
 info[name]=await sharp(output(name+'.webp')).metadata();
}
console.log('Exported 4 transparent collectible icons.');

await writeFile(new URL('assets/runtime/metadata.json',root),JSON.stringify(info,null,2)+'\n');

for (const [sheet, entries] of [
 ['parcel-ecology-v2.png', [['hermit',0,0],['tagbird',1,0],['cosmic-parcel',0,1],['stamp',1,1]]],
 ['parcel-props-v2.png', [['sorter',0,0],['bell',1,0],['night-clock',0,1],['blank-letter',1,1]]],
]) {
 const m=await sharp(input(sheet)).metadata();
 for (const [name,x,y] of entries) {
  const crop=await sharp(input(sheet)).extract({left:x*m.width/2,top:y*m.height/2,width:m.width/2,height:m.height/2}).png().toBuffer();
  const trim=await sharp(crop).trim({background:'#00000000',threshold:10}).png().toBuffer();
  await sharp(trim).resize({width:256,kernel:'nearest'}).webp({quality:94,alphaQuality:100}).toFile(output(name+'.webp'));
  info[name]=await sharp(output(name+'.webp')).metadata();
 }
}
const robotActions=await sharp(input('robot-actions-v2.png')).metadata();
const cells=[];
for(let i=0;i<8;i++){
 const x=i%4,y=Math.floor(i/4),cw=robotActions.width/4,ch=robotActions.height/2;
 const cell=await sharp(input('robot-actions-v2.png')).extract({left:Math.round(x*cw),top:Math.round(y*ch),width:Math.floor(cw),height:Math.floor(ch)}).resize(160,160,{fit:'fill',kernel:'nearest'}).png().toBuffer();
 cells.push({input:cell,left:x*160,top:y*160});
}
await sharp({create:{width:640,height:320,channels:4,background:'#00000000'}}).composite(cells).webp({quality:95,alphaQuality:100}).toFile(output('robot-actions-v2.webp'));
info['robot-actions-v2']=await sharp(output('robot-actions-v2.webp')).metadata();
await writeFile(new URL('assets/runtime/metadata.json',root),JSON.stringify(info,null,2)+'\n');
console.log('Exported phase 1 ecology, props, and aligned 8-pose robot sheet.');
const em=await sharp(input('equipment-v2.png')).metadata();
for(const [name,x,y] of [['radar',0,0],['scanner',1,0],['recycler',0,1],['cargo',1,1]]){
 const crop=await sharp(input('equipment-v2.png')).extract({left:x*em.width/2,top:y*em.height/2,width:em.width/2,height:em.height/2}).png().toBuffer();
 const trim=await sharp(crop).trim({background:'#00000000',threshold:10}).png().toBuffer();
 await sharp(trim).resize({width:192,kernel:'nearest'}).webp({quality:94,alphaQuality:100}).toFile(output('equipment-'+name+'.webp'));
 info['equipment-'+name]=await sharp(output('equipment-'+name+'.webp')).metadata();
}
await writeFile(new URL('assets/runtime/metadata.json',root),JSON.stringify(info,null,2)+'\n');
console.log('Exported 4 original pixel equipment icons.');

// Phase 1.5: independently drawn directions and empty hands for one continuous parcel.
for(const [source,name,columns,rows,cell,trim] of [
 ['ship-directions-v3.png','ship-directions-v3',2,2,256,true],
 ['robot-empty-v3.png','robot-empty-v3',4,2,160,false],
]){
 const m=await sharp(input(source)).metadata(),parts=[];
 for(let i=0;i<columns*rows;i++){
  const crop=await sharp(input(source)).extract({left:Math.round(i%columns*m.width/columns),top:Math.round(Math.floor(i/columns)*m.height/rows),width:Math.floor(m.width/columns),height:Math.floor(m.height/rows)}).png().toBuffer();
  const content=trim?await sharp(crop).trim({background:'#00000000',threshold:10}).png().toBuffer():crop;
  const buf=await sharp(content).resize(cell,cell,{fit:trim?'contain':'fill',background:'#00000000',kernel:'nearest'}).png().toBuffer();
  parts.push({input:buf,left:i%columns*cell,top:Math.floor(i/columns)*cell});
 }
 await sharp({create:{width:columns*cell,height:rows*cell,channels:4,background:'#00000000'}}).composite(parts).webp({quality:95,alphaQuality:100}).toFile(output(name+'.webp'));
 info[name]=await sharp(output(name+'.webp')).metadata();
}
await writeFile(new URL('assets/runtime/metadata.json',root),JSON.stringify(info,null,2)+'\n');
