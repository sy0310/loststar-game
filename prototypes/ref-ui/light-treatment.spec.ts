import {test,expect,type Page} from '@playwright/test';
import {makeReviewFixture} from './model';
const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
const prices=[[40,120],[30,100],[50,140],[45,180],[60,220],[35,120]];
const state=(p:Page)=>p.evaluate(()=>(window as any).__REFUI__.state());
async function open(p:Page,profile='restoration'){await p.goto('/?profile='+profile+'&compare=1');await p.waitForFunction(()=>!!(window as any).__REFUI__);}
async function detail(p:Page,id:string){await p.locator('.fu-nav [data-tab=collection]').tap();const details=p.locator('#fusion-collection-index');if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator('summary').tap();await p.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();await expect(p.locator('#refui-treatment')).toHaveAttribute('data-material-ready','true');}

test('six curios clean instantly, preserve upgrade timing and commit original fees and free interaction once',async({page})=>{
 test.setTimeout(100000);await page.addInitScript(()=>{(window as any).__TEST_CUES__=[];window.addEventListener('loststar:sound-cue',e=>(window as any).__TEST_CUES__.push((e as CustomEvent).detail));});await open(page);const initial=await state(page);
 for(let index=0;index<ids.length;index++){
  const id=ids[index];await detail(page,id);await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image',id+'-found.webp');
  for(const [kind,before,after,price] of [['clean','found','clean',prices[index][0]],['repair','clean','stabilized',prices[index][1]]] as const){
   const src=await page.locator('#lt-image').getAttribute('src');await page.locator('#lt-main').tap();await page.locator('#lt-main').dispatchEvent('click');
   if(kind==='clean'){
    const committed=await state(page);expect((id==='receipt'?committed.receipt:committed.curios[id]).condition).toBe('clean');expect(id==='receipt'?committed.receipt.activeAction:committed.curios[id].action).toBeUndefined();await expect(page.locator('#lt-progress')).toBeHidden();
    expect((await page.evaluate(()=>(window as any).__REFUI__.instantCleaning())).filter((r:any)=>r.item===id)).toHaveLength(1);
   }else{
    await page.waitForTimeout(700);await expect(page.locator('#lt-image')).toHaveAttribute('src',src!);await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image',id+'-'+before+'.webp');await expect(page.locator('#lt-result')).toHaveText('');
   }
   await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image',id+'-'+after+'.webp',{timeout:10000});await expect(page.locator('#lt-result')).not.toHaveText('');
   const trace=await page.evaluate(()=> (window as any).__REFUI__.trace());const rows=trace.filter((t:any)=>id==='receipt'?t.action.type==='paper'&&t.action.kind===kind:t.action.type==='curio'&&t.action.id===id&&t.action.kind===kind);expect(rows.map((t:any)=>t.before-t.after)).toEqual([price]);
  }
  await expect(page.locator('#lt-free')).toBeEnabled();await page.locator('#lt-free').tap();if(id==='bell')await expect(page.locator('#lt-trial')).toHaveAttribute('data-bell-triggered','true',{timeout:1500});await page.waitForTimeout(2900);await expect(page.locator('#lt-trial-line')).not.toHaveText('咔哒正在试验…');
  const count=await page.locator('#refui-treatment').getAttribute('data-arrival-count');await page.locator('#lt-close').tap();await detail(page,id);await expect(page.locator('#lt-result')).toHaveText('');expect(await page.locator('#refui-treatment').getAttribute('data-arrival-count')).toBe(count);await page.locator('#lt-close').tap();
 }
 const cues=await page.evaluate(()=>(window as any).__TEST_CUES__);expect(cues.filter((c:any)=>c.cue==='curio-bell'&&c.id==='bell')).toHaveLength(1);for(const id of ids.filter(id=>id!=='bell'))expect(cues.filter((c:any)=>c.cue==='interaction'&&c.id===id)).toHaveLength(1);
 const final=await state(page);expect(final.receipt.verifiedEvidenceIds).toEqual(initial.receipt.verifiedEvidenceIds);expect(final.game.collection).toEqual(initial.game.collection);expect(final.projects).toEqual(initial.projects);expect(final.game.growth).toEqual(initial.game.growth);
});

