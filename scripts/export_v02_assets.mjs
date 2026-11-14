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
await sharp(new URL('museum-room-spaced-v02.png',src).pathname).resize(768,960,{kernel:'nearest',fit:'fill'}).webp({quality:91}).toFile(new URL('museum-room-v02.webp',out).pathname);
await writeFile(new URL('v02-metadata.json',out),JSON.stringify({tool:'image_gen.imagegen',export:'nearest; cropped original sheets; no concepts used as sprites',files},null,2)+'\n');
console.log('Exported 12 transparent case layers and one empty room.');

const habitatSource=new URL('habitats-v02.png',src).pathname,hm=await sharp(habitatSource).metadata();
for(const [i,id] of ['mouse','hermit','tagbird'].entries())await sharp(habitatSource).extract({left:0,top:Math.floor(i*hm.height/3),width:hm.width,height:Math.floor(hm.height/3)}).resize(720,240,{kernel:'nearest',fit:'fill'}).webp({quality:92}).toFile(new URL('habitat-'+id+'-v02.webp',out).pathname);

const invaderSource=new URL('invader-v02.png',src).pathname,im=await sharp(invaderSource).metadata(),poses=[];
for(let i=0;i<4;i++)poses.push({input:await sharp(invaderSource).extract({left:Math.floor((i%2)*im.width/2),top:Math.floor(Math.floor(i/2)*im.height/2),width:Math.floor(im.width/2),height:Math.floor(im.height/2)}).resize(192,192,{kernel:'nearest',fit:'fill'}).png().toBuffer(),left:(i%2)*192,top:Math.floor(i/2)*192});
await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite(poses).webp({quality:94,alphaQuality:100}).toFile(new URL('invader-v02.webp',out).pathname);
