import {warpModernReceiptPixels,modernReceiptPoint,modernReceiptClampContacts,type ReceiptPaperPose} from './receipt-paper-model';
export type ReceiptSprite=(id:string)=>HTMLImageElement|undefined;
const clampCrops={tl:{w:296,h:263,cx:111,cy:120},tr:{w:286,h:263,cx:166,cy:120},bl:{w:287,h:254,cx:111,cy:157},br:{w:289,h:254,cx:166,cy:156}} as const;
interface PaperCache{revision:string;pixels:Uint8ClampedArray;canvas:HTMLCanvasElement;image:ImageData;poseKey:string}
const paperCache=new WeakMap<object,PaperCache>();
/** One cached connected raster, not partially opaque overlapping strip fragments. */
export function drawModernReceiptPaper(c:CanvasRenderingContext2D,image:CanvasImageSource,pose:ReceiptPaperPose,revision='static'){
 let cache=paperCache.get(image);
 if(!cache){const canvas=document.createElement('canvas');canvas.width=canvas.height=384;const context=canvas.getContext('2d')!;cache={revision:'',pixels:new Uint8ClampedArray(384*384*4),canvas,image:context.createImageData(384,384),poseKey:''};paperCache.set(image,cache);}
 const context=cache.canvas.getContext('2d')!;
 if(cache.revision!==revision){context.clearRect(0,0,384,384);context.drawImage(image,0,0,384,384);cache.pixels.set(context.getImageData(0,0,384,384).data);cache.revision=revision;cache.poseKey='';}
 const key=`${pose.cleaning}/${pose.upper}/${pose.lower}/${pose.flex}`;
 if(cache.poseKey!==key){warpModernReceiptPixels(cache.pixels,pose,cache.image.data);context.putImageData(cache.image,0,0);cache.poseKey=key;}
 c.save();c.imageSmoothingEnabled=false;c.drawImage(cache.canvas,0,0,192,192);c.restore();
}
/** The inner jaw lies behind the paper; the purple body/front lip closes over the same edge. */
export function drawModernReceiptClamps(c:CanvasRenderingContext2D,sprite:ReceiptSprite,pose:ReceiptPaperPose,amount:number,side:'back'|'front'){
 if(amount<=.001)return;
 for(const contact of modernReceiptClampContacts){
  const image=sprite(`receipt-clamp-${contact.id}-${side}`);if(!image?.naturalWidth)continue;
  const crop=clampCrops[contact.id],p=modernReceiptPoint(contact,pose),scale=16/crop.w;
  const approach=1-amount,dx=contact.id.endsWith('l')?-1:1,dy=contact.id.startsWith('t')?-1:1;
  c.drawImage(image,p.x-crop.cx*scale+dx*approach*28,p.y-crop.cy*scale+dy*approach*16,16,crop.h*scale);
 }
}
export function drawModernReceiptHolder(c:CanvasRenderingContext2D,sprite:ReceiptSprite,side:'back'|'front'){
 const image=sprite(`receipt-holder-${side}`);if(image?.naturalWidth)c.drawImage(image,0,0,192,216);
}