test('background completion and reduced motion never replay the completion or charge on reopen',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);await detail(page,'receipt');await page.locator('#lt-main').tap();await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-clean.webp');await page.locator('#lt-main').tap();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(4300);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-stabilized.webp');await expect(page.locator('#lt-result')).toHaveText('');expect(await page.locator('#lt-image').evaluate(e=>e.getAnimations().length)).toBe(0);await page.locator('#lt-close').tap();await detail(page,'receipt');await expect(page.locator('#lt-result')).toHaveText('');expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((t:any)=>t.action.type==='paper'&&t.action.kind==='clean')).toHaveLength(1);
});

test('image failure blocks payment and success, explicit retry uses saved state without a second fee',async({page})=>{
 await page.route('**/whole-states-v043/receipt-found.webp',route=>route.abort());await open(page,'treatment');await page.locator('#refui-event').tap();await page.locator('[data-ref-curio=receipt]').tap();await expect(page.locator('#lt-retry')).toBeVisible();await expect(page.locator('#lt-main')).toBeDisabled();await expect(page.locator('#lt-result')).toHaveText('');expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((t:any)=>t.action.type==='paper'&&t.action.kind==='clean')).toHaveLength(0);await page.unroute('**/whole-states-v043/receipt-found.webp');await page.locator('#lt-retry').tap();await expect(page.locator('#lt-main')).toBeEnabled();await page.locator('#lt-main').tap();await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-clean.webp');expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((t:any)=>t.action.type==='paper'&&t.action.kind==='clean').map((t:any)=>t.before-t.after)).toEqual([40]);
});

test('future-state preview is read-only and insufficient parts cannot start a payment or success',async({page})=>{
 const fixture=makeReviewFixture('treatment',Date.now());fixture.state.game.resources=0;await page.addInitScript(fixture=>{(window as any).__REFUI_INITIAL__=fixture;},fixture);await open(page,'treatment');await page.locator('#refui-event').tap();await page.locator('[data-ref-curio=receipt]').tap();await expect(page.locator('#lt-main')).toBeDisabled();await page.locator('[data-lt-preview=stabilized]').tap();await expect(page.locator('#lt-preview')).toBeVisible();expect((await state(page)).receipt.condition).toBe('found');await page.goBack();await expect(page.locator('#lt-main')).toBeDisabled();await page.locator('#lt-main').dispatchEvent('click');await expect(page.locator('#lt-result')).not.toContainText('野蛮清理');expect((await state(page)).receipt.condition).toBe('found');expect((await state(page)).game.resources).toBeGreaterThanOrEqual(0);
});

test('offline return has one real claim and later B event cards display the real saved stage',async({page})=>{
 await open(page,'return');await page.locator('#refui-event').tap();await expect(page.locator('#refui-card')).toContainText('飞船回来了');await expect(page.locator('[data-ref-curio]')).toHaveCount(0);await expect(page.locator('[data-ref-claim]')).toHaveCount(1);await page.locator('[data-ref-claim]').tap();expect((await state(page)).game.pendingReturn).toBeNull();await expect(page.locator('[data-ref-claim]')).toHaveCount(0);
 await open(page,'treatment');await page.locator('#refui-event').tap();await page.locator('[data-ref-curio=receipt]').tap();await page.locator('#lt-main').tap();await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-clean.webp');await page.locator('#lt-close').tap();await page.locator('#refui-event').tap();await expect(page.locator('.ref-subject')).toContainText('清理后');await expect(page.locator('.ref-subject')).not.toContainText('刚获得');
});


