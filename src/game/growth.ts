import {tapeSpeed,bellHoldMs} from './guard-tuning';
import type {SaveData} from './engine';
export type GrowthGroup='展示'|'生态'|'设施'|'守护'|'研究'|'装饰';
export interface GrowthEntry {id:string;name:string;group:GrowthGroup;costs:number[];effect:string;requires?:string;art:string;}
// Fixed finite prices chosen after artifacts/v02/economy-candidate.md. Basic displays cost nothing.
export const growthCatalog:GrowthEntry[]=[
 ...['receipt','tape','nested','stamp','cosmic-parcel','bell'].map((art,i)=>({id:`case-${i}`,name:['收据玻璃罩','胶带玻璃罐','套娃生态柜','邮戳真空舱','宇宙封存舱','签收铃钟罩'][i],group:'展示' as const,costs:[160,480,1100],effect:'柔光底座 → 星尘内景 → 珍藏铭牌与彩色轮廓光',requires:art,art})),
 ...['mouse','hermit','tagbird'].map((art,i)=>({id:`habitat-${i}`,name:['拆箱台生态区','纸层小屋生态区','邮签枝生态区'][i],group:'生态' as const,costs:[240,700],effect:'栖息地暖灯 → 丰富纸植与微型景观',requires:art,art})),
 {id:'light',name:'收藏室照明',group:'设施',costs:[280,720,1400],effect:'逐级增添温暖环境光；可见亮度与灯带',art:'night-shift'},
 {id:'dock',name:'归航停泊站',group:'设施',costs:[320,850,1600],effect:'每级增加 30 分钟离线承载，基地泊位亮灯',art:'cosmic-parcel'},
 ...[0,1].map(i=>({id:`guard-${i}`,name:`守护位 ${i?'B':'A'} 的共鸣装置`,group:'守护' as const,costs:[280,760,1500],effect:'每级提高胶带减速或签收铃停顿时长；预演中可见光环',art:i?'bell':'tape'})),
 {id:'receiver',name:'深空接收器研究',group:'研究',costs:[420,1050,2200],effect:'每级星际采样速度 +15%；增亮接收器，缩短真实扫描',art:'stamp'},
 {id:'drive',name:'飞船勘探模块',group:'研究',costs:[480,1200,2600],effect:'每级增加 20 分钟离线承载，星际采样速度 +5%',art:'cosmic-parcel'},
 ...['星窗串灯','纸叶庭院','管理员纪念牌','旋转星仪'].map((name,i)=>({id:`deco-${i}`,name,group:'装饰' as const,costs:[[450,900,1500,2400][i]],effect:['星窗增加暖光像素串灯','入口增加纸叶植物景观','收藏室增添 LR–01 纪念铭牌','星窗增加缓慢运行的微型星仪'][i],art:'receipt'})),
];
export const growthLevel=(s:Pick<SaveData,'growth'>,id:string)=>s.growth?.[id]??0;
export function cleanGrowth(raw:unknown):Record<string,number>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const levels=raw as Record<string,unknown>;
 return Object.fromEntries(growthCatalog.flatMap(e=>{const n=levels[e.id];return typeof n==='number'&&Number.isInteger(n)&&n>0&&n<=e.costs.length?[[e.id,n]]:[];}));
}
export function buyGrowth(s:SaveData,id:string,expected:number):SaveData {
 const entry=growthCatalog.find(e=>e.id===id),level=growthLevel(s,id);if(!entry||level!==expected||level>=entry.costs.length||(entry.requires&&!s.collection.includes(entry.requires))||s.resources<entry.costs[level])return s;
 return {...s,resources:s.resources-entry.costs[level],growth:{...s.growth,[id]:level+1}};
}
export function growthEffects(s:Pick<SaveData,'growth'>){return {interstellarSpeed:1+growthLevel(s,'receiver')*.15+growthLevel(s,'drive')*.05,cargoSeconds:growthLevel(s,'dock')*1800+growthLevel(s,'drive')*1200,guard:[growthLevel(s,'guard-0'),growthLevel(s,'guard-1')] as [number,number]};}

export function growthChange(s:Pick<SaveData,'growth'>,id:string){
 const level=growthLevel(s,id),entry=growthCatalog.find(e=>e.id===id),next=Math.min(level+1,entry?.costs.length??level);
 const value=(n:number)=>{
  if(id.startsWith('case-'))return ['标准玻璃陈列','柔光底座','柔光底座 + 星尘内景','珍藏铭牌 + 彩色轮廓光'][n];
  if(id.startsWith('habitat-'))return ['基础栖息地','暖光环境','暖灯 + 纸植微景观'][n];
  if(id.startsWith('guard-'))return `减速 ${Math.round((1-tapeSpeed(n))*100)}% / 震荡 ${(bellHoldMs(n)/1000).toFixed(1)} 秒`;
  if(id==='receiver')return `星际采样 ×${(1+n*.15+growthLevel(s,'drive')*.05).toFixed(2)}`;
  if(id==='drive')return `离线承载 +${n*20}分 / 采样 ×${(1+n*.05+growthLevel(s,'receiver')*.15).toFixed(2)}`;
  if(id==='dock')return `离线承载 +${n*30} 分钟`;
  if(id==='light')return ['原有暖灯','柔和暖光','明亮暖光','收藏室灯带全亮'][n];
  return n?'已布置':'尚未布置';
 };return {before:value(level),after:value(next)};
}
