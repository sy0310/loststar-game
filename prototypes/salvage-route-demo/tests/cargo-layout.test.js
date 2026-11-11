'use strict';
const assert=require('node:assert/strict'),E=require('../src/engine.js'),G=E.Cargo;
let passed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}};
const act=(s,type,x={})=>{const r=E.dispatch(s,{type,...x});assert(r.ok,r.message);return r.state;};
const go=s=>act(s,'travel',{id:s.route[0].uid});
const item=(uid,shapeId='square4',size=1)=>({uid,itemId:'metal_crate',name:'普通测试件 '+uid,size,cells:size*4,value:25,ability:null,acquiredRun:0,shapeId,shapeVersion:1});
const snapshot=s=>JSON.stringify(s);
function fixture(s,items,placements){s=JSON.parse(JSON.stringify(s));s.cargo=items;s.nextUid=Math.max(s.nextUid,...items.map(x=>x.uid+1));s.cargoGrid.placements=placements??G.solve(items);E.assertState(s);return s;}

test('every registered shape has a connected, unique, in-bounds mask and four rotations preserve area',()=>{
 for(const[id,mask]of Object.entries(G.SHAPES)){
  assert.equal(new Set(mask.map(p=>p.join(','))).size,mask.length);
  const reached=new Set([mask[0].join(',')]);for(let i=0;i<mask.length;i++)for(const[x,y]of mask)if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(p=>reached.has(p.join(','))))reached.add([x,y].join(','));assert.equal(reached.size,mask.length);
  let rotation=0;for(let r=0;r<4;r++){rotation=(rotation+1)%4;assert.equal(G.cells(id,rotation).length,mask.length);}assert.deepEqual(G.cells(id,rotation),G.cells(id,0));
 }
});
test('nonrectangular empty corners stay available; adjacent cells do not collide',()=>{
 const items=[item(1,'ell4'),item(2,'ell4')];
 const p=[{uid:1,x:0,y:0,rotation:0},{uid:2,x:1,y:0,rotation:2}];assert(G.validate(items,p).ok);
 assert.equal(G.validate(items,p).cells,8);assert.equal(G.cells(items[0]).some(([x,y])=>x===1&&y===0),false);
});
test('out-of-bounds, overlap, missing, duplicate and foreign placements are rejected',()=>{
 const items=[item(1),item(2)],p=G.solve(items);assert(G.validate(items,p).ok);
 for(const bad of[[{...p[0],x:4},p[1]],[p[0],{...p[1],x:p[0].x,y:p[0].y}],[p[0]],[p[0],p[0]],[p[0],{...p[1],uid:99}],[{...p[0],rotation:4},p[1]],[{...p[0],x:0.5},p[1]]])assert.equal(G.validate(items,bad).ok,false);
});
test('registered shape area cannot be forged with masks, an unknown ID or an incompatible size',()=>{
 for(const x of[{...item(1),shapeId:'unknown'},{...item(1),size:2},{...item(1),shapeVersion:2},{...item(1),mask:[[0,0]]},{...item(1),cells:[[0,0]]}])assert.equal(G.validate([x],[{uid:1,x:0,y:0,rotation:0}]).ok,false);
 assert.equal(G.solve([item(1),item(1)]),null);
});
test('free area can need repacking, while the complete solver finds a real layout',()=>{
 const items=[item(1,'line4'),item(2,'line4'),item(3)],fixed=[{uid:1,x:0,y:0,rotation:1},{uid:2,x:2,y:0,rotation:1}];
 assert(G.validate(items.slice(0,2),fixed).ok);assert.equal(G.extend(items,fixed),null);
 const solved=G.solve(items,fixed);assert(solved);assert(G.validate(items,solved).ok);assert.deepEqual(G.solve(items,fixed),solved);
});
test('the solver proves a full-area impossible tiling, rather than trusting area alone',()=>{
 // Three balanced squares plus one T have an unavoidable checkerboard imbalance.
 const items=[item(1),item(2),item(3),item(4,'tee4')];assert.equal(items.reduce((n,x)=>n+G.area(x),0),16);assert.equal(G.solve(items),null);
});
test('partial placements support a temporary tray; illegal placement leaves the old layout unchanged',()=>{
 const items=[item(1),item(2)],initial=[{uid:1,x:0,y:0,rotation:0}],before=snapshot(initial);
 assert(G.validate(items,initial,{partial:true}).ok);assert(!G.validate(items,initial).ok);
 const bad=G.place(items,initial,2,0,0,0);assert(!bad.ok);assert.equal(snapshot(initial),before);assert.deepEqual(bad.placements,initial);
 const good=G.place(items,initial,2,2,0,0);assert(good.ok);assert(G.validate(items,good.placements).ok);
});
test('all legacy full-capacity size combinations migrate without losing goods or financial data',()=>{
 for(const sizes of[[1,1,1,1],[2,2],[3,1],[1,3],[4],[1,2,1],[2,1,1]]){
  const old=E.create(778);old.schema=2;delete old.cargoGrid;old.cargo=sizes.map((size,i)=>({uid:i+1,name:'旧货 '+i,size,value:101+i,ability:null,acquiredRun:0}));old.nextUid=sizes.length+1;
  const before=snapshot(old),next=E.restore(old);assert.equal(snapshot(old),before);assert.equal(next.schema,E.SCHEMA);assert(G.validate(next.cargo,next.cargoGrid.placements).ok);
  assert.equal(E.used(next),16);assert.equal(G.validate(next.cargo,next.cargoGrid.placements).cells,16);
  for(const key of['money','fuel','hull','debt','rng','distance','nextUid','revision','archive','ledger'])assert.deepEqual(next[key],old[key]);
  assert.deepEqual(next.cargo.map(({shapeId,shapeVersion,cells,itemId,...x})=>x),old.cargo);assert.deepEqual(E.restore(next),next);
 }
});
test('legacy ongoing event snapshot keeps its abandoned record independently from the live slot',()=>{const O=require('./legacy-engine.cjs')();let s=O.dispatch(O.create(8),{type:'depart'}).state;s=O.dispatch(s,{type:'travel',id:s.route[0].uid}).state;s=O.dispatch(s,{type:'discard',id:s.cargo[0].uid}).state;const next=E.restore(JSON.parse(JSON.stringify(s)));assert.equal(next.cargo.length,0);assert.equal(next.missionSlot,null);assert(next.event.context.missionSlot);assert.equal(next.event.nonce,s.event.nonce);assert.equal(next.rng,s.rng);E.assertState(next);});
test('invalid legacy saves are rejected in place; malformed current geometry is never auto repaired',()=>{
 const old=E.create(1);old.schema=2;delete old.cargoGrid;old.cargo=[{uid:1,name:'超大旧货',value:1,size:5,acquiredRun:0}];old.nextUid=2;const raw=snapshot(old);assert.throws(()=>E.restore(old));assert.equal(snapshot(old),raw);
 const s=act(fixture(E.create(1),[item(1)]),'depart');s.cargoGrid.placements[0].x=8;assert.throws(()=>E.restore(s));
});
test('a malformed live cargo layout cannot be laundered through a sale or another gameplay action',()=>{
 const s=fixture(E.create(4),[item(1)]);s.cargoGrid.placements=[];const before=snapshot(s);
 for(const action of[{type:'sellAll'},{type:'buyFuel'},{type:'layout',layout:[{uid:1,x:0,y:0,rotation:0}]}]){const r=E.dispatch(s,action);assert(!r.ok);assert.equal(snapshot(r.state),before);}assert.equal(snapshot(s),before);
});
test('opening and cancelling acquisition drafts leave cash, RNG, nonce, sequence and UID untouched',()=>{
 let s=go(act(E.create(81),'depart'));s.event.id='mirror';const before=snapshot(s),action={type:'choose',id:'risk',nonce:s.event.nonce};
 const a=E.cargoDraft(s,action),b=E.cargoDraft(s,action);assert(a.ok);assert.deepEqual(a,b);assert.equal(snapshot(s),before);assert(a.newUids.every(uid=>!s.cargo.some(x=>x.uid===uid)));
 assert(!JSON.stringify(a).includes('核心被固定')); // No uncommitted risk outcome or resolution text.
});
test('invalid acquisition layout fails before payment, damage, RNG, rewards or UID generation',()=>{
 let s=go(act(E.create(81),'depart'));s.event.id='mirror';const before=snapshot(s),a={type:'choose',id:'risk',nonce:s.event.nonce,layout:[]};
 const r=E.dispatch(s,a);assert(!r.ok);assert.equal(snapshot(r.state),before);assert.equal(snapshot(s),before);
});
test('loot action with an explicit complete layout commits exactly once and reloads identically',()=>{
 let s=go(act(E.create(81),'depart'));s.event.id='mirror';const d=E.cargoDraft(s,{type:'choose',id:'risk',nonce:s.event.nonce}),layout=G.solve(d.items);
 const before=snapshot(s),r=E.dispatch(s,{...d.action,layout});assert(r.ok,r.message);assert.equal(snapshot(s),before);E.assertState(r.state);
 assert.equal(r.state.nextUid,s.nextUid+1);assert.equal(r.state.cargo.length,s.cargo.length+1);assert(r.state.hull>=s.hull-22&&r.state.hull<=s.hull-10);assert.deepEqual(E.restore(r.state),r.state);
 assert(!E.dispatch(r.state,{...d.action,layout}).ok);
});
test('geometry-only edits preserve economic, event and route state and stale drafts cannot overwrite them',()=>{
 let s=go(act(fixture(E.create(81),[item(1)]),'depart'));const before=snapshot(s),d=E.cargoDraft(s,{type:'choose',id:'force',nonce:s.event.nonce});
 s=act(s,'layout',{layout:[{uid:s.cargo[0].uid,x:2,y:2,rotation:0}]});
 const prior=JSON.parse(before);for(const key of['rng','money','fuel','hull','debt','distance','route','event','history','nextUid','ledger'])assert.deepEqual(s[key],prior[key]);
 assert(!E.dispatch(s,{...d.action,layout:G.solve(d.items)}).ok);
});
test('full cargo may open a draft and atomically replace explicitly discarded old goods',()=>{
 let s=go(act(E.create(9),'depart'));s=fixture(s,[item(2),item(3),item(4),item(5)]);s.event.id='workshop';
 const before=snapshot(s),a={type:'choose',id:'supply',nonce:s.event.nonce},d=E.cargoDraft(s,a);assert(d.ok);assert(!d.complete);assert.equal(d.items.length,5);assert.equal(snapshot(s),before);
 assert(!E.dispatch(s,a).ok);const d2=E.cargoDraft(s,{...a,discardUids:[2]}),layout=G.solve(d2.items);assert(layout);s=act(s,'choose',{...a,layout,discardUids:[2]});
 assert.equal(s.money,JSON.parse(before).money-35);assert.equal(s.cargo.length,4);assert(!s.cargo.some(x=>x.uid===2));assert.equal(s.cargo.filter(x=>x.ability==='patch').length,1);assert(G.validate(s.cargo,s.cargoGrid.placements).ok);
});
test('same-area zero-cost cargo exchange records both items despite zero net resource delta',()=>{let s=go(act(E.create(9),'depart'));s=fixture(s,[{uid:2,itemId:'metal_crate',name:'旧小件',cells:3,shapeId:'ell3',shapeVersion:1,value:25,acquiredRun:0},item(3)]);s.event.id='cabin';s.tools=['scanner'];const a={type:'choose',id:'scan',nonce:s.event.nonce,discardUids:[2]},draft=E.cargoDraft(s,a),incoming=draft.items.find(x=>draft.newUids.includes(x.uid)),old=s.cargo.find(x=>x.uid===2),before=snapshot(s);const r=E.dispatch(s,{...draft.action,discardUids:[2],layout:G.solve(draft.items)});assert(r.ok,r.message);assert.equal(snapshot(s),before);assert.deepEqual(r.state.result.delta,{money:0,fuel:0,hull:0,cargoCount:0,cargoCells:0});assert.deepEqual({...r.state.result.cargoChanges,added:r.state.result.cargoChanges.added.map(({uid,name,cells})=>({uid,name,cells}))},{added:[{uid:incoming.uid,name:incoming.name,cells:3}],removed:[{uid:old.uid,name:old.name,cells:3,reason:'discard'}]});assert.deepEqual(E.restore(r.state).result.cargoChanges,r.state.result.cargoChanges);assert(!E.dispatch(r.state,{...draft.action,discardUids:[2],layout:G.solve(draft.items)}).ok);});
test('cargo replacement cannot silently discard an accepted task-slot entitlement',()=>{let s=go(act(act(E.create(9),'acceptMission',{id:'survey'}),'depart'));const uid=s.missionSlot.uid,before=snapshot(s);assert(!E.cargoDraft(s,{type:'choose',id:'force',nonce:s.event.nonce,discardUids:[uid]}).ok);assert.equal(snapshot(s),before);s=act(s,'discardMission',{id:uid});s=act(s,'choose',{id:'force',nonce:s.event.nonce});assert.equal(s.run.contractActive,false);assert.equal(s.missionSlot,null);assert.equal(s.debt,12000);});
test('depart preserves fragmented ordinary cargo exactly while the task occupies its independent slot',()=>{let s=fixture(E.create(5),[item(1,'line4'),item(2,'line4')],[{uid:1,x:0,y:0,rotation:1},{uid:2,x:2,y:0,rotation:1}]);const before=JSON.parse(snapshot(s)),draft=E.cargoDraft(s,{type:'depart'});assert(draft.ok&&draft.complete);assert.equal(draft.newUids.length,0);s=act(s,'acceptMission',{id:'survey'});s=act(s,'depart');assert(s.missionSlot);assert.equal(E.used(s),8);assert.deepEqual(s.cargo,before.cargo);assert.deepEqual(s.cargoGrid,before.cargoGrid);});
test('use, sale, discard, contract delivery, abort and rescue release only the removed cells',()=>{
 let s=fixture(E.create(1),[{...item(1),ability:'patch'},item(2)]);s.hull=75;s=act(s,'use',{id:1});assert.deepEqual(s.cargoGrid.placements.map(p=>p.uid),[2]);s=act(s,'sellAll');assert.deepEqual(s.cargoGrid.placements,[]);
 s=act(s,'acceptMission',{id:'survey'});s=act(s,'depart');const uid=s.missionSlot.uid;s=act(s,'abort');assert.equal(s.missionSlot.uid,uid);s=act(s,'abandonMission',{id:E.activeMission(s).uid});assert.equal(s.missionSlot,null);assert(!s.cargoGrid.placements.some(p=>p.uid===uid));s=go(act(s,'depart'));s=act(s,'return');assert.equal(s.cargoGrid.placements.length,0);
 s=fixture(E.create(7),[item(1)]);s=go(act(s,'depart'));s.hull=1;s=act(s,'choose',{id:'force',nonce:s.event.nonce});assert(s.summary.rescue);assert.deepEqual(s.cargo.map(x=>x.uid),[1]);assert.deepEqual(s.cargoGrid.placements.map(x=>x.uid),[1]);
});
test('structured result deltas reflect actual capped changes, not advertised maxima',()=>{
 let s=go(act(E.create(1),'depart'));s.fuel=95;const money=s.money;s=act(s,'choose',{id:'safe',nonce:s.event.nonce});assert.deepEqual(s.result.delta,{money:-30,fuel:5,hull:0,cargoCount:0,cargoCells:0});assert.equal(s.money,money-30);
});
test('route projection contains only actual past nodes and current saved signals without RNG changes',()=>{
 let s=act(E.create(1),'depart');const before=snapshot(s),v=E.routeView(s);assert.equal(v.nodes.length,0);assert.deepEqual(v.candidates,s.route);assert.equal(snapshot(s),before);v.candidates[0].name='changed';assert.notEqual(s.route[0].name,'changed');
 s=go(s);const map=E.routeView(s);assert.equal(map.nodes.length,1);assert.equal(map.nodes[0].id,s.history[0]);assert.equal(map.nodes[0].legFuel,s.legs[0]);assert.equal(map.candidates.length,0);assert(map.nodes[0].current);assert(!JSON.stringify(map).includes('储油罐'));
 s=act(s,'return');assert.equal(E.routeView(s).nodes.length,1);assert(E.routeView(s).done);
});
console.log(JSON.stringify({passed,scope:'Actual geometry, migration and atomic model operations; no phone claims.'}));
if(process.exitCode)process.exit(process.exitCode);
