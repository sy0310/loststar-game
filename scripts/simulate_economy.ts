import {newGame,advance,upgrade,cost,type SaveData,type UpgradeId} from '../src/game/engine';
import {buyGrowth,growthCatalog} from '../src/game/growth';
import {writeFileSync,mkdirSync} from 'node:fs';
// Candidate finite costs, simulated before copying them into the live progression model.
const prices={case:[160,480,1100],habitat:[240,700],light:[280,720,1400],dock:[320,850,1600],guard:[280,760,1500],receiver:[420,1050,2200],drive:[480,1200,2600],decoration:[450,900,1500,2400]};
const final=process.argv.includes('--final');
const minutes=[0,5,15,30,60,120],START=1800000000000,core:UpgradeId[]=['scanner','recycler','radar','cargo'];
type Plan='no-spend'|'old-workshop'|'gentle-collector'|'stellar-research'|'museum-guardian';
function simulate(plan:Plan,opening=120,old=false){
 let s:SaveData=newGame(START);s.resources=opening;if(old)s.upgrades={scanner:5,recycler:5,radar:5,cargo:5};
 let spent=0,coreFinished:number|null=old?0:null;const levels:Record<string,number>={},rows:unknown[]=[];
 const intents=plan==='gentle-collector'?[...Array.from({length:6},(_,i)=>`case-${i}`),'habitat-0','habitat-1','habitat-2','light','deco-0']:
  plan==='stellar-research'?['receiver','drive',...Array.from({length:6},(_,i)=>`case-${i}`),'dock','light','guard-0','guard-1','habitat-0','habitat-1','habitat-2','deco-0','deco-1','deco-2','deco-3']:
  [...Array.from({length:6},(_,i)=>`case-${i}`),'guard-0','guard-1','habitat-0','habitat-1','habitat-2','light','dock','receiver','drive','deco-0','deco-1','deco-2','deco-3'];
 const target=plan==='gentle-collector'?2:5;
 for(let second=0;second<=7200;second++){
  if(second){s=advance(s,START+second*1000);if(second%15===0&&plan!=='no-spend'){
   const id=core.filter(id=>s.upgrades[id]<target).sort((a,b)=>s.upgrades[a]-s.upgrades[b])[0];
   if(id&&s.resources>=cost(s,id)){const before=s.resources;s=upgrade(s,id);spent+=before-s.resources;}
   else if(plan!=='old-workshop'){
    // Prefer broad first-level utility before deep upgrades; no recurring upkeep.
    const order=[...intents].sort((a,b)=>(levels[a]??0)-(levels[b]??0));
    for(const key of order){const level=levels[key]??0,group=key.startsWith('case')?'case':key.startsWith('habitat')?'habitat':key.startsWith('guard')?'guard':key.startsWith('deco')?'decoration':key as keyof typeof prices;
     const list=group==='decoration'?[prices.decoration[Number(key.split('-')[1])]]:prices[group],price=list[level];
     if(price!==undefined&&s.resources>=price+100){if(final){const before=s.resources;const liveId=key.startsWith('deco-')?key:key;s=buyGrowth(s,liveId,level);if(s.resources===before)continue;spent+=before-s.resources;levels[key]=level+1;}else{s.resources-=price;spent+=price;levels[key]=level+1;}break;}
    }
   }
   if(coreFinished===null&&core.every(id=>s.upgrades[id]===5))coreFinished=second;
  }}
  if(minutes.includes(second/60))rows.push({minute:second/60,opening,income:s.resources+spent-opening,spent,remaining:s.resources,core:{...s.upgrades},newUpgrades:{...levels}});
 }
 return {plan,oldBalance:old,coreFinishedMinute:coreFinished===null?null:coreFinished/60,rows};
}
const data={stage:final?'Final live purchase simulation':'Candidate-cost simulation before live integration',method:'Deterministic live engine at 1-second steps, one purchase opportunity per 15 seconds, active exploration, no ad reward or premium currency; intermediate plans are modelled choices, not user behaviour.',prices:final?growthCatalog.map(e=>({id:e.id,costs:e.costs,effect:e.effect})):prices,profiles:['no-spend','old-workshop','gentle-collector','stellar-research','museum-guardian'].map(p=>simulate(p as Plan)),legacy:[5000,20000,50000].map(balance=>simulate('museum-guardian',balance,true))};
mkdirSync('artifacts/v02',{recursive:true});writeFileSync(`artifacts/v02/economy-${final?'final':'candidate'}.json`,JSON.stringify(data,null,2)+'\n');
let md='# V0.2 经济成本模拟\n\n按当前引擎逐秒计算；主动探索、每15秒最多一次支出，无广告，无维护费。'+(final?'已使用正式成长模型逐笔购买。':'候选成本尚未写入游戏。')+'\n\n';
for(const profile of [...data.profiles,...data.legacy]){md+=`## ${profile.plan}${profile.oldBalance?' · 旧余额场景':''}\n\n| 分钟 | 初始零件 | 毛收入 | 累计消费 | 剩余 |\n|---:|---:|---:|---:|---:|\n`;for(const raw of profile.rows){const r=raw as {minute:number;opening:number;income:number;spent:number;remaining:number};md+=`| ${r.minute} | ${r.opening} | ${r.income} | ${r.spent} | ${r.remaining} |\n`;}md+=`\n四设备满级时间：${profile.coreFinishedMinute??'未在此策略中追求满级'} 分钟。\n\n`;}
writeFileSync(`artifacts/v02/economy-${final?'final':'candidate'}.md`,md);console.log(md);
