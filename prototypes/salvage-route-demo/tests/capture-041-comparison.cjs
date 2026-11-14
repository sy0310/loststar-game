/* Explicit imported QA only. Same cargo UID/masks/resources, two immutable HTTP builds. */
'use strict';
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const E=require('../src/engine.js'),O=require('./legacy-engine.cjs')('ba90efbd01143533018f08a28f4221d9c36178c1');
const out=path.resolve(process.env.SALVAGE_COMPARE_OUT||'releases/salvage-v041-comparison');fs.mkdirSync(out,{recursive:true});
async function tap(p,s){await p.waitForFunction(()=>__SALVAGE__.ready());await p.locator(s).tap();await p.waitForFunction(()=>__SALVAGE__.ready());}
(async()=>{const b=await chromium.launch();try{for(const [label,engine,url]of [['before',O,process.env.SALVAGE_OLD_URL||'http://127.0.0.1:4291/loststar-salvage/'],['after',E,process.env.SALVAGE_URL||'http://127.0.0.1:4293/loststar-salvage/']]){
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await c.newPage();await p.goto(url);await p.waitForFunction(()=>window.__SALVAGE__);await tap(p,'#modal-buttons [data-act=close]');
 let s=engine.create(61);s.money=27049;s.fuel=32;s.hull=48;s.cargo=['ell3','line3','square4'].map((shapeId,i)=>({uid:i+1,name:['弯形回收板','散热导轨','金属运输箱'][i],itemId:'broken_engine',cells:engine.Cargo.area(shapeId),shapeId,shapeVersion:1,value:40,acquiredRun:0}));s.nextUid=4;s.cargoGrid.placements=[{uid:1,x:0,y:0,rotation:0},{uid:2,x:0,y:3,rotation:0},{uid:3,x:2,y:0,rotation:0}];engine.assertState(s);
 await tap(p,'[data-act=settings]');await tap(p,'[data-act=import]');await p.locator('#import-file').setInputFiles({name:'explicit-identical-cargo-QA.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await tap(p,'[data-act=confirm]');
 for(const tab of ['home','fleet','cargo']){if(tab!=='home')await tap(p,'[data-tab='+tab+']');await p.locator('img').evaluateAll(es=>Promise.all(es.map(i=>i.decode())));await p.screenshot({path:path.join(out,label+'-'+tab+'.png'),fullPage:true});if(tab!=='home')await tap(p,'#back');}
 await c.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