test('all reachable facility, collection, setting and return controls share the same theme without old image skins',async({page})=>{
 test.setTimeout(80000);await open(page,'facilities');
 async function audit(){const result=await page.evaluate(()=>{
  const tokens=['--ui-bg','--ui-surface','--ui-surface-raised','--ui-border','--ui-text','--ui-muted','--ui-accent','--ui-on-accent'].map(t=>getComputedStyle(document.body).getPropertyValue(t).trim().toUpperCase());
  const bad=[...document.querySelectorAll<HTMLElement>('#app button')].filter(e=>e.getClientRects().length>0).flatMap(e=>{const s=getComputedStyle(e);return s.backgroundImage!=='none'||s.borderImageSource!=='none'||s.boxShadow!=='none'?[e.outerHTML.slice(0,160)]:[];});
  const opaqueHits=[...document.querySelectorAll<HTMLElement>('.exhibit-hits button')].filter(e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'||getComputedStyle(e).borderTopWidth!=='0px');
  const d=document.querySelector('dialog[open]');return{tokens,bad,opaqueHits:opaqueHits.length,dialog:d?{color:getComputedStyle(d).backgroundColor,top:d.getBoundingClientRect().top}:null,overflow:document.documentElement.scrollWidth>innerWidth};});
  expect(result.tokens).toEqual(['#1C1730','#30283E','#3B324A','#6A5A76','#F3EBDE','#BEAFCA','#E8C57D','#302337']);expect(result.bad).toEqual([]);expect(result.opaqueHits).toBe(0);expect(result.overflow).toBe(false);if(result.dialog){expect(result.dialog.color).toBe('rgb(48, 40, 62)');expect(result.dialog.top).toBeGreaterThanOrEqual(0);}
 }
 await audit();await page.locator('#refui-objective').tap();await audit();await page.locator('[data-ref-close]').tap();
 await page.locator('.fu-nav [data-tab=collection]').tap();await page.locator('#fusion-collection-index summary').tap();
 for(const filter of ['artifact','creature','event']){await page.locator(`[data-filter="${filter}"]`).tap();await audit();const items=page.locator('#fusion-collection-list [data-detail]');for(let n=0;n<await items.count();n++){const id=await items.nth(n).getAttribute('data-detail');await items.nth(n).tap();await expect(page.locator('dialog[open]')).toHaveCount(1);await audit();if(await page.locator('#refui-treatment').isVisible()){await expect(page.locator('#refui-treatment')).toHaveAttribute('data-material-ready','true');await page.locator('#lt-close').tap();}else if(await page.locator('#refui-card').isVisible())await page.locator('[data-ref-close]').tap();else await page.locator('#fusion-close').tap();await page.locator('.fu-nav [data-tab=collection]').tap();expect(id).toBeTruthy();}}
 await page.locator('.fu-nav [data-tab=base]').tap();await page.locator('#fusion-base-more summary').tap();await audit();
 for(const selector of ['.fu-base-grow','[data-drawer=build]','[data-drawer=station]','[data-drawer=research]','#fusion-map','#fusion-wallet','[data-open-project=evidence-bench]','[data-open-project=habitat-window]']){await page.locator(selector).tap();for(const d of await page.locator('#fusion-drawer details').all()){if(!await d.evaluate(e=>(e as HTMLDetailsElement).open))await d.locator('summary').first().tap();}await audit();if(selector==='[data-drawer=build]'){await page.locator('[data-growth=case-0]').tap();await expect(page.locator('#fusion-case-preview')).toBeVisible();await audit();}await page.locator('#fusion-close').tap();}
 await page.locator('#fusion-settings').tap();await audit();await page.locator('[data-ref-close]').tap();await open(page,'return');await page.locator('#refui-event').tap();await audit();
});

test('a paid action already in an old save completes without another payment or free-task replacement',async({page})=>{
 const at=Date.now(),fixture=makeReviewFixture('restoration',at-500);const {reduceFusion}=await import('../../src/fusion/domain');fixture.state=reduceFusion(fixture.state,{type:'curio',id:'tape',kind:'clean'},at-500).state;const old=fixture.state.curios.tape.action;expect(old).toBeTruthy();await page.addInitScript(f=>{(window as any).__REFUI_INITIAL__=f;},fixture);await open(page);await detail(page,'tape');await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','tape-clean.webp');expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((r:any)=>r.action.type==='curio')).toHaveLength(0);expect((await state(page)).curios.tape.action).toBeUndefined();
});

test('purchased reader levels and real observation provenance remain visible in the free interaction',async({page})=>{
 await open(page,'owned');const before=await state(page);await detail(page,'receipt');await page.locator('#lt-free').tap();await expect(page.locator('#lt-trial')).toHaveAttribute('data-ability-level',String(before.progression.abilities.receipt));const ids=JSON.parse((await page.locator('#lt-trial').getAttribute('data-used-record-ids'))!);expect(ids.length).toBeGreaterThan(0);const now=await state(page),real=new Set([...now.progression.sorting.facts.map((f:any)=>f.id),...now.receipt.observations.map((o:any)=>o.actionId)]);expect(ids.every((id:string)=>real.has(id))).toBe(true);expect(now.receipt.verifiedEvidenceIds).toEqual(before.receipt.verifiedEvidenceIds);expect(now.progression.abilities).toEqual(before.progression.abilities);expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((r:any)=>r.action.type==='paper'&&r.action.kind==='try').map((r:any)=>r.before-r.after)).toEqual([0]);
});

