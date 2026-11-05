import {expect, test, type Page} from '@playwright/test';
import {newGame} from '../../src/game/engine';
import {discoveries} from '../../src/content/catalog';
import {createFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';

const epoch=1800000000000;
const databaseName='loststar.fusion.review.v035';
test.use({isMobile:true,hasTouch:true});

async function saved(page:Page):Promise<FusionSave>{
  return page.evaluate(name=>new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;const get=db.transaction('archive','readonly').objectStore('archive').get('current');get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>{db.close();reject(get.error);};};
  }),databaseName) as Promise<FusionSave>;
}

async function open(page:Page,legacy:boolean|'broken'=false){
  await page.clock.install({time:new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch+1000));
  if(legacy){
    const game=newGame(epoch+1000);game.resources=27049;game.collection=discoveries.map(item=>item.id);game.seenDiscoveries=[...game.collection];game.upgrades={radar:5,scanner:5,recycler:5,cargo:5};
    const state=createFusion(epoch+1000,JSON.stringify(game));state.progression.sorting.phase='observed';
    await page.route('**/*',route=>route.request().resourceType()==='script'?route.abort():route.continue());
    await page.goto('/?sample=refinement',{waitUntil:'domcontentloaded'});
    await page.evaluate(({name,state})=>new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('archive');request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;const tx=db.transaction('archive','readwrite');tx.objectStore('archive').put(state,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
    }),{name:legacy==='broken'?'loststar.fusion.v1':databaseName,state:legacy==='broken'?{bad:'KEEP-OLD-27049',resources:27049}:state});
    await page.unroute('**/*');
  }
  await page.goto('/?sample=refinement');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');
  await page.clock.runFor(300);await page.waitForLoadState('networkidle');
}

async function advance(page:Page,milliseconds:number){
  await page.clock.fastForward(milliseconds);await page.clock.runFor(300);
}

async function detail(page:Page,id:string){
  await page.locator('[data-tab="collection"]').tap();
  await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
  await page.clock.runFor(100);
}

async function sorting(page:Page){
  await page.locator('#fusion-wallet').tap();await page.locator('#fusion-open-sorting').tap();
}

test('新档钱包承接设备目标，首屏短文案和未知支线保持隐藏',async({page})=>{
  await open(page);
  await expect(page.locator('#fusion-app')).not.toContainText('旧分拣区');
  const han=await page.locator('#fusion-app').evaluate(root=>(root as HTMLElement).innerText.replace(/[^\u3400-\u9fff]/g,'').length);
  expect(han).toBeLessThanOrEqual(80);
  await page.locator('#fusion-wallet').tap();
  await expect(page.locator('#fusion-drawer-title')).toHaveText('零件用在哪');
  await expect(page.locator('.fu-spend-goal')).toHaveCount(2);
  await expect(page.locator('.fu-spend-goal').first()).toContainText('机器人');
  await expect(page.locator('#fusion-drawer')).not.toContainText('旧分拣区');
  expect((await saved(page)).game.resources).toBe(120);
});

test('收藏室和六件原容器实时绘制，试验不复制展品或增加奖励',async({page})=>{
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await open(page,true);
  await page.locator('[data-tab="base"]').tap();
  await page.clock.runFor(100);
  const frame=Number(await page.locator('#museum-canvas').getAttribute('data-frame'));
  await page.clock.runFor(1000);
  expect(Number(await page.locator('#museum-canvas').getAttribute('data-frame'))-frame).toBeGreaterThan(35);
  const before=await saved(page);
  for(const id of ['receipt','tape','nested','stamp','cosmic-parcel','bell']){
    await detail(page,id);
    const canvas=page.locator(id==='receipt'?'#fusion-paper-focus':'#fusion-exhibit-focus');
    await expect(canvas).toHaveAttribute('data-ready','true');
    const first=await canvas.screenshot();
    await page.locator('#fusion-try').tap();await page.clock.runFor(900);
    expect(await canvas.screenshot()).not.toEqual(first);
    await expect(page.locator('#interaction-feedback')).toBeHidden();
    await page.locator('#fusion-close').tap();
  }
  const after=await saved(page);
  expect(after.progression.payments).toEqual(before.progression.payments);
  expect(after.game.resources-before.game.resources).toBe(after.game.station.grossIncome-before.game.station.grossIncome);
  expect(errors).toEqual([]);
});

