export interface RadarVisual {stage:'searching'|'anomaly'|'locking'|'surveyed';progress:number}

// Essential status animation uses Canvas2D, independent of conic-gradient and
// the global reduced-motion CSS override that froze the previous sweep.
export class RadarScene {
  readonly canvas=document.createElement('canvas');
  private context:CanvasRenderingContext2D|null;
  private active=false;
  private last=0;
  private frames=0;
  constructor(parent:HTMLElement,private getStatus:()=>RadarVisual){
    this.canvas.id='radar-canvas';this.canvas.width=480;this.canvas.height=480;
    this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','退件平原地表雷达：扫描扇区、扩散波与真实本地回波');
    parent.prepend(this.canvas);this.context=this.canvas.getContext('2d');
    parent.dataset.renderer=this.context?'canvas2d':'static-fallback';
    this.canvas.dataset.frame='0';requestAnimationFrame(this.loop);
  }
  setActive(value:boolean){this.active=value;this.last=0;if(value)this.draw(performance.now());}
  private loop=(now:number)=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(this.active&&!document.hidden&&now-this.last>=(reduced?100:40)){this.last=now;this.draw(now);}
    requestAnimationFrame(this.loop);
  };
  private draw(now:number){
    const c=this.context;if(!c)return;
    const t=now/1000,status=this.getStatus(),radius=218,angle=t*Math.PI/4;
    c.clearRect(0,0,480,480);c.save();c.translate(240,240);c.imageSmoothingEnabled=false;
    c.beginPath();c.arc(0,0,232,0,Math.PI*2);c.clip();
    c.fillStyle='#142f3d';c.fillRect(-240,-240,480,480);
    // A stepped fan stays visible on WebViews that do not render conic gradients.
    for(let i=0;i<16;i++){
      c.fillStyle=`rgba(105,255,205,${.02+(16-i)/16*.18})`;c.beginPath();c.moveTo(0,0);c.arc(0,0,radius,angle-i*.045,angle-(i+1)*.045,true);c.closePath();c.fill();
    }
    c.lineWidth=2;c.strokeStyle='#85cdbc55';
    for(const r of [62,122,182,218]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
    c.strokeStyle='#78cfb94d';c.beginPath();c.moveTo(-218,0);c.lineTo(218,0);c.moveTo(0,-218);c.lineTo(0,218);c.stroke();
    for(let i=0;i<3;i++){
      const phase=(t*.3+i/3)%1;c.strokeStyle=`rgba(135,255,219,${(1-phase)*.55})`;c.lineWidth=3;c.beginPath();c.arc(0,0,22+phase*196,0,Math.PI*2);c.stroke();
    }
    c.strokeStyle='#c3ffe2';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);c.stroke();
    for(let i=0;i<18;i++){
      const theta=i*2.4,r=50+(i*37)%150,a=.1+.12*Math.max(0,Math.cos(theta-angle));
      c.fillStyle=`rgba(150,240,210,${a})`;c.fillRect(Math.round(Math.cos(theta)*r),Math.round(Math.sin(theta)*r),2,2);
    }
    if(status.stage==='anomaly'||status.stage==='locking'){
      // This is a measured return on the known planet, never an unknown world node.
      const x=62,y=-72,pulse=17+Math.sin(t*5)*4;
      c.strokeStyle=status.stage==='locking'?'#ffe4a0':'#b4ffe3';c.lineWidth=3;c.beginPath();c.arc(x,y,pulse,0,Math.PI*2);c.stroke();
      c.fillStyle='#f9e3a3';c.fillRect(x-4,y-4,8,8);
      if(status.stage==='locking'){
        const gap=30-8*Math.sin(t*2)**2;c.setLineDash([10,5]);c.strokeRect(x-gap,y-gap,gap*2,gap*2);c.setLineDash([]);
        c.beginPath();c.arc(x,y,24,-Math.PI/2,-Math.PI/2+Math.PI*2*status.progress/100);c.stroke();
      }
    }
    if(status.stage==='surveyed'){
      c.strokeStyle='#ffda94';c.lineWidth=4;const pulse=45+(t%1.8)/1.8*135;c.globalAlpha=1-(t%1.8)/1.8;c.beginPath();c.arc(0,0,pulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;
      c.fillStyle='#ffe3a7';for(let i=0;i<8;i++){const a=i*Math.PI/4;c.fillRect(Math.round(Math.cos(a)*68),Math.round(Math.sin(a)*68),4,4);}
    }
    c.restore();this.canvas.dataset.frame=String(++this.frames);this.canvas.dataset.stage=status.stage;
  }
}
