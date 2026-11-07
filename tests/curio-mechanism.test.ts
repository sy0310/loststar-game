import {afterEach,expect,test,vi} from 'vitest';import sharp from 'sharp';
import {mechanismFrame,mechanismTrialMs,mechanismAnchors} from '../src/fusion/curio-mechanism-model';
import registry from '../assets/runtime/visual-renewal/mechanisms-v042/static-registration.json';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

test('2.6秒只有一个机械时钟，帽接触才下压，触底才响，释放同步且闲置不漂',()=>{
 expect(mechanismTrialMs).toBe(2600);
 for(const t of [.18,.5,.7,.95,1.45]){const f=mechanismFrame('bell',{trial:t/2.6});expect(f.trialTime).toBeCloseTo(t);expect(f.bell!.triggered).toBe(t>=.65&&t<.8);if(t>=.35&&t<=1.05){expect(f.tool.contact).toBe(true);expect(f.tool.tip).toEqual(f.bell!.buttonTop);}else expect(f.tool.contact).toBe(false);}
 expect(mechanismFrame('bell',{seconds:0}).bell!.stroke).toBe(0);expect(mechanismFrame('bell',{seconds:9999}).bell!.stroke).toBe(0);
 for(const level of [0,1,2])for(let n=0;n<=200;n++){const f=mechanismFrame('tape',{abilityLevel:level,trial:n/200});expect(f.tape!.rollAngle).toBeCloseTo(f.tape!.length/mechanismAnchors.tape.rollRadius,12);expect(f.fixedAnchors.axis).toEqual(mechanismAnchors.tape.axis);}
});