test('能力与展柜分别保存，工程按开工胶带等级定价，真实箱标支持核验',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await open(page,true);
  await detail(page,'tape');await page.locator('#fusion-ability-upgrade').tap();
  await expect(page.locator('#fusion-ability-level')).toContainText('Ⅰ');
  expect((await saved(page)).progression.abilities.tape).toBe(1);
  await page.locator('#fusion-close').tap();await detail(page,'receipt');await page.locator('#fusion-ability-upgrade').tap();
  await expect(page.locator('#fusion-ability-level')).toContainText('Ⅰ');
  await page.locator('#fusion-close').tap();await sorting(page);
  await page.locator('[data-refinement="main"]').tap();await expect(page.locator('#fusion-drawer')).toBeHidden();await advance(page,13000);
  expect((await saved(page)).progression.sorting.phase).toBe('surveyed');
  await sorting(page);await expect(page.locator('[data-refinement="main"]')).toHaveText('开工 2160');
  await page.locator('[data-refinement="main"]').tap();await expect(page.locator('#fusion-drawer')).toBeHidden();
  expect((await saved(page)).progression.sorting.paidCost).toBe(2160);
  await detail(page,'tape');await page.locator('#fusion-ability-upgrade').tap();await expect(page.locator('#fusion-ability-level')).toContainText('Ⅱ');
  expect((await saved(page)).progression.sorting.paidCost).toBe(2160);
  await page.locator('#fusion-close').tap();await advance(page,7000);
  await sorting(page);await page.locator('[data-refinement="main"]').tap();await expect(page.locator('#fusion-drawer')).toBeHidden();await advance(page,29500);
  const verify=await saved(page);
  expect(verify.progression.sorting.stage).toBe('verify');
  expect(verify.progression.sorting.facts.filter(fact=>fact.kind==='label').map(fact=>fact.code).sort()).toEqual(['P03','P30']);
  await detail(page,'receipt');await expect(page.locator('#fusion-try')).toHaveText('对照箱标');await page.locator('#fusion-try').tap();
  await expect.poll(async()=>(await saved(page)).progression.sorting.compared).toBe(true);
  await page.clock.runFor(900);await expect(page.locator('#fusion-paper-focus')).toHaveAttribute('data-ability-level','1');
  await expect(page.locator('#fusion-paper-focus')).toHaveAttribute('data-used-record-ids',/label\/P30/);
  const bounds=JSON.parse((await page.locator('#fusion-paper-focus').getAttribute('data-ability-bounds'))!);expect(bounds.width).toBeGreaterThan(152);
  await page.locator('#fusion-close').tap();await advance(page,18000);await advance(page,29000);
  expect((await saved(page)).progression.sorting.phase).toBe('cleared');
  await sorting(page);await page.locator('[data-refinement="study"]').tap();
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  await page.locator('#fusion-observe').tap();
  await expect(page.locator('#fusion-inspection-panel')).toBeVisible();
  await sorting(page);await expect(page.locator('[data-cancel-sorting-study]')).toBeVisible();
  const active=await saved(page);expect(active.progression.sorting.activeStudy?.id).toBe('belt-direction');
  await advance(page,3000);await page.locator('[data-cancel-sorting-study]').tap();await expect(page.locator('[data-cancel-sorting-study]')).toHaveCount(0);
  const cancelled=await saved(page);expect(cancelled.progression.sorting.activeStudy).toBeNull();expect(cancelled.progression.sorting.researchRefunded).toBeGreaterThan(0);expect(cancelled.progression.sorting.researchRefunded).toBeLessThan(90);
  await page.locator('[data-refinement="main"]').tap();
  await expect(page.locator('#fusion-sorting-records')).toBeInViewport();
  await expect(page.locator('#fusion-sorting-records').locator('..')).toHaveAttribute('open','');
  for(let index=0;index<3;index++){
    await page.locator('[data-refinement="study"]').tap();await expect(page.locator('#fusion-drawer')).toBeHidden();
    await advance(page,12500);await sorting(page);
    expect((await saved(page)).progression.sorting.facts.filter(fact=>fact.kind==='study')).toHaveLength(index+1);
  }
  await expect(page.locator('[data-refinement="study"]')).toBeHidden();
  await expect(page.getByRole('button',{name:'免费复核',exact:true})).toHaveCount(1);
  await page.locator('[data-refinement="main"]').tap();
  await expect(page.locator('#fusion-sorting-records')).toBeInViewport();
  await expect(page.locator('#fusion-sorting-records')).toContainText('纸路已经接通');
  const balance=(await saved(page)).game.resources;
  await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready','true');
  const restored=await saved(page);expect(restored.progression.abilities).toEqual({receipt:1,tape:2});expect(restored.progression.sorting.phase).toBe('cleared');expect(restored.progression.sorting.paidCost).toBe(2160);expect(restored.game.growth).toEqual({});expect(restored.game.resources).toBeGreaterThanOrEqual(balance);
  expect(errors).toEqual([]);
});


