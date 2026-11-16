import {exhibitIds,type Exhibit} from './museum-layout';

export type MuseumPoint={x:number;y:number};
export type MuseumRect={left:number;top:number;right:number;bottom:number};
/** One camera registration, shared by drawing, hits, paths and collision checks.
 * The room plate contains no cabinets. These are world pixels, not CSS pixels. */
export const museumSpace={
 version:'physical-cases-v2',width:768,height:960,
 columns:[104,384,664] as const,rows:[500,825] as const,
 caseWidth:172,innerWidth:128,innerHeight:168,
 corridors:[244,524] as const,hub:{x:384,y:918},
 // Alpha rectangles of the assembled 136px rig sampled over 101 gait phases:
 // 93.95px body and 60.65px feet. The transit rig is rebased on that silhouette.
 measuredBodyWidth:93.95,measuredFeetWidth:60.65,
 transit:{left:-48,top:-121,right:48,bottom:4} as MuseumRect,
 feet:{left:-40,top:-12,right:40,bottom:5} as MuseumRect,
 clearance:6,
} as const;
export const museumBaseHeights=[44,54,62,72] as const;
export const museumCapHeights=[36,46,48,50] as const;
export const museumSourceCavities=[
 {left:59,right:260,top:59,floor:300},
 {left:63,right:249,top:72,floor:270},
 {left:60,right:239,top:77,floor:248},
 {left:70,right:234,top:80,floor:232},
] as const;
const boundedLevel=(level:number)=>Math.max(0,Math.min(3,Math.floor(level)));
export function museumCaseGeometry(exhibit:Pick<Exhibit,'x'|'y'>,level:number){
 const index=boundedLevel(level),{x,y}=exhibit,base=museumBaseHeights[index],cap=museumCapHeights[index];
 const half=museumSpace.caseWidth/2,inner=museumSpace.innerWidth/2,floor=y-base,ceiling=floor-museumSpace.innerHeight;
 return {
  level:index,x,y,width:museumSpace.caseWidth,base,cap,floor,ceiling,
  source:museumSourceCavities[index],
  bounds:{left:x-half,top:ceiling-cap,right:x+half,bottom:y+4} as MuseumRect,
  // This projected floor prism is independent of the height of the plinth.
  solid:{left:x-half,top:y-40,right:x+half,bottom:y+4} as MuseumRect,
  aperture:{left:x-inner+4,top:ceiling+7,right:x+inner-4,bottom:floor-5} as MuseumRect,
  nearLip:{left:x-inner,top:floor-5,right:x+inner,bottom:floor+5} as MuseumRect,
  plaque:{left:x-65,top:y-34,right:x+65,bottom:y-6} as MuseumRect,
  // A vertical pane retracts into its own hood, never into a side aisle.
  door:{left:x-inner,top:ceiling,right:x+inner,bottom:floor,travel:museumSpace.innerHeight},
  hitbox:{left:x-half,top:ceiling-cap,right:x+half,bottom:y+4} as MuseumRect,
 };
}
export const physicalMuseumExhibits:Exhibit[]=exhibitIds.map((id,index)=>({
 id,x:museumSpace.columns[index%3],y:museumSpace.rows[index<3?0:1],width:museumSpace.caseWidth,
 base:{x:0,y:0,w:museumSpace.caseWidth},crop:{x:-86,y:-290,w:172,h:294},
 cavity:{x:-64,y:-240,w:128,h:168},front:{x:-64,y:-240,w:128,h:168},
 item:{x:0,y:-123,size:id==='receipt'?136:id==='cosmic-parcel'?128:132},scale:1,
}));
export function translatedRect(rect:MuseumRect,point:MuseumPoint):MuseumRect{return {left:rect.left+point.x,top:rect.top+point.y,right:rect.right+point.x,bottom:rect.bottom+point.y};}
export function rectsOverlap(a:MuseumRect,b:MuseumRect,margin=0){return a.left<b.right+margin&&a.right>b.left-margin&&a.top<b.bottom+margin&&a.bottom>b.top-margin;}
export function rectClearance(a:MuseumRect,b:MuseumRect){return Math.max(a.left-b.right,b.left-a.right,a.top-b.bottom,b.top-a.bottom);}
export function museumDoorPanels(geometry:ReturnType<typeof museumCaseGeometry>,opening:number){
 const amount=Math.max(0,Math.min(1,opening)),edges=Array.from({length:6},(_,i)=>Math.round(i*museumSpace.innerHeight/5));
 return Array.from({length:5},(_,i)=>{const sourceOffset=edges[i],height=edges[i+1]-edges[i],sourceTop=geometry.ceiling+sourceOffset,shift=amount*edges[i+1];return {sourceTop,sourceOffset,height,shift,bounds:{left:geometry.door.left,top:sourceTop-shift,right:geometry.door.right,bottom:sourceTop+height-shift}};});
}
/** Bounds of the real, moving fitted tray; the glass cabinet's fixed dock is separate.
 * The soft contact shadow is not a solid surface and is excluded. */
export function museumSupportBounds(id:string,level:number):MuseumRect{
 const top=id==='receipt'?(level>=2?-90:-13):id==='tape'?-13:id==='stamp'?(level>=2?-28:-24):id==='cosmic-parcel'?(level>=2?-42:-24):id==='bell'?(level>=2?-34:-19):level>=2?-31:-22.5;
 return {left:-54,top,right:54,bottom:-1};
}