type Matrix=[number,number,number,number,number,number];
const I=():Matrix=>[1,0,0,1,0,0];
function mul(a:Matrix,b:Matrix):Matrix{return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
class PixelCanvas{
 width=300;height=150;data=new Uint8ClampedArray();log:any[]=[];matrix=I();stack:Matrix[]=[];
 ensure(){if(this.data.length!==this.width*this.height*4)this.data=new Uint8ClampedArray(this.width*this.height*4);}
 getContext(){const self=this;return{
  save(){self.stack.push([...self.matrix]);},restore(){self.matrix=self.stack.pop()??I();},scale(x:number,y:number){self.matrix=mul(self.matrix,[x,0,0,y,0,0]);},translate(x:number,y:number){self.matrix=mul(self.matrix,[1,0,0,1,x,y]);},rotate(a:number){self.matrix=mul(self.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},transform(...v:Matrix){self.matrix=mul(self.matrix,v);},setTransform(...v:Matrix){self.matrix=v;},
  createImageData(w:number,h:number){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},getImageData(){self.ensure();return{data:self.data.slice()};},putImageData(p:{data:Uint8ClampedArray}){self.ensure();self.data.set(p.data);},clearRect(){self.ensure();self.data.fill(0);},
  drawImage(image:any,...args:number[]){self.ensure();const key=image.src?.split('/').at(-1)?.split('?')[0]??'ribbon';self.log.push({key,args,matrix:[...self.matrix],source:image instanceof PixelCanvas?image.data.slice():undefined,width:image.width,height:image.height});if(args.length===2&&image.data&&image.data.length===self.data.length)self.data.set(image.data);},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(...args:number[]){self.log.push({key:'clip-rect',args,matrix:[...self.matrix]});},clip(){},fill(){},stroke(){},ellipse(...args:number[]){self.log.push({key:'real-wave',args,matrix:[...self.matrix]});}
 };}
}
async function nativeRenderer(){
 class NativeImage{src='';naturalWidth=0;naturalHeight=0;width=0;height=0;data=new Uint8ClampedArray();async decode(){const name=this.src.split('/').at(-1)!.split('?')[0];const {data,info}=await sharp(`assets/runtime/visual-renewal/mechanisms-v042/${name}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});this.naturalWidth=this.width=info.width;this.naturalHeight=this.height=info.height;this.data=new Uint8ClampedArray(data);}}
 vi.stubGlobal('Image',NativeImage);vi.stubGlobal('document',{createElement:()=>new PixelCanvas()});
 const renderer=await import('../src/fusion/curio-mechanism-renderer');await renderer.prepareCurioMechanisms();return renderer;
}
function components(data:Uint8ClampedArray,w:number,h:number){const seen=new Uint8Array(w*h),counts:number[]=[];for(let p=0;p<w*h;p++){if(seen[p]||data[p*4+3]<128)continue;let n=0,stack=[p];seen[p]=1;while(stack.length){const at=stack.pop()!;n++;for(const next of [at-1,at+1,at-w,at+w])if(next>=0&&next<w*h&&Math.abs(next%w-at%w)<=1&&!seen[next]&&data[next*4+3]>=128){seen[next]=1;stack.push(next);}}counts.push(n);}return counts;}

test('真Canvas recorder：固定壳/孔不动，drawImage顶杆下移且指腹实画接触，波纹在触底后绘出',async()=>{
 const r=await nativeRenderer(),snapshots=[];
 for(const t of [.18,.5,.7,.95,1.45]){
  const canvas=new PixelCanvas(),c=canvas.getContext() as unknown as CanvasRenderingContext2D,result=r.drawCurioMechanism(c,'bell',{trial:t/2.6});r.drawMechanismActuator(c,'bell',result.frame);
  const plunger=canvas.log.find(x=>x.key==='bell-plunger.webp'),shell=canvas.log.find(x=>x.key==='bell-shell.webp'),collar=canvas.log.find(x=>x.key==='bell-collar-front.webp'),pad=canvas.log.find(x=>x.key==='mechanism-press-pad.webp');
  expect(plunger.args[1]/2).toBeCloseTo(59.04/2+result.frame.bell!.stroke,8);
  expect(canvas.log.some(x=>x.key==='real-wave')).toBe(t>=.65&&t<1.8);
  expect(canvas.log.some(x=>x.key==='bell-screw-thread.webp')).toBe(false);
  if(result.frame.tool.contact){const e=registry.assets.find(a=>a.id==='mechanism-press-pad')!,scale=pad.args[2]/e.width;expect(pad.args[0]+e.contact!.x*scale).toBeCloseTo(result.frame.bell!.buttonTop.x,8);expect(pad.args[1]+e.contact!.y*scale).toBeCloseTo(result.frame.bell!.buttonTop.y,8);}
  snapshots.push({shell:{args:shell.args,matrix:shell.matrix},collar:{args:collar.args,matrix:collar.matrix}});
 }
 for(const snapshot of snapshots)expect(snapshot).toEqual(snapshots[0]);
},15000);

test('真Canvas recorder：轴/架不绕屏幕轴转，0/I/II实画带alpha全程仅一个连通实物且不断出口',async()=>{
 const r=await nativeRenderer();let fixed:any;
 for(const level of [0,1,2])for(const trial of [0,.12,.2,.3,.4,.6,.8,.95,1]){
  const canvas=new PixelCanvas(),result=r.drawCurioMechanism(canvas.getContext() as unknown as CanvasRenderingContext2D,'tape',{trial,abilityLevel:level});
  const body=canvas.log.find(x=>x.key==='tape-frame-back.webp'),axes=canvas.log.filter(x=>x.key==='tape-spindle.webp').map(x=>({args:x.args,matrix:x.matrix}));
  const spindle=registry.assets.find(a=>a.id==='tape-spindle')!;
  const axisDraw=canvas.log.find(x=>x.key==='tape-spindle.webp');
  // Real WebP is capped to 384, but the draw target must retain the authored 612x225 coordinate plane.
  expect(axisDraw.width).toBeLessThanOrEqual(384);expect(axisDraw.args).toEqual([0,0,spindle.width,spindle.height]);
  const journals=(spindle as unknown as {sourceJournals:number[][];worldJournals:number[][]});
  for(let i=0;i<2;i++){const [x,y]=journals.sourceJournals[i],m=axisDraw.matrix;expect(m[0]*x+m[2]*y+m[4]).toBeCloseTo(journals.worldJournals[i][0]/2,8);expect(m[1]*x+m[3]*y+m[5]).toBeCloseTo(journals.worldJournals[i][1]/2,8);}
  const state={body:{args:body.args,matrix:body.matrix},axes};if(!fixed)fixed=state;else expect(state).toEqual(fixed);
  const band=canvas.log.find(x=>x.key==='ribbon');expect(band.width*band.height).toBeLessThan(384*384/3);
  expect(components(band.source,band.width,band.height)).toHaveLength(1);
  const index=((287-174)*band.width+(96-16))*4+3;expect(band.source[index]).toBeGreaterThanOrEqual(128);
  expect(result.frame.tape!.rollAngle).toBeCloseTo(result.frame.tape!.length/52,12);
  expect(canvas.log.some(x=>/receipt-inner|blank|tape-stabilized/.test(x.key))).toBe(false);
 }
},15000);

test('能力独立ready首败后清拒绝Promise和失败Image，下次真实恢复并共享成功decode',async()=>{
 let failed:object|undefined,attempts=0,created=0;const requested:string[]=[];
 class FailingImage{src='';constructor(){created++;if(!failed)failed=this;}decode(){attempts++;requested.push(this.src);return this===failed?Promise.reject(new Error('ability-only-decode-failed')):Promise.resolve();}}
 vi.stubGlobal('Image',FailingImage);const {curioAbilityReady}=await import('../src/fusion/curio-ability-rig');await expect(curioAbilityReady()).rejects.toThrow('ability-only-decode-failed');const before=created;await expect(curioAbilityReady()).resolves.toBeUndefined();expect(created).toBeGreaterThan(before);const count=attempts;await Promise.all([curioAbilityReady(),curioAbilityReady()]);expect(attempts).toBe(count);
 const {prepareCurioTools}=await import('../src/fusion/curio-condition');await prepareCurioTools();
 expect(requested.some(url=>url.includes('mechanisms-v042/tape-frame-back'))).toBe(true);expect(requested.some(url=>url.includes('mechanisms-v042/bell-shell'))).toBe(true);
 expect(requested.some(url=>/\/(?:tape-rig-|bell-rig-|receipt-inner-blank)/.test(url))).toBe(false);
});
