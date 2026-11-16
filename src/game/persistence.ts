import { restore, SAVE_KEY, type SaveData } from './engine';
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void; }
export interface SaveResult { state:SaveData; persisted:boolean; }
function write(storage:StorageLike,state:SaveData) {
  try { storage.setItem(SAVE_KEY,JSON.stringify(state)); return true; }
  catch { return false; }
}
export function openSave(storage:StorageLike,now:number):SaveResult {
  let raw:string|null=null,readable=true;
  try { raw=storage.getItem(SAVE_KEY); } catch { readable=false; }
  const state=restore(raw,now);
  return {state,persisted:write(storage,state)&&readable};
}
export function commitSave(storage:StorageLike,fallback:SaveData,mutate:(s:SaveData)=>SaveData,now:number):SaveResult {
  let current=fallback,readable=true;
  try { const raw=storage.getItem(SAVE_KEY); if(raw!==null)current=restore(raw,now); }
  catch { readable=false; }
  // Mutation occurs outside the storage catch: write failure must never retry spending.
  const state=mutate(current);
  return {state,persisted:write(storage,state)&&readable};
}
