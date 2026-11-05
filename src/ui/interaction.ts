import {discoveryById} from '../content/catalog';
import {textures} from './art';

export class InteractionDirector {
  private image:HTMLImageElement|null=null;
  private started=0;
  private frame=0;
  private replay=0;
  private id='';
  private context:CanvasRenderingContext2D|null=null;
  private element:HTMLElement|null=null;
  constructor(private root:HTMLElement,private art:(id:string)=>string=id=>textures[discoveryById(id)!.icon]){}
  show(id:string,input:string){
    this.hide();this.id=id;this.element=this.root.querySelector('#interaction-feedback');if(!this.element)return;
    const d=discoveryById(id)!;this.element.hidden=false;this.element.dataset.item=id;
    this.element.dataset.lastInput=input;this.element.dataset.replay=String(++this.replay);this.element.dataset.playing='true';
    this.root.querySelector('#interaction')!.textContent=d.interaction;
    const canvas=this.element.querySelector('canvas')!;this.context=canvas.getContext('2d');
    this.image=new Image();this.image.src=this.art(id);this.started=performance.now();this.draw(this.started);this.frame=requestAnimationFrame(this.loop);
  }
  hide(){cancelAnimationFrame(this.frame);if(this.element){this.element.hidden=true;this.element.dataset.playing='false';}this.element=null;}
  private loop=(now:number)=>{
    if(!this.element?.isConnected)return;
    this.draw(now);
    if(now-this.started<2600)this.frame=requestAnimationFrame(this.loop);else this.element.dataset.playing='false';
  };
  private draw(now:number){
    const c=this.context;if(!c)return;
    const t=Math.min(2.6,(now-this.started)/1000),p=Math.min(1,t/2.1),cycle=Math.sin(t*6);
    c.clearRect(0,0,320,180);c.imageSmoothingEnabled=false;c.fillStyle='#1b1d32';c.fillRect(0,0,320,180);
    c.strokeStyle='#726681';c.strokeRect(4,4,312,172);c.fillStyle='#28233c';c.fillRect(16,148,288,12);
    const sprite=(x=160,y=88,size=106,rotation=0)=>{if(!this.image?.complete||!this.image.naturalWidth)return;c.save();c.translate(x,y);c.rotate(rotation);c.drawImage(this.image,-size/2,-size/2,size,size);c.restore();};
    const ticket=(x:number,y:number,h:number,text:string)=>{c.fillStyle='#ffe1a1';c.fillRect(x,y,72,h);c.fillStyle='#8a5861';for(let row=0;row<h-10;row+=10)c.fillRect(x+8,y+7+row,52,2);if(h>30){c.fillStyle='#392b46';c.font='16px sans-serif';c.fillText(text,x+7,y+h-7);}};
    const ring=(x:number,y:number,r:number,alpha=1)=>{c.save();c.globalAlpha=alpha;c.strokeStyle='#c4f7e1';c.lineWidth=3;c.beginPath();c.ellipse(x,y,r,r*.6,0,0,Math.PI*2);c.stroke();c.restore();};
    switch(this.id){
      case 'receipt':sprite(132,66,100,Math.sin(t*2)*.06);ticket(176,74,18+p*72,'已收到');break;
      case 'tape':
        c.fillStyle='#c6acdd';c.fillRect(104,121,26+p*134,13);c.fillStyle='#e9ddbb';c.fillRect(104,125,26+p*134,4);sprite(90+p*25,85,106,t*.8);c.fillStyle='#a4e6d3';c.fillRect(238,102,12,12);break;
      case 'nested':
        for(let i=0;i<3;i++){const size=102-i*28;sprite(126+i*44,99-i*19*p,size,-p*.05*i);c.fillStyle=i%2?'#bf7755':'#ffe1a1';c.save();c.translate(126+i*44,65-i*19*p);c.rotate(-p*.6);c.fillRect(-size*.4,-8,size*.8,9);c.restore();}break;
      case 'stamp':sprite(156,67+Math.max(0,cycle)*27,108);if(t>.45){c.strokeStyle='#e5b387';c.lineWidth=4;c.strokeRect(200,117,87,38);c.fillStyle='#ffe4b4';c.font='24px sans-serif';c.fillText('昨日',216,145);}break;
      case 'cosmic-parcel':sprite(160,99,116,cycle*.035);c.fillStyle='#25214f';c.fillRect(114,68,92,5+p*16);for(let i=0;i<12;i++){c.fillStyle=i%3?'#e6b6ff':'#fff2ba';c.fillRect(95+(i*23)%135,86-p*(20+(i*13)%65),3+i%2,3+i%2);}break;
      case 'bell':sprite(155,92,103,cycle*.18*(1-p*.4));for(let i=0;i<3;i++){const wave=(t*.9+i/3)%1;ring(160,94,30+wave*105,1-wave);}if(t>1)ticket(225,109,48,'谢谢');break;
      case 'mouse':sprite(128+Math.sin(t*3)*14,95,111,cycle*.05);ticket(211,92,38+p*10,'空气');c.fillStyle='#e7c3af';for(let i=0;i<6;i++)c.fillRect(175+i*13,54+Math.sin(i+t*4)*20,5,3);break;
      case 'hermit':sprite(150+cycle*10,98,111,Math.sin(t*3)*.07);c.fillStyle='#f3a9bb';c.fillRect(221,43,10,10);c.fillRect(237,43,10,10);c.fillRect(225,50,18,13);c.fillRect(231,61,6,5);break;
      case 'tagbird':sprite(113+p*35,82-Math.sin(t*4)*12,100);ticket(205,96,50,'这里好');break;
      case 'night-shift':sprite(126,94,108);ticket(203,83,p*64,'准时');break;
      case 'return-request':sprite(140+p*20,100-p*30,112,Math.sin(t*2)*.1);ring(160,98,35+p*80,1-p*.5);break;
      case 'last-recipient':sprite(148,94,111,-p*.08);c.fillStyle='#d9f5d2';c.fillRect(216,91,7,30);c.fillRect(202,104,34,5);break;
    }
  }
}
