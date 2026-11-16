import {nightResult,simulateNight,type NightConfig} from '../src/prototype/night-model';
import {writeFileSync,mkdirSync} from 'node:fs';import {performance} from 'node:perf_hooks';
const configurations:Array<{name:string;config:NightConfig}>=[
 {name:'空槽 · 基础巡守',config:{slots:[null,null],strengths:[0,0]}},
 ...[0,1,2,3].map(level=>({name:`单胶带 Lv.${level}`,config:{slots:['tape',null],strengths:[level,0]} as NightConfig})),
 ...[0,1,2,3].map(level=>({name:`单签收铃 Lv.${level}`,config:{slots:[null,'bell'],strengths:[0,level]} as NightConfig})),
 ...[0,1,2,3].map(level=>({name:`胶带+铃 Lv.${level}`,config:{slots:['tape','bell'],strengths:[level,level]} as NightConfig})),
 {name:'交换位置 · 铃A/胶带B',config:{slots:['bell','tape'],strengths:[0,0]}},
];
const rows=configurations.map(({name,config})=>({name,...nightResult(config)}));
const began=performance.now();for(let i=0;i<100;i++)simulateNight(configurations[i%configurations.length].config);const coldMs=performance.now()-began;
mkdirSync('artifacts/v02-review',{recursive:true});writeFileSync('artifacts/v02-review/strategy-results.json',JSON.stringify({method:'Deterministic 100ms ticks across one 60-second night; same model as live and offline; 3 visitors, no collection loss',benchmark:{host:'local Node.js CPU only; not phone',plans:100,coldMs},rows},null,2)+'\n');
let md='# 夜守策略模型对照\n\n每夜3位访客；基础机器人/飞船会安全送回所有访客。只有抵站前完成10.5秒封条核对才算提前拦退。胶带降低区域移动速度，铃在范围内每6秒停顿；二者通过延长核对时间改变结果。线索=1+实际提前拦退数，仅留在实验日志。\n\n| 配置 | 提前拦退 | 抵站后送回 | 线索 | 档案质量 |\n|---|---:|---:|---:|---|\n';
for(const r of rows)md+=`| ${r.name} | ${r.intercepted} | ${r.arrived} | ${r.clues} | ${r.quality} |\n`;
md+='\n每个访客的时刻、实际减速/停顿/核对时长见JSON。相同配置重复夜晚为固定结果，暂无随机波次；在线与离线直接读取同一模型结果。\n';writeFileSync('artifacts/v02-review/strategy-results.md',md);console.log(md);
