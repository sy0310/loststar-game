/** Exact model probes on isolated generated fixtures, not elapsed-wall-time or phone evidence. */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createChapter,attachChapter,advanceChapter,restoreChapter,reduceChapter} from '../releases/chapter-model/model.js';
import {makeReviewFixture} from '../releases/ref-ui-fixtures/model.js';
const m=JSON.parse(await fs.readFile('releases/chapter-package.json')),at=1800000000000,rows=[];
for(const player of ['new','legacy27049'])for(const hours of [1,8,24,168]){
 const old=makeReviewFixture('facilities',at).state;old.game.resources=27049;
 const start=player==='new'?createChapter(at):attachChapter(old,true),raw=JSON.stringify(start),endAt=at+hours*3600000;
 const offline=advanceChapter(start,endAt,true),claim=reduceChapter(offline,{type:'claim'},endAt),settled=claim.state;
 assert.equal(JSON.stringify(start),raw);assert(settled.game.resources>=0);assert.equal(settled.game.lastAt,endAt);
 assert.deepEqual(settled.receipt.verifiedEvidenceIds,start.receipt.verifiedEvidenceIds);
 for(const id of start.game.collection)assert(settled.game.collection.includes(id));
 if(player==='legacy27049'){
  assert.deepEqual(settled.projects,start.projects);assert.deepEqual(settled.progression.abilities,start.progression.abilities);assert.deepEqual(settled.game.growth,start.game.growth);assert.equal(settled.receipt.condition,start.receipt.condition);assert(settled.game.resources>=27049);
 }else assert.equal(settled.chapter.revealWorldMs,null,'unclaimed discovery timestamps may not invent an earlier night');
 const ledger=JSON.parse(JSON.stringify(settled.game));let reloaded=settled;
 for(let i=0;i<3;i++){reloaded=restoreChapter(JSON.stringify(reloaded),endAt);assert.deepEqual(JSON.parse(JSON.stringify(reloaded.game)),ledger);assert.equal(reduceChapter(reloaded,{type:'claim'},endAt).result.ok,false);}
 rows.push({player,hours,initialParts:start.game.resources,pendingParts:offline.game.pendingReturn?.resources??0,settledParts:settled.game.resources,repairDelta:settled.game.station.repairSpent-start.game.station.repairSpent,grossIncomeDelta:settled.game.station.grossIncome-start.game.station.grossIncome,collection:settled.game.collection.length,revealWorldMs:settled.chapter.revealWorldMs,threeIdenticalReloads:true,repeatClaimRejected:true,rightsAndEvidenceRetained:true});
}
await fs.writeFile('artifacts/chapter-one-followup/checks/long-offline.json',JSON.stringify({sourceCommit:m.sourceCommit,method:'Deterministic original-model time advance; QA/generated fixtures, not real-time seven-day or physical-phone test.',rows},null,2)+'\n');console.log(JSON.stringify(rows));
