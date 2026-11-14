/* Inventory must cover real content without changing economic or archive identities. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const E=require('../src/engine.js'),I=require('../src/cargo-identity.js');
const O=require('./legacy-engine.cjs')('754113a197e52762a80de5e33a45192074f2a99b');
const src=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');
const sandbox={module:{exports:{}},require:require('node:module').createRequire(path.join(__dirname,'../src/engine.js'))};
vm.runInNewContext(src.replace('return {Holds,Market,NewEncounters,V05,V051,VERSION,SCHEMA','return {catalogueEvents:EVENTS,Holds,Market,NewEncounters,V05,V051,VERSION,SCHEMA'),sandbox);
const X=sandbox.module.exports,s=X.create(42),goods=[];assert.equal(Object.keys(X.catalogueEvents).length,26);
for(const fn of Object.values(X.catalogueEvents))for(const c of fn(s).choices)goods.push(...(c.effect.loot||[]));
goods.push(...Object.values(E.PORT.products));
const multi=new Map(goods.filter(x=>x.shapeId!=='point1').map(x=>[x.itemId+':'+x.shapeId,x]));
assert.equal(multi.size,18);
for(const x of multi.values()){
 const spec=I.resolve(x);assert.notEqual(spec.kind,'preserved-packaging',x.name);
 assert(spec.kind==='identity'||x.itemId==='metal_crate');
}
const byShape={};for(const x of multi.values())(byShape[x.shapeId]??=[]).push(I.resolve(x).src);
for(const a of Object.values(byShape))assert.equal(new Set(a).size,a.length,'same footprint categories need distinct whole images');
assert.equal(I.pairs.length,11);assert.equal(I.retained.length,3);
const old=JSON.parse(JSON.stringify(O.create(19)));old.money=27049;
const migrated=E.restore(old);for(const key of Object.keys(old).filter(key=>!['schema','version','migration'].includes(key)))assert.deepEqual(migrated[key],old[key],key+' schema6 rights');assert.deepEqual(E.restore(migrated),migrated);assert.equal(migrated.hold.mode,'bc');
assert.deepEqual(JSON.parse(JSON.stringify(E.PORT)),JSON.parse(JSON.stringify(O.PORT)),'no price or model tuning hidden in art changes');
assert.equal(E.SCHEMA,8);assert.equal(O.SCHEMA,6);assert.equal(I.curios.length,4);
const dir=path.join(__dirname,'../verification');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'cargo-identity.json'),JSON.stringify({passed:5,naturalMultiPairs:multi.size,newImages:I.pairs.length,newCurioImages:I.curios.length,retainedMetalBodies:I.retained.length,source:'Actual current event factories and port product definitions; QA-only memory exposure, not a gameplay export.',pairs:[...multi.values()].map(x=>({itemId:x.itemId,shapeId:x.shapeId,src:I.resolve(x).src})),schema6RightsPreserved:true,economicConfigUnchanged:true},null,2)+'\n');
console.log('PASS5 identity inventory,18 actual multi-cell combinations,15 new bodies across0.4.2/0.5,schema6 rights and costs preserved');
