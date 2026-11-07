export interface Preferences {muted:boolean;textSize:'normal'|'large';startPage:'base'|'expedition'}
const key='loststar.preferences.v1';
export function readPreferences():Preferences {
  try {const p=JSON.parse(localStorage.getItem(key)??'{}');return {muted:p.muted!==false,textSize:p.textSize==='large'?'large':'normal',startPage:p.startPage==='expedition'?'expedition':'base'};}
  catch{return {muted:true,textSize:'normal',startPage:'base'};}
}
export function savePreferences(p:Preferences) {
  document.documentElement.dataset.textSize=p.textSize;
  try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}
}
