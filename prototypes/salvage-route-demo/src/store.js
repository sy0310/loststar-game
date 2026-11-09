/* One read/write IndexedDB transaction per action; no dependency on Web Locks or old game databases. */
(function(root){'use strict';
const E=root.LostCargo,NAME=E.KEY;
async function open(seed){
 let db=null,state=E.create(seed),revision=0,persisted=false,error='',corrupt=false,rawOriginal=null,closed=false,created=false,readable=false;const listeners=new Set();
 let channel=null;try{if(typeof BroadcastChannel==='function')channel=new BroadcastChannel(NAME+'.changed');}catch{/* Revision checks and foreground polling still serialize actions. */}
 const emit=()=>listeners.forEach(f=>f());
 const decode=v=>{if(!v||v.format!==1||!Number.isSafeInteger(v.revision)||v.revision<1)throw Error('存档封装无效');return E.restore(v.game);};
 const connect=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('其他窗口尚未关闭存档'));r.onsuccess=()=>{db=r.result;db.onversionchange=()=>{db.close();persisted=false;error='存档已在其他窗口变更，请重开本页';emit();};resolve();};});
 async function load(){
  if(!db)await connect();
  await new Promise((resolve,reject)=>{const t=db.transaction('archive','readwrite'),a=t.objectStore('archive'),r=a.get('current');let value,next;
   r.onsuccess=()=>{value=r.result;rawOriginal=value??null;try{if(value){next=decode(value);if(value.game.schema!==E.SCHEMA){const original=value;const backupKey='migration/schema-'+original.game.schema,backup=a.get(backupKey);backup.onsuccess=()=>{if(backup.result===undefined)a.put(original,backupKey);};value={format:1,revision:original.revision+1,game:next};a.put(value,'current');}}else{let old=null;try{old=localStorage.getItem(NAME);}catch(e){throw Error('无法检查旧原型存档：'+e.message);}rawOriginal=old;next=old?E.restore(old):E.create(seed);created=!old;value={format:1,revision:1,game:next};if(old)a.put(old,'migration/source');a.put(value,'current');}}catch(e){rawOriginal=r.result??rawOriginal;corrupt=true;error=e.message;t.abort();}};
   t.oncomplete=()=>{state=next;readable=true;revision=value.revision;persisted=true;corrupt=false;rawOriginal=null;error='';resolve();};t.onerror=t.onabort=()=>reject(t.error||Error(error||'存档事务未完成'));
  });
 }
 async function refresh(){if(closed||!db)return;await new Promise(resolve=>{try{const t=db.transaction('archive','readonly'),r=t.objectStore('archive').get('current');r.onsuccess=()=>{try{if(r.result&&r.result.revision!==revision){const next=decode(r.result);state=next;readable=true;revision=r.result.revision;emit();}}catch(e){corrupt=true;rawOriginal=r.result;error=e.message;persisted=false;emit();}};t.oncomplete=t.onerror=()=>resolve();}catch{resolve();}});}
 async function transact(action,expected=revision,replacement=null){
  if(!db||(!persisted&&!replacement))return{ok:false,message:'当前不能保存，操作未提交，请先导出或重试'};
  return new Promise(resolve=>{let result={ok:false,message:'存储失败，操作未提交'},next,version;let t;
   try{t=db.transaction('archive','readwrite');const a=t.objectStore('archive'),r=a.get('current');r.onsuccess=()=>{const current=r.result,actual=Number.isSafeInteger(current?.revision)?current.revision:0;
    try{if(actual!==expected){if(current){state=decode(current);revision=actual;}result={ok:false,message:'另一窗口已更新，已同步，请按当前画面重试'};return;}
     const before=current?decode(current):state;
     if(replacement){next=E.restore(replacement);a.put(current??rawOriginal,'backup/previous');result={ok:true};}
     else{const applied=E.dispatch(before,{...action,expected:action.expected??before.revision});result=applied;if(!applied.ok)return;next=applied.state;}
     version=actual+1;a.put({format:1,revision:version,game:next},'current');
    }catch(e){if(replacement&&corrupt){try{next=E.restore(replacement);version=actual+1;a.put(current??rawOriginal,'backup/previous');a.put({format:1,revision:version,game:next},'current');result={ok:true};}catch(err){result={ok:false,message:err.message};}}else result={ok:false,message:e.message};}
   };
   t.oncomplete=()=>{if(next&&version){state=next;readable=true;revision=version;persisted=true;corrupt=false;rawOriginal=null;error='';channel?.postMessage(version);}emit();resolve(result);};
   t.onerror=t.onabort=()=>{persisted=false;error='无法保存：'+(t.error?.message||'事务被中止');emit();resolve({ok:false,message:error+'，余额与选择未改变'});};
   }catch(e){persisted=false;error=e.message;emit();resolve({ok:false,message:'存储不可用，操作未提交'});}
  });
 }
 try{await load();}catch(e){persisted=false;error=error||e.message;}
 channel&&(channel.onmessage=refresh);const onFocus=()=>void refresh();root.addEventListener('focus',onFocus);root.addEventListener('pageshow',onFocus);document.addEventListener('visibilitychange',onFocus);const poll=setInterval(()=>{if(!document.hidden)void refresh();},1500);
 return{get created(){return created;},get readable(){return readable;},get state(){return state;},get revision(){return revision;},get persisted(){return persisted&&!corrupt;},get blocked(){return corrupt;},get error(){return error;},subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),act:transact,replace:(raw,expected)=>transact(null,expected,raw),export:()=>corrupt||!readable?{rawSave:rawOriginal,error,unavailable:!readable}:state,retry:async()=>{try{if(db)db.close();db=null;await load();}catch(e){error=error||e.message;persisted=false;}emit();},close:()=>{closed=true;clearInterval(poll);channel?.close();db?.close();root.removeEventListener('focus',onFocus);root.removeEventListener('pageshow',onFocus);document.removeEventListener('visibilitychange',onFocus);}};
}
root.SalvageStore={open};
})(window);
