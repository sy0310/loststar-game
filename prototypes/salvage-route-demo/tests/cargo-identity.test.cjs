/* Inventory must cover real content without changing economic or archive identities. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const E=require('../src/engine.js'),I=require('../src/cargo-identity.js');
const O=require('./legacy-engine.cjs')('754113a197e52762a80de5e33a45192074f2a99b');
const src=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');
const sandbox={module:{exports:{}},require:n=>n==='./cargo-layout.js'?E.Cargo:n.includes('BALANCE_V041')?E.PORT:E.BALANCE};
vm.runInNewContext(src.replace('return {VERSION,SCHEMA','return {catalogueEvents:EVENTS,VERSION,SCHEMA'),sandbox);
const X=sandbox.module.exports,s=X.create(42),goods=[];
for(const fn of Object.values(X.catalogueEvents))for(const c of fn(s).choices)goods.push(...(c.effect.loot||[]));
goods.push(...Object.values(E.PORT.products));
const multi=new Map(goods.filter(x=>x.shapeId!=='point1').map(x=>[x.itemId+':'+x.shapeId,x]));
assert.equal(multi.size,14);
for(const x of multi.values()){
 const spec=I.resolve(x);assert.notEqual(spec.kind,'preserved-packaging',x.name);
 assert(spec.kind==='identity'||x.itemId==='metal_crate');
}
const byShape={};for(const x of multi.values())(byShape[x.shapeId]??=[]).push(I.resolve(x).src);
for(const a of Object.values(byShape))assert.equal(new Set(a).size,a.length,'same footprint categories need distinct whole images');
assert.equal(I.pairs.length,11);assert.equal(I.retained.length,3);
const old=JSON.parse(JSON.stringify(O.create(19)));old.money=27049;
assert.deepEqual(E.restore(old),old,'schema6 rights must be completely unchanged, no UI migration required');
assert.deepEqual(JSON.parse(JSON.stringify(E.PORT)),JSON.parse(JSON.stringify(O.PORT)),'no price or model tuning hidden in art changes');
assert.equal(E.SCHEMA,O.SCHEMA);
const dir=path.join(__dirname,'../verification');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'cargo-identity.json'),JSON.stringify({passed:5,naturalMultiPairs:multi.size,newImages:I.pairs.length,retainedMetalBodies:I.retained.length,source:'Actual current event factories and port product definitions; QA-only memory exposure, not a gameplay export.',pairs:[...multi.values()].map(x=>({itemId:x.itemId,shapeId:x.shapeId,src:I.resolve(x).src})),schema6Unchanged:true,economicConfigUnchanged:true},null,2)+'\n');
console.log('PASS5 identity inventory,14 actual multi-cell combinations,11 unique new bodies,unchanged schema6 and costs');
