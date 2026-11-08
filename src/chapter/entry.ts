import {openFusionStore} from '../fusion/store';
import {mountFusion} from '../fusion/ui';
import {createFusionScene} from '../fusion/scene';
import {ExpeditionScene} from '../render/scene';
import {createChapter,advanceChapter,reduceChapter,restoreChapter,STORY_DATABASE,chapterSchedule,type ChapterSave,attachChapter,chapterQaFixture} from './model';
import {withChapterScene} from './scene';
import {mountChapterUi} from './ui';
import {restoreFusion} from '../fusion/domain';
import './style.css';
declare const __REFUI_BUILD__:{version:string;commit:string;dirty:boolean};
async function start(){
 const qa=new URLSearchParams(location.search).get('qa')==='1',databaseName=STORY_DATABASE+(qa?'.qa':'');
 const controller=await openFusionStore({isolated:{databaseName,create:createChapter,restore:restoreChapter,advance:advanceChapter,reduce:reduceChapter}});
 let replayAt:number|null=null;
 const rendered=()=>{const s=controller.state as ChapterSave;if(replayAt===null)return s;const sec=(performance.now()-replayAt)/1000;if(sec>=8){replayAt=null;return s;}const schedule=chapterSchedule(s);if(!schedule)return s;const copy=structuredClone(s);copy.game.world.elapsedMs=schedule.start+sec*1000;return copy;};
 const ui=mountFusion(controller),base=createFusionScene(()=>rendered().game,(id,at,source)=>{if(replayAt===null)void controller.act({type:'observe',id,at,source});},()=>controller.state.projects,rendered),extension=withChapterScene(base,rendered);
 const scene=new ExpeditionScene(ui.worldRoot,()=>rendered().game,extension);ui.setScene(scene,e=>extension.pulse(e),()=>extension.focus(),()=>extension.unloadPoint());scene.setActive(true);
 await import('../../prototypes/ref-ui/style.css');
 const reference=mountChapterUi(controller,scene,()=>extension.focus(),kind=>{replayAt=kind==='stop'?null:performance.now();scene.setActive(true);},qa,()=>replayAt!==null);
 document.title='失物星球 · 比寄出更早的退件';document.querySelector('.fu-build')!.textContent=`剧情开发自测${qa?' · QA隔离档':''} · ${__REFUI_BUILD__.commit.slice(0,7)} · 自动保存`;
 const cap=document.createElement('div');cap.className='chapter-caption';cap.hidden=true;document.querySelector('.fu-world-shell')!.append(cap);
 const tick=()=>{const phase=scene.canvas.dataset.chapterPhase??'idle';cap.hidden=phase==='idle';cap.textContent=replayAt!==null?'只读回顾 · 点击手记可跳过':phase==='slip'?'纸条：退回目的地：上一天。':phase==='read'?'咔哒：“咦，这颗星，刚才在箱子里见过。”':'旧分拣机亮起灯，纸带开始倒送。';requestAnimationFrame(tick);};requestAnimationFrame(tick);
 async function installCopy(raw:string){if(!qa)throw Error('仅QA可显式导入副本');const input=JSON.parse(raw);const core=restoreFusion(JSON.stringify(input),input.game.lastAt);const state=input.chapter?restoreChapter(raw,core.game.lastAt):attachChapter(core,true);state.chapter.qa=true;await new Promise<void>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>{const db=req.result,t=db.transaction('archive','readwrite');t.objectStore('archive').put({...state,storageRevision:Date.now()},'current');t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};req.onerror=()=>reject(req.error);});location.reload();}
 document.addEventListener('click',event=>{const kind=(event.target as Element).closest<HTMLElement>('[data-chapter-qa]')?.dataset.chapterQa;if(qa&&['eligible','reveal','ending'].includes(kind??''))void installCopy(JSON.stringify(chapterQaFixture(kind as 'eligible'|'reveal'|'ending',Date.now())));},true);
 document.addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.id==='chapter-import'&&input.files?.[0])void input.files[0].text().then(installCopy).catch(()=>{input.insertAdjacentHTML('afterend','<p>副本无法读取，原档未改。</p>');});});
 Object.assign(window,{__CHAPTER__:{build:__REFUI_BUILD__,databaseName,qa,state:()=>structuredClone(controller.state),persisted:()=>controller.persisted,metrics:()=>scene.metrics(),uiMetrics:()=>ui.diagnostics(),treatment:reference.treatment,qaImport:qa?installCopy:undefined,qaAct:qa?controller.act:undefined}});
 window.addEventListener('pagehide',()=>scene.setActive(false));window.addEventListener('pageshow',()=>scene.setActive(ui.diagnostics().view==='explore'&&!ui.diagnostics().drawer));
}
void start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent='剧情档案暂未接通，原档保留。请刷新重试。';});
