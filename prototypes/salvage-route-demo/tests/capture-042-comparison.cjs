/* Explicit imported QA only. Same cargo UID/masks/resources, two immutable HTTP builds. */
'use strict';
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const E=require('../src/engine.js'),O=require('./legacy-engine.cjs')('754113a197e52762a80de5e33a45192074f2a99b');
const out=path.resolve(process.env.SALVAGE_COMPARE_OUT||'releases/salvage-v042-comparison');fs.mkdirSync(out,{recursive:true});
async function tap(p,s){await p.waitForFunction(()=>__SALVAGE__.ready());await p.locator(s).tap();await p.waitForFunction(()=>__SALVAGE__.ready());}
(async()=>{const b=await chromium.launch();try{for(const [label,engine,url]of [['before',O,process.env.SALVAGE_OLD_URL||'http://127.0.0.1:4293/loststar-salvage/'],['after',E,process.env.SALVAGE_URL||'http://127.0.0.1:4294/loststar-salvage/']]){
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await c.newPage();await p.goto(url);await p.waitForFunction(()=>window.__SALVAGE__);await tap(p,'#modal-buttons [data-act=close]');
 let s=engine.create(61);s.money=454;s.cargo=['metal_crate','energy_battery','nav_chip','broken_engine','medkit'].map((itemId,i)=>({uid:i+1,name:['金属散热片','能源电池','导航电路','发动机接头','医疗箱'][i],itemId,cells:2,shapeId:'line2',shapeVersion:1,value:40,acquiredRun:0}));s.nextUid=6;s.cargoGrid.placements=engine.Cargo.solve(s.cargo);engine.assertState(s);
 await tap(p,'[data-act=settings]');await tap(p,'[data-act=import]');await p.locator('#import-file').setInputFiles({name:'explicit-identical-cargo-QA.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await tap(p,'[data-act=confirm]');
 for(const tab of ['home','fleet','cargo']){if(tab!=='home')await tap(p,'[data-tab='+tab+']');await p.locator('img').evaluateAll(es=>Promise.all(es.map(i=>i.decode())));await p.screenshot({path:path.join(out,label+'-'+tab+'.png'),fullPage:true});if(tab!=='home')await tap(p,'#back');}
 await c.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
