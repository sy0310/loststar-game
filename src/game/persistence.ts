import type {SaveData} from './engine';
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;}
export function openSave(_storage:StorageLike,_now:number):{state:SaveData;persisted:boolean}{throw new Error('fault-safe persistence is not implemented');}
export function commitSave(_storage:StorageLike,_fallback:SaveData,_mutate:(s:SaveData)=>SaveData,_now:number):{state:SaveData;persisted:boolean}{throw new Error('fault-safe persistence is not implemented');}
