import {expect,it} from 'vitest';
import {
  advanceReceiptTransition,
  fitReceiptSpecimen,
  receiptPaperRig,
  receiptRevealAt,
} from '../src/render/receipt-specimen';

const frame=66.92682926829268;

it('纸卷以原生比例等比装入原包络，四档保持同中心和最大高度',()=>{
  for(const shape of [{width:192,height:241},{width:186,height:238},{width:201,height:248}]){
    const fit=fitReceiptSpecimen(shape.width,shape.height,frame);
    expect(fit.width/fit.height).toBeCloseTo(shape.width/shape.height,10);
    expect(fit.height).toBeCloseTo(frame,10);
    expect(fit.left+fit.width/2).toBeCloseTo(0,10);
    expect(fit.top+fit.height/2).toBeCloseTo(0,10);
  }
});

it('九条纸带共享节点，铰点固定且局部卷边有动作，连续运行不越包络或翻折',()=>{
  const options={frame,paperWidth:53.32,hingeV:.12,curlV:.78,reveal:1};
  let previous=receiptPaperRig(0,options);
  const samples:number[]=[];
  for(let t=.02;t<=12;t+=.02){
    const rig=receiptPaperRig(t,options);
    expect(rig.nodes).toHaveLength(10);
    expect(rig.nodes[0]).toEqual({x:0,y:-frame/2});
    expect(rig.nodes[9]).toEqual({x:0,y:frame/2});
    rig.nodes.forEach((node,i)=>{
      expect(Math.abs(node.x)+options.paperWidth/2).toBeLessThanOrEqual(frame/2);
      expect(node.y).toBeGreaterThanOrEqual(-frame/2);
      expect(node.y).toBeLessThanOrEqual(frame/2);
      expect(Math.hypot(node.x-previous.nodes[i].x,node.y-previous.nodes[i].y)).toBeLessThan(.12);
      if(i)expect(node.y-rig.nodes[i-1].y).toBeGreaterThan(6);
    });
    samples.push(rig.nodes[7].x);previous=rig;
  }
  expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(.5);
});

it('切档从现纸卷开始显影，阶段边缘连续，常态不会持续做整图交叉淡化',()=>{
  const first=advanceReceiptTransition(undefined,0,0,1);
  const change=advanceReceiptTransition(first,1,2,1);
  expect(change.fromLevel).toBe(0);expect(change.mix).toBe(0);
  const middle=advanceReceiptTransition(change,1,2.45,1);
  expect(middle.mix).toBeGreaterThan(0);expect(middle.mix).toBeLessThan(1);
  const done=advanceReceiptTransition(middle,1,4,1);
  expect(done.mix).toBe(1);
  expect(advanceReceiptTransition(done,1,50,1).mix).toBe(1);
  for(const v of [0,.25,.5,.75,1]){
    expect(receiptRevealAt(0,v)).toBe(0);expect(receiptRevealAt(1,v)).toBe(1);
    expect(Math.abs(receiptRevealAt(.5001,v)-receiptRevealAt(.5,v))).toBeLessThan(.002);
  }
});
it('位于纸带内部的真实铰点也保持固定',()=>{
  const hingeV=39/239,position=hingeV*9,band=Math.floor(position),fraction=position-band;
  for(let t=0;t<4;t+=.05){
    const rig=receiptPaperRig(t,{frame,paperWidth:53.32,hingeV,curlV:.795,reveal:1});
    const a=rig.nodes[band],b=rig.nodes[band+1];
    expect(a.x+(b.x-a.x)*fraction).toBeCloseTo(0,10);
    expect(a.y+(b.y-a.y)*fraction).toBeCloseTo((hingeV-.5)*frame,10);
  }
});
