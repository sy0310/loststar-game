/* Immutable pre-rework model used for genuine schema2/3 compatibility and balance comparisons. */
const vm=require('node:vm'),cp=require('node:child_process'),path=require('node:path');
module.exports=function loadLegacy(revision='b26455ada31fe1ab780905cdb1c26f1387c082bb'){
 const root=path.resolve(__dirname,'../../..'),read=file=>cp.execFileSync('git',['show',revision+':prototypes/salvage-route-demo/src/'+file],{cwd:root,encoding:'utf8'});
 const geometry={module:{exports:{}}};vm.runInNewContext(read('cargo-layout.js'),geometry);
 const model={module:{exports:{}},require:name=>name==='./cargo-layout.js'?geometry.module.exports:JSON.parse(cp.execFileSync('git',['show',revision+':design/star-salvage/'+(name.includes('BALANCE_V04')?'v04/BALANCE_V04.json':'BALANCE_V01.json')],{cwd:root,encoding:'utf8'}))};vm.runInNewContext(read('engine.js'),model);return model.module.exports;
};
