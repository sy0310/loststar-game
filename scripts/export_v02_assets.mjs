import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
const base=new URL('../assets/',import.meta.url),src=new URL('src/generated/',base),out=new URL('runtime/',base);await mkdir(out,{recursive:true});
const files={};
for(const [sheet,names] of [['glass-a-v02.png',['receipt','tape']],['glass-b-v02.png',['nested','stamp']],['glass-c-v02.png',['cosmic-parcel','bell']]]){
 const path=new URL(sheet,src).pathname,m=await sharp(path).metadata();
 for(let col=0;col<2;col++)for(let row=0;row<2;row++){
  const name=`case-${names[col]}-${row?'front':'back'}.webp`;
  await sharp(path).extract({left:Math.floor(col*m.width/2),top:Math.floor(row*m.height/2),width:Math.floor(m.width/2),height:Math.floor(m.height/2)}).resize(320,320,{kernel:'nearest',fit:'fill'}).webp({quality:94,alphaQuality:100}).toFile(new URL(name,out).pathname);files[name]={source:sheet,column:col,row};
 }
}
await sharp(new URL('museum-room-v02.png',src).pathname).resize(768,960,{kernel:'nearest',fit:'fill'}).webp({quality:91}).toFile(new URL('museum-room-v02.webp',out).pathname);
await writeFile(new URL('v02-metadata.json',out),JSON.stringify({tool:'image_gen.imagegen',export:'nearest; cropped original sheets; no concepts used as sprites',files},null,2)+'\n');
console.log('Exported 12 transparent case layers and one empty room.');
