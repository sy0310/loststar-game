import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {prepareRenewalRobot,drawRenewalRobot} from '../src/render/renewal-robot';
import {museumSpace,translatedRect,museumSupportBounds,physicalMuseumExhibits,museumCaseGeometry} from '../src/render/museum-space';
import {museumServicePose} from '../src/render/museum-service';
import {RenewalMuseum} from '../src/render/renewal-museum';

type Point={x:number;y:number};type Matrix=[number,number,number,number,number,number];
type Alpha={width:number;height:number;left:number;top:number;right:number;bottom:number};
const alpha=new Map<string,Alpha>();
const imageData=new Map<string,string>();
class TestImage {src='';decode(){return Promise.resolve();}}
/** Records the renderer's real transforms and source alpha bounds. It does not
 * reimplement the pose or copy the rig's hard-coded limb placements. */
class AlphaContext {
 matrix:Matrix=[1,0,0,1,0,0];lineWidth=1;stack:{matrix:Matrix;lineWidth:number}[]=[];path:Point[]=[];
 points:Point[]=[];links:number[]=[];wrists:Point[]=[];
 drawings:string[]=[];fillStyle='#fff';strokeStyle='#fff';constructor(private capture=false){}
 save(){this.stack.push({matrix:[...this.matrix],lineWidth:this.lineWidth});}
 restore(){const s=this.stack.pop()!;this.matrix=s.matrix;this.lineWidth=s.lineWidth;}
 transform(a:number,b:number,c:number,d:number,e:number,f:number){const m=this.matrix;this.matrix=[m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,m[0]*e+m[2]*f+m[4],m[1]*e+m[3]*f+m[5]];}
 translate(x:number,y:number){this.transform(1,0,0,1,x,y);}scale(x:number,y:number){this.transform(x,0,0,y,0,0);}rotate(a:number){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);}
 point(x:number,y:number){const m=this.matrix;return{x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};}
 corners(x:number,y:number,w:number,h:number){return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>this.point(a,b));}
 drawImage(image:TestImage,x:number,y:number,w:number,h:number){const id=image.src.split('/').at(-1)!.split('?')[0],a=alpha.get(id)!;this.points.push(...this.corners(x+a.left/a.width*w,y+a.top/a.height*h,(a.right-a.left)/a.width*w,(a.bottom-a.top)/a.height*h));if(id==='robot-grip-hand.webp')this.wrists.push(this.point(0,0));if(this.capture)this.drawings.push(`<image href="${imageData.get(id)}" x="${x}" y="${y}" width="${w}" height="${h}" transform="matrix(${this.matrix.join(' ')})"/>`);}
 fillRect(x:number,y:number,w:number,h:number){const points=this.corners(x,y,w,h);this.points.push(...points);if(this.capture)this.drawings.push(`<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${this.fillStyle}"/>`);}
 beginPath(){this.path=[];}moveTo(x:number,y:number){this.path.push(this.point(x,y));}lineTo(x:number,y:number){this.path.push(this.point(x,y));}
 arc(x:number,y:number,r:number){this.path.push(...this.corners(x-r,y-r,r*2,r*2));}
 ellipse(x:number,y:number,rx:number,ry:number,rotation:number){for(let i=0;i<64;i++){const t=i/64*Math.PI*2,a=Math.cos(t)*rx,b=Math.sin(t)*ry;this.path.push(this.point(x+a*Math.cos(rotation)-b*Math.sin(rotation),y+a*Math.sin(rotation)+b*Math.cos(rotation)));}}
 strokeRect(x:number,y:number,w:number,h:number){this.path=this.corners(x,y,w,h);this.stroke();}
 stroke(){const m=this.matrix,pad=this.lineWidth/2*Math.max(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3]));for(const p of this.path)this.points.push({x:p.x-pad,y:p.y-pad},{x:p.x+pad,y:p.y+pad});if(this.path.length===2)this.links.push(Math.hypot(this.path[1].x-this.path[0].x,this.path[1].y-this.path[0].y));if(this.capture)this.drawings.push(`<polyline points="${this.path.map(p=>`${p.x},${p.y}`).join(' ')}" stroke="${this.strokeStyle}" stroke-width="${pad*2}" stroke-linecap="round" fill="none"/>`);}
 fill(){if(this.fillStyle==='#100b2480')return;this.points.push(...this.path);if(this.capture)this.drawings.push(`<polygon points="${this.path.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${this.fillStyle}"/>`);}
 get bounds(){return{left:Math.min(...this.points.map(p=>p.x)),top:Math.min(...this.points.map(p=>p.y)),right:Math.max(...this.points.map(p=>p.x)),bottom:Math.max(...this.points.map(p=>p.y))};}
}
function draw(seconds:number,facing:number,service=false,capture=false){
 const p=service?museumServicePose(seconds,()=>3):{...museumServicePose(seconds,()=>3),x:384,y:900,facing,contact:0,lift:0,armDeployment:0,action:'walk' as const};
 if(!service){p.actorBounds=translatedRect(museumSpace.transit,p);p.feetBounds=translatedRect(museumSpace.feet,p);}
 const c=new AlphaContext(capture),ratio=136/144,flip=p.facing>0,rigX=p.x+(flip?2:-2)/ratio,local=(a:Point)=>({x:p.x+(a.x-p.x)/ratio,y:p.y+(a.y-p.y)/ratio});
 c.translate(p.x,p.y);c.scale(ratio,ratio);c.translate(-p.x,-p.y);
 drawRenewalRobot(c as unknown as CanvasRenderingContext2D,{x:rigX,y:p.y,action:service?'pickup':'walk',facing:flip?'right':'left',carrying:service,parcel:{...local(p.item),held:service,visible:service,delivered:false},lift:p.lift,release:0},.62,{workSeconds:seconds,received:0,appliedWorkMs:0,assistRate:0},{hands:service?p.hands.map(local) as[Point,Point]:undefined,flip,bob:0,museum:{stowed:!service,service:service?p.armDeployment:0,armLengths:[49,48]}});
 return{c,p};
}
beforeAll(async()=>{
 for(const name of ['head','torso','scanner-hand','grip-hand','leg-left','leg-right']){
  const {data,info}=await sharp(`assets/runtime/visual-renewal/world/robot-${name}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=0,bottom=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  alpha.set(`robot-${name}.webp`,{width:info.width,height:info.height,left,top,right,bottom});
  if(process.env.MUSEUM_ENVELOPE_OUTPUT)imageData.set(`robot-${name}.webp`,`data:image/png;base64,${(await sharp(data,{raw:info}).png().toBuffer()).toString('base64')}`);
 }
 vi.stubGlobal('Image',TestImage);await prepareRenewalRobot();
});
afterAll(async()=>{
 const output=process.env.MUSEUM_ENVELOPE_OUTPUT;
 if(output){
  const samples=[draw(.3,-1,false,true),draw(.3,1,false,true),draw(49.8,-1,true,true)];
  const groups=samples.map(({c,p},i)=>{
   const b=c.bounds,relative=(r:{left:number;top:number;right:number;bottom:number},color:string)=>`<rect x="${r.left-p.x}" y="${r.top-p.y}" width="${r.right-r.left}" height="${r.bottom-r.top}" stroke="${color}" fill="none" stroke-width="1"/>`;
   return `<g transform="translate(${160+i*320} 265)"><g transform="translate(${-p.x} ${-p.y})">${c.drawings.join('')}</g>${relative(p.actorBounds,'#68dafa')}${relative(p.feetBounds,'#ffbf69')}${relative(b,'#d6ffab')}${i===2?relative(p.itemBounds,'#ed8ccc'):''}<text x="0" y="-190" text-anchor="middle" fill="#ffe0a0" font-size="16">${i===2?'SERVICE / REGISTERED GRIPS':i?'WALK / MIRRORED':'WALK / SOURCE ORIENTATION'}</text><text x="0" y="35" text-anchor="middle" fill="#e5d8ef" font-size="14">alpha+joint ${((b.right-b.left)).toFixed(2)} x ${(b.bottom-b.top).toFixed(2)}</text>${c.wrists.map(a=>`<circle cx="${a.x-p.x}" cy="${a.y-p.y}" r="2" fill="#fff36d"/>`).join('')}</g>`;
  });
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="380" viewBox="0 0 960 380"><rect width="960" height="380" fill="#241342"/><g font-family="monospace">${groups.join('')}<text x="480" y="345" text-anchor="middle" fill="#d9c8df" font-size="14">cyan: transit registration | gold: feet | green: rendered alpha/joints | magenta: item registration</text><text x="480" y="366" text-anchor="middle" fill="#b79dce" font-size="12">Internal transform/alpha diagnostic. Not a phone screenshot and not visual acceptance.</text></g></svg>`;
  await mkdir(dirname(output),{recursive:true});await sharp(Buffer.from(svg)).png().toFile(output);await writeFile(`${output}.json`,JSON.stringify(samples.map(({c,p})=>({target:p.target,phase:p.servicePhase,facing:p.facing,rendered:c.bounds,registered:p.actorBounds,feet:p.feetBounds,hands:p.hands})),null,2));
 }
 vi.unstubAllGlobals();
});
describe('actual museum rig envelope',()=>{
 it('contains every transformed alpha rectangle and drawn joint in the registered transit envelope',()=>{
  for(const facing of [-1,1])for(let frame=0;frame<=100;frame++){
   const {c,p}=draw(frame/100*Math.PI*2/8,facing),b=c.bounds;
   expect(b.left-p.x).toBeGreaterThanOrEqual(museumSpace.transit.left);expect(b.right-p.x).toBeLessThanOrEqual(museumSpace.transit.right);
   expect(b.top-p.y).toBeGreaterThanOrEqual(museumSpace.transit.top);expect(b.bottom-p.y).toBeLessThanOrEqual(museumSpace.transit.bottom);
  }
 });
 it('keeps real fixed arm links finite and both rendered wrist origins on the registered object contacts',()=>{
  for(let visit=0;visit<6;visit++)for(const phase of [6.8,7.1,7.5,7.8,8.2,8.8,9.05]){
   const {c,p}=draw(visit*14+phase,-1,true);expect(c.links.length).toBeGreaterThanOrEqual(4);
   for(const length of c.links)expect(length).toBeLessThanOrEqual(49*.85+.001);
   for(let i=0;i<2;i++)expect(Math.hypot(c.wrists[i].x-p.hands[i].x,c.wrists[i].y-p.hands[i].y)).toBeLessThan(.001);
  }
 });
 it('contains the real tray/support solids, including their true lower front edge',()=>{
  const museum=new RenewalMuseum();
  for(const e of physicalMuseumExhibits)for(const level of [0,1,2,3]){
   const g=museumCaseGeometry(e,level),c=new AlphaContext();museum.drawSupport(c as unknown as CanvasRenderingContext2D,e,level,g.floor,0);
   const actual=c.bounds,registered=translatedRect(museumSupportBounds(e.id,level),{x:e.x,y:g.floor});
   expect(actual.left).toBeGreaterThanOrEqual(registered.left);expect(actual.right).toBeLessThanOrEqual(registered.right);
   expect(actual.top).toBeGreaterThanOrEqual(registered.top);expect(actual.bottom).toBeLessThanOrEqual(registered.bottom);
   expect(actual.bottom).toBeCloseTo(g.floor-1,8);
  }
 });
});
