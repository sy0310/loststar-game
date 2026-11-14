import globeUrl from '../../assets/runtime/visual-renewal/world/globe.webp';
export interface MapSource {stage:string;progress:number;records:Array<{id:string;name:string;x:number;y:number}>;research:number;}
/** Only confirmed records have coordinates. The receiver draws no unknown destination nodes. */
export class StarMapScene {
 readonly canvas=document.createElement('canvas');private c:CanvasRenderingContext2D|null;private active=false;private last=0;private globe=new Image();
 constructor(root:HTMLElement,private source:()=>MapSource){this.canvas.width=640;this.canvas.height=500;this.canvas.id='star-map-canvas';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','已确认航路与持续采样中的未知宇宙；未定位信号没有坐标');root.append(this.canvas);this.c=this.canvas.getContext('2d');this.globe.src=globeUrl;requestAnimationFrame(this.loop);}
 setActive(v:boolean){this.active=v;if(v)this.draw(performance.now()/1000);}
 private loop=(ms:number)=>{if(this.active&&!document.hidden&&ms-this.last>=(matchMedia('(prefers-reduced-motion: reduce)').matches?100:50)){this.last=ms;this.draw(ms/1000);}requestAnimationFrame(this.loop);};
 private draw(t:number){const c=this.c;if(!c)return;const s=this.source();c.imageSmoothingEnabled=false;c.fillStyle='#231438';c.fillRect(0,0,640,500);
  const g=c.createRadialGradient(310,220,10,310,220,350);g.addColorStop(0,'#75417155');g.addColorStop(1,'#211333');c.fillStyle=g;c.fillRect(0,0,640,500);
  c.strokeStyle='#c18ca825';c.lineWidth=1;for(let x=0;x<640;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,500);c.stroke();}for(let y=0;y<500;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(640,y);c.stroke();}
  c.save();c.translate(320,250);for(let i=0;i<14;i++){const angle=t*.33-i*.035;c.fillStyle=`rgba(185,150,235,${.02+i*.004})`;c.beginPath();c.moveTo(0,0);c.arc(0,0,300,angle,angle+.035);c.fill();}
  c.strokeStyle='#d5b27666';for(const r of [95,175,250]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}c.restore();
  if(s.stage==='anomaly'||s.stage==='locating'){c.fillStyle=`rgba(255,206,144,${.035+.02*Math.sin(t*3)})`;c.fillRect(0,0,640,500);c.strokeStyle='#fbd59977';c.beginPath();c.arc(320,250,175+Math.sin(t*3)*5,0,Math.PI*2);c.stroke();}
  for(const r of s.records){const x=60+r.x*520,y=50+r.y*370;c.strokeStyle='#ffdd9677';c.beginPath();c.ellipse(x,y,43,17,-.3,t*.3,t*.3+Math.PI*1.8);c.stroke();if(r.id==='parcel'&&this.globe.complete&&this.globe.naturalWidth)c.drawImage(this.globe,x-34,y-34,68,68);else{c.fillStyle='#dcb0ed';c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.fill();}c.textAlign='center';c.font='19px monospace';c.fillStyle='#fff0cd';c.fillText(r.name,x,y+58);}
  c.fillStyle='#dcc4e6';c.font='16px monospace';c.textAlign='left';c.fillText('RX / 持续采样',23,29);c.textAlign='right';c.fillStyle=s.research?'#ffe0a1':'#bc9fcc';c.fillText(`接收器 ${s.research?'◆'.repeat(s.research):'●'}  ${s.progress}%`,614,477);this.canvas.dataset.stage=s.stage;this.canvas.dataset.frame=String(Math.round(t*20));
 }
}
