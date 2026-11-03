import {planets} from '../content/catalog';import type {Planet} from '../content/types';
import {advanceInterstellar,emptyInterstellar,type InterstellarScan} from './radar';
export interface StarRecord {id:string;x:number;y:number;discoveredAt:number;regions:string[];}
export interface StarChart {scan:InterstellarScan;records:StarRecord[];}
// A content pack must register a real scene implementation and a full small ecology.
// Adding an internal planet descriptor alone can never expose an expedition entrance.
export const expeditionThemes=new Set(['cardboard']);
export function readyPlanet(p:Planet){return p.playable&&p.regions.length>0&&p.regions.every(r=>expeditionThemes.has(r.visualTheme)&&['artifact','creature','event'].every(kind=>r.discoveries.some(d=>d.kind===kind)));}
export function initialChart(now=0):StarChart{return {scan:emptyInterstellar(),records:[{id:'parcel',x:.5,y:.5,discoveredAt:now,regions:['parcel-plains']}]};}
function position(id:string){let hash=2166136261;for(const ch of id)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;const angle=hash/4294967296*Math.PI*2,r=.22+(hash%7)*.02;return {x:.5+Math.cos(angle)*r,y:.5+Math.sin(angle)*r};}
export function stepStarChart(chart:StarChart,ms:number,known:string[],modules:Planet[]=planets,now=0):StarChart {
 if(!Number.isFinite(ms)||ms<=0)return chart;const next=structuredClone(chart);let left=ms;
 while(left>0){
  if(next.scan.elapsed>=90000){const gap=12000-(next.scan.recoveryMs??0),used=Math.min(gap,left);next.scan.recoveryMs=(next.scan.recoveryMs??0)+used;left-=used;if(next.scan.recoveryMs>=12000)next.scan={elapsed:0,resolved:null,attempts:(next.scan.attempts??0)+1};continue;}
  const used=Math.min(90000-next.scan.elapsed,left);left-=used;
  next.scan=advanceInterstellar(next.scan,used,true,()=>{
   const target=modules.find(p=>readyPlanet(p)&&!known.includes(p.id)&&!next.records.some(r=>r.id===p.id));
   if(!target)return null;
   next.records.push({id:target.id,...position(target.id),discoveredAt:now,regions:target.regions.map(r=>r.id)});return {id:target.id,name:target.name};
  });
 }
 return next;
}
export function cleanChart(raw:unknown,legacy:InterstellarScan,known:string[],now:number):StarChart {
 const initial=initialChart(now),input=raw as StarChart|undefined;
 const records=input&&Array.isArray(input.records)?input.records:initial.records;
 const valid=records.filter(r=>r&&known.includes(r.id)&&planets.some(p=>p.id===r.id)&&Number.isFinite(r.x)&&r.x>=0&&r.x<=1&&Number.isFinite(r.y)&&r.y>=0&&r.y<=1&&Number.isFinite(r.discoveredAt)&&r.discoveredAt>=0&&Array.isArray(r.regions));
 const unique=[...new Map(valid.map(r=>[r.id,{...r,regions:r.regions.filter(id=>planets.find(p=>p.id===r.id)!.regions.some(region=>region.id===id))}])).values()];
 for(const id of known){const p=planets.find(p=>p.id===id);if(p&&!unique.some(r=>r.id===id))unique.push({id,...(id==='parcel'?{x:.5,y:.5}:position(id)),discoveredAt:now,regions:p.regions.map(r=>r.id)});}
 const scan=input?.scan??legacy;
 const validScan=scan&&Number.isFinite(scan.elapsed)&&scan.elapsed>=0&&scan.elapsed<=90000&&(scan.resolved===null||planets.some(p=>p.id===scan.resolved?.id&&p.name===scan.resolved?.name&&known.includes(p.id)))&&(scan.recoveryMs===undefined||Number.isFinite(scan.recoveryMs)&&scan.recoveryMs>=0&&scan.recoveryMs<=12000)&&(scan.attempts===undefined||Number.isSafeInteger(scan.attempts)&&scan.attempts>=0);
 return {records:unique,scan:validScan?scan:emptyInterstellar()};
}
