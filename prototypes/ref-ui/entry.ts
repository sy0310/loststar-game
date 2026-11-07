import {mountFusion} from '../../src/fusion/ui';
import {createFusionScene} from '../../src/fusion/scene';
import {ExpeditionScene} from '../../src/render/scene';
import {makeReviewFixture,createMemoryController,reviewProfiles,type ReviewProfile} from './model';
import {mountReferenceUi} from './ui';

declare const __REFUI_BUILD__:{version:string;commit:string;dirty:boolean};
async function start(){
  const params=new URLSearchParams(location.search),profile=params.get('profile')??'fresh';
  if(!reviewProfiles.includes(profile as ReviewProfile))throw Error('Unknown isolated sample');
  const fixture=(window as unknown as {__REFUI_INITIAL__?:ReturnType<typeof makeReviewFixture>}).__REFUI_INITIAL__??makeReviewFixture(profile as ReviewProfile,Date.now());
  const before=JSON.stringify(fixture.state),memory=createMemoryController(fixture.state),controller=memory.controller;
  const ui=mountFusion(controller),extension=createFusionScene(()=>controller.state.game,(id,at,source)=>void controller.act({type:'observe',id,at,source}),()=>controller.state.projects,()=>controller.state);
  const scene=new ExpeditionScene(ui.worldRoot,()=>controller.state.game,extension);ui.setScene(scene,e=>extension.pulse(e),()=>extension.focus(),()=>extension.unloadPoint());scene.setActive(true);
  await import('./style.css');const reference=mountReferenceUi(controller,scene,()=>extension.focus());
  document.title='失物星球 · UI隔离样板';document.documentElement.dataset.reviewOnly='true';
  const build=document.querySelector('.fu-build');if(build)build.textContent=`UI隔离样板 · ${__REFUI_BUILD__.commit.slice(0,7)}${__REFUI_BUILD__.dirty?' (本地修改)':''} · 不写正式档`;
  Object.assign(window,{__REFUI__:{build:__REFUI_BUILD__,profile,look:'candidate',initial:before,provenance:fixture.provenance,
    state:()=>structuredClone(controller.state),trace:()=>structuredClone(memory.trace),compatibility:()=>structuredClone(memory.compatibility),instantCleaning:()=>structuredClone(memory.instantCleaning),treatment:()=>reference.treatment(),metrics:()=>({scene:scene.metrics(),ui:ui.diagnostics()}),
    materialSnapshot:ui.materialSnapshot,storagePolicy:'memory-only; formal store module is not imported'}});
  window.addEventListener('pagehide',()=>scene.setActive(false));
  window.addEventListener('pageshow',()=>scene.setActive(ui.diagnostics().view==='explore'&&!ui.diagnostics().drawer));
}
void start().catch(error=>{console.error(error);document.querySelector('#app')!.textContent='样板暂未接通，请刷新重试。';});
