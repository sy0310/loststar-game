export type RadarMode = 'local' | 'interstellar';
export type InterstellarScan = { elapsed:number; resolved:null|{id:string;name:string};attempts?:number;recoveryMs?:number };
// Identity is supplied only after a real content-ready lock. Unknown returns have no node.
export const radarPolicy = { interstellar:true } as const;
export const emptyInterstellar = ():InterstellarScan=>({elapsed:0,resolved:null});
export function interstellarView(scan:InterstellarScan,enabled:boolean) {
  if(!enabled)return {mode:'interstellar' as const,stage:'standby' as const,progress:0};
  if(scan.elapsed>=90000&&!scan.resolved)return {mode:'interstellar' as const,stage:'unconfirmed' as const,progress:100};
  if(scan.resolved)return {mode:'interstellar' as const,stage:'resolved' as const,progress:100,discovery:scan.resolved};
  return {mode:'interstellar' as const,stage:scan.elapsed<45000?'searching' as const:scan.elapsed<72000?'anomaly' as const:'locating' as const,progress:Math.min(99,Math.floor(scan.elapsed/900))};
}
// A future content module supplies a confirmed target ONLY after a successful real lock.
// No preselected node, silhouette, count or target identity belongs to an unknown scan.
export function advanceInterstellar(scan:InterstellarScan,ms:number,enabled:boolean,locate:()=>InterstellarScan['resolved']):InterstellarScan {
  if(!enabled||scan.resolved||!Number.isFinite(ms)||ms<=0)return scan;
  const elapsed=Math.min(90000,scan.elapsed+ms);
  return {...scan,elapsed,resolved:elapsed>=90000?locate():null};
}