test('触点先中性回应，长按不记助力，成功后独立确认并只按真实卸货入账',async({page})=>{
  await open(page);
  // WAAPI uses wall time even while the model clock is paused. Capture the real
  // node and its animation when appended, before a later IDB read can outlive it.
  await page.evaluate(()=>{
    const entries:any[]=[];
    (window as any).__incomeEffects=entries;
    const host=document.querySelector<HTMLElement>('#fusion-revenue-effects')!;
    const observer=new MutationObserver(records=>{
      for(const record of records)for(const added of record.addedNodes){
        if(!(added instanceof HTMLElement)||!added.matches('.fu-income-token'))continue;
        const box=added.getBoundingClientRect();
        const hostBox=host.getBoundingClientRect();
        const wallet=document.querySelector<HTMLElement>('#fusion-wallet')!;
        const walletBox=wallet.getBoundingClientRect();
        const style=getComputedStyle(added),hostStyle=getComputedStyle(host);
        const [originX,originY]=style.transformOrigin.split(' ').map(Number.parseFloat);
        const width=added.offsetWidth,height=added.offsetHeight;
        const intersects=(rect:{left:number;top:number;right:number;bottom:number})=>rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight;
        const animations=added.getAnimations().map(animation=>{
          const effect=animation.effect as KeyframeEffect;
          const keyframes=effect.getKeyframes().map(frame=>{
            const transform=String(frame.transform??'none');
            const matrix=new DOMMatrix(transform);
            const points=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>matrix.transformPoint(new DOMPoint(x-originX,y-originY)));
            const left=Math.min(...points.map(point=>point.x))+originX+hostBox.left+added.offsetLeft;
            const right=Math.max(...points.map(point=>point.x))+originX+hostBox.left+added.offsetLeft;
            const top=Math.min(...points.map(point=>point.y))+originY+hostBox.top+added.offsetTop;
            const bottom=Math.max(...points.map(point=>point.y))+originY+hostBox.top+added.offsetTop;
            return {offset:frame.computedOffset,opacity:Number(frame.opacity??1),transform,bounds:{left,top,right,bottom},inViewport:intersects({left,top,right,bottom})};
          });
          return {playState:animation.playState,pending:animation.pending,duration:effect.getTiming().duration,keyframes};
        });
        entries.push({text:added.textContent,wallet:document.querySelector('#fusion-parts')!.textContent,
          measuredAt:'MutationObserver append microtask, DOM geometry and native WAAPI keyframes',
          bounds:{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height},
          inViewport:intersects(box),display:style.display,visibility:style.visibility,
          hostDisplay:hostStyle.display,hostVisibility:hostStyle.visibility,
          walletBounds:{left:walletBox.left,top:walletBox.top,right:walletBox.right,bottom:walletBox.bottom},animations});
        if(entries.length>16)entries.shift();
      }
    });
    observer.observe(host,{childList:true});
  });
  const point=await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('#fusion-world canvas')!,box=canvas.getBoundingClientRect();
    const scale=Math.min(box.width/canvas.width,box.height/canvas.height);
    for(const [x,y]of [[416,610],[460,600],[380,600],[420,570]]){
      const point={x:box.left+(box.width-canvas.width*scale)/2+x*scale,y:box.top+(box.height-canvas.height*scale)/2+y*scale};
      if((window as any).__FUSION__.pickAtClient(point.x,point.y).kind==='planet')return point;
    }
    throw Error('No unoccupied terrain');
  });
  const sample={pointerId:71,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:point.x,clientY:point.y};
  await page.locator('#fusion-tap').dispatchEvent('pointerdown',sample);await page.clock.runFor(48);
  let feedback=await page.evaluate(()=>(window as any).__FUSION__.feedbackMetrics());
  expect(feedback.samples.filter((sample:any)=>sample.kind==='contact').length).toBe(1);
  expect((await saved(page)).game.assist?.actionSeq??0).toBe(0);
  await page.clock.runFor(700);await page.locator('#fusion-tap').dispatchEvent('pointerup',{...sample,buttons:0});await page.clock.runFor(32);
  expect((await saved(page)).game.assist?.actionSeq??0).toBe(0);
  await page.touchscreen.tap(point.x,point.y);
  await expect.poll(async()=>(await saved(page)).game.assist?.actionSeq??0).toBe(1);
  await page.clock.runFor(64);
  feedback=await page.evaluate(()=>(window as any).__FUSION__.feedbackMetrics());
  const accepted=feedback.samples.filter((sample:any)=>sample.kind==='accepted');expect(accepted).toHaveLength(1);expect(accepted[0].firstPaintMs).toBeLessThanOrEqual(80);
  expect((await saved(page)).game.resources).toBe(120);
  expect(await page.evaluate(()=>(window as any).__incomeEffects)).toEqual([]);
  await advance(page,12000);
  await expect.poll(()=>page.evaluate(()=>(window as any).__incomeEffects.length)).toBe(1);
  const effects=await page.evaluate(()=>(window as any).__incomeEffects);
  const after=await saved(page);expect(after.game.resources).toBe(120+after.game.station.grossIncome);
  expect(after.game.cycles).toBeGreaterThan(0);
  const income=effects[0];
  expect(income.text).toBe('+8');
  expect(Number(income.text.slice(1))).toBe(after.game.station.grossIncome);
  expect(Number(income.wallet.replace(/[^0-9]/g,''))).toBe(after.game.resources);
  expect(income.bounds.width).toBeGreaterThan(0);expect(income.bounds.height).toBeGreaterThan(0);
  expect(income.inViewport).toBe(true);
  expect(income.display).not.toBe('none');expect(income.visibility).toBe('visible');
  expect(income.hostDisplay).not.toBe('none');expect(income.hostVisibility).toBe('visible');
  expect(income.animations).toHaveLength(1);
  const animation=income.animations[0];
  expect(animation.playState).toBe('running');expect(Number(animation.duration)).toBeGreaterThan(0);
  expect(animation.keyframes.length).toBeGreaterThanOrEqual(3);
  expect(animation.keyframes[0].opacity).toBe(0);expect(animation.keyframes.at(-1).opacity).toBe(0);
  const visibleFrames=animation.keyframes.filter((frame:any)=>frame.opacity>=.9);
  expect(visibleFrames.length).toBeGreaterThanOrEqual(2);
  expect(visibleFrames.every((frame:any)=>frame.inViewport)).toBe(true);
  expect(new Set(animation.keyframes.map((frame:any)=>frame.transform)).size).toBeGreaterThanOrEqual(3);
  const end=animation.keyframes.at(-1).bounds;
  const endX=(end.left+end.right)/2,endY=(end.top+end.bottom)/2;
  expect(endX).toBeGreaterThanOrEqual(income.walletBounds.left);expect(endX).toBeLessThanOrEqual(income.walletBounds.right);
  expect(endY).toBeGreaterThanOrEqual(income.walletBounds.top);expect(endY).toBeLessThanOrEqual(income.walletBounds.bottom);
  await test.info().attach('actual-income-animation.json',{body:JSON.stringify({effects,ledger:{cycles:after.game.cycles,grossIncome:after.game.station.grossIncome,resources:after.game.resources}},null,2),contentType:'application/json'});
});


test('坏旧源在首页与钱包都显示待接通，不把占位120当已承接余额',async({page})=>{
  await open(page,'broken');
  await expect(page.locator('#fusion-parts')).toHaveText('—');
  await expect(page.locator('#fusion-save-warning')).toHaveText('旧档暂未接通，正在重试');
  await page.locator('#fusion-wallet').tap();
  await expect(page.locator('#fusion-drawer')).toContainText('旧档暂未接通，正在重试');
  await expect(page.locator('.fu-wallet-total')).toHaveText('—');
  await expect(page.locator('#fusion-drawer')).not.toContainText('120');
  await page.locator('#fusion-close').tap();await page.locator('#fusion-upgrades').tap();
  for(const button of await page.locator('button[data-upgrade]').all())await expect(button).toBeDisabled();
});
