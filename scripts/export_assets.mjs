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
