import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../assets/src/generated/refinement/',import.meta.url);
const output=new URL('../assets/runtime/refinement/',import.meta.url);
await mkdir(output,{recursive:true});
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const size=320;
const belt=[[43,213],[103,177],[161,192],[100,232]];
const front=[[32,208],[95,228],[112,212],[186,211],[189,244],[96,279],[31,255]];
const curtains=[[[108,142],[121,145],[118,177],[106,174]],[[127,146],[140,149],[137,183],[124,179]],[[146,150],[160,153],[157,189],[143,185]]];
function inside(x,y,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
const sourceBytes=await readFile(new URL('sorting-machine-v1.png',source));
const rgba=await sharp(sourceBytes).resize(size,size,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]<24)rgba.fill(0,i,i+4);
const back=Buffer.from(rgba),lip=Buffer.alloc(rgba.length),flaps=curtains.map(()=>Buffer.alloc(rgba.length));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const i=(y*size+x)*4;
 if(inside(x+.5,y+.5,front)){rgba.copy(lip,i,i,i+4);back.fill(0,i,i+4);continue;}
 const flap=curtains.findIndex(polygon=>inside(x+.5,y+.5,polygon));
 if(flap>=0){rgba.copy(flaps[flap],i,i,i+4);back.fill(0,i,i+4);continue;}
 if(inside(x+.5,y+.5,belt))back.fill(0,i,i+4);
}
const rollers=Buffer.alloc(128*96*4);
for(let y=0;y<96;y++)for(let x=0;x<128;x++){
 const u=x/127,v=y/95;
 const sx=Math.round(43+57*u+60*v),sy=Math.round(213+19*u-36*v);
 rgba.copy(rollers,(y*128+x)*4,(sy*size+sx)*4,(sy*size+sx)*4+4);
}
const files=[];
async function save(name,data,width,height){
 const bytes=await sharp(data,{raw:{width,height,channels:4}}).webp({lossless:true,exact:true,effort:6}).toBuffer();
 await writeFile(new URL(name,output),bytes);files.push({file:name,width,height,bytes:bytes.length,sha256:hash(bytes)});
}
await save('sorting-machine-back.webp',back,size,size);
await save('sorting-machine-front.webp',lip,size,size);
await save('sorting-rollers.webp',rollers,128,96);
for(let i=0;i<flaps.length;i++)await save(`sorting-curtain-${i}.webp`,flaps[i],size,size);
const jamBytes=await readFile(new URL('paper-jam-v1.png',source));
const jam=await sharp(jamBytes).resize(224,112,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
for(let i=0;i<jam.length;i+=4)if(jam[i+3]<24)jam.fill(0,i,i+4);
await save('sorting-paper-jam.webp',jam,224,112);
const registration={schema:1,generator:'OpenAI built-in image_gen',source:[{file:'sorting-machine-v1.png',sha256:hash(sourceBytes)},{file:'paper-jam-v1.png',sha256:hash(jamBytes)}],canvas:{width:size,height:size},contact:{x:116,y:279},feet:[{x:52,y:259},{x:116,y:279},{x:194,y:249},{x:259,y:219}],belt,front,curtains,rollerUV:{width:128,height:96,nearLeft:{x:43,y:213},cross:{x:57,y:19},depth:{x:60,y:-36}},labels:{p03:{x:87,y:166},p30:{x:213,y:118}},files};
await writeFile(new URL('registration.json',output),JSON.stringify(registration,null,2)+'\n');
console.log(JSON.stringify({files:files.length,runtimeBytes:files.reduce((sum,file)=>sum+file.bytes,0),registration:'assets/runtime/refinement/registration.json'}));