test('default detail has only the current object, cleans immediately and cannot rapid-tap into a paid upgrade',async({page})=>{
 await page.goto('/?profile=restoration');await page.waitForFunction(()=>!!(window as any).__REFUI__);await detail(page,'receipt');await expect(page.locator('#lt-stages')).toBeHidden();await expect(page.locator('[data-lt-preview]:visible')).toHaveCount(0);await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-found.webp');
 await page.locator('#lt-main').tap();await page.locator('#lt-main').dispatchEvent('click');await page.locator('#lt-main').dispatchEvent('click');const current=await state(page);expect(current.receipt.condition).toBe('clean');expect(current.receipt.activeAction).toBeUndefined();await expect(page.locator('#lt-progress')).toBeHidden();await expect(page.locator('#lt-image')).toHaveAttribute('data-state-image','receipt-clean.webp');await expect(page.locator('#lt-result')).not.toHaveText('');
 const trace=await page.evaluate(()=>(window as any).__REFUI__.trace());expect(trace.filter((t:any)=>t.action.type==='paper').map((t:any)=>[t.action.kind,t.before-t.after])).toEqual([['clean',40]]);await expect(page.locator('#lt-stages')).toBeHidden();
});

test('resident observation lists only discovered friends and opens their real animated habitats without buying a facility',async({page})=>{
 await open(page,'fresh');await page.locator('.fu-nav [data-tab=collection]').tap();await page.locator('#refui-residents').tap();await expect(page.locator('#refui-card-title')).toHaveText('星球居民');await expect(page.locator('[data-ref-resident]')).toHaveCount(0);await expect(page.locator('#refui-card-body')).toContainText('还没遇见');await page.locator('[data-ref-close]').tap();
 await open(page,'owned');const before=await state(page);await page.locator('.fu-nav [data-tab=collection]').tap();
 for(const id of ['mouse','hermit','tagbird']){
  await page.locator('#refui-residents').tap();await expect(page.locator('[data-ref-resident]')).toHaveCount(3);await page.locator(`[data-ref-resident="${id}"]`).tap();await expect(page.locator('#refui-card')).toBeHidden();await expect(page.locator('dialog[open]')).toHaveCount(1);const canvas=page.locator('#fusion-detail-habitat canvas');await expect(canvas).toHaveAttribute('data-ready','true');await expect(canvas).toHaveAttribute('data-known','true');const frame=await canvas.getAttribute('data-frame');await expect.poll(()=>canvas.getAttribute('data-frame')).not.toBe(frame);await page.locator('#fusion-try').tap();await expect(canvas).toHaveAttribute('data-trial','true');await page.locator('#fusion-close').tap();
 }
 const after=await state(page);expect(after.projects).toEqual(before.projects);expect(after.game.collection).toEqual(before.game.collection);expect((await page.evaluate(()=>(window as any).__REFUI__.trace())).filter((t:any)=>t.before>t.after)).toHaveLength(0);
});
