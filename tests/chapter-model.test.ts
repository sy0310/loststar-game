import {test,expect} from 'vitest';
import {createChapter,advanceChapter,reduceChapter,restoreChapter,attachChapter,chapterSchedule,chapterQaFixture,chapterSummary,chapterLinks,chapterReturnView} from '../src/chapter/model';
import {chapterContent} from '../src/chapter/content';
import {firstPlanetFixture} from '../scripts/firstplanet_fixtures';
const at=1800000000000;
test('ordinary unpaid route earns all original12, one legal reveal and ending without changing evidence or buying treatment',()=>{
 let s=createChapter(at),eligible=false,revealed=false;
 for(let i=1;i<=1100;i++){const before=s;s=advanceChapter(s,at+i*1000);if(s.chapter.eligibleWorldMs!==null)eligible=true;if(s.chapter.revealWorldMs!==null){revealed=true;expect(s.chapter.revealWorldMs).toBe(chapterSchedule(s)!.end);expect(s.game.world.elapsedMs).toBeGreaterThanOrEqual(s.chapter.revealWorldMs);}}
 expect(eligible&&revealed).toBe(true);expect(s.chapter.endingWorldMs).not.toBeNull();expect(s.game.collection).toHaveLength(12);expect(s.receipt.condition).toBe('found');expect(Object.values(s.curios).every(c=>c.condition==='found')).toBe(true);expect(s.receipt.transactions).toEqual([]);expect(s.receipt.verifiedEvidenceIds).not.toContain('signature');expect(s.chapter.logs.filter(l=>l.event==='chapter-occurred')).toHaveLength(2);
 const restored=restoreChapter(JSON.stringify(s),s.game.lastAt);expect(restored.chapter).toEqual(s.chapter);
});
test('old27049 full rights only give eligibility, then a new legal event; no fee, downgrade or invented signature',()=>{
 const old=firstPlanetFixture(at,3,'stabilized').state;old.game.resources=27049;const raw=JSON.stringify(old),s=attachChapter(old);expect(JSON.stringify(old)).toBe(raw);expect(s.chapter.revealWorldMs).toBeNull();const before=structuredClone(s);const schedule=chapterSchedule(s)!;const elapsed=schedule.end-s.game.world.elapsedMs;
 const end=advanceChapter(s,s.game.lastAt+elapsed);expect(end.chapter.revealWorldMs).toBe(schedule.end);expect(end.receipt.condition).toBe('stabilized');expect(end.projects).toEqual(before.projects);expect(end.progression.abilities).toEqual(before.progression.abilities);expect(end.receipt.verifiedEvidenceIds).toEqual(before.receipt.verifiedEvidenceIds);expect(end.chapter.read).toEqual([]);
});
test('out-of-order ownership and pending cargo cannot prematurely reveal relations or create an event on claim',()=>{
 let s=createChapter(at);s.game.collection=['stamp'];expect(chapterLinks(s,'stamp')).toEqual([]);s.game.collection.push('receipt');expect(chapterLinks(s,'stamp')).toHaveLength(1);s.game.pendingReturn={id:'cargo',seconds:60,resources:50,discoveries:['cosmic-parcel']};s=advanceChapter(s,at+280000);expect(s.chapter.eligibleWorldMs).toBeNull();s=reduceChapter(s,{type:'claim'},s.game.lastAt).state;expect(s.chapter.eligibleWorldMs).toBe(s.game.world.elapsedMs);expect(s.chapter.logs.filter(l=>l.event==='chapter-occurred')).toHaveLength(0);expect(s.chapter.revealWorldMs).toBeNull();expect(chapterSchedule(s)!.start).toBeGreaterThan(s.game.world.elapsedMs);
});
test('offline earns cargo first, one claim, later offline lawful night retained unread without repeat rewards',()=>{
 let s=advanceChapter(createChapter(at),at+1200000,true);expect(s.game.pendingReturn?.discoveries.length).toBeGreaterThan(3);expect(s.chapter.revealWorldMs).toBeNull();expect(chapterSummary(s).kind).toBe('return');s=reduceChapter(s,{type:'claim'},s.game.lastAt).state;const paid=s.game.resources;expect(reduceChapter(s,{type:'claim'},s.game.lastAt).result.ok).toBe(false);s=advanceChapter(s,s.game.lastAt+300000,true);expect(s.chapter.revealWorldMs).not.toBeNull();expect(s.chapter.read).toEqual([]);const ledger=structuredClone(s.game);for(let i=0;i<3;i++)s=reduceChapter(s,{type:'chapter',kind:'read',id:'reveal',source:'replay'},s.game.lastAt).state;expect(s.game).toEqual(ledger);expect(s.chapter.logs.filter(l=>l.event==='read')).toHaveLength(1);
});
test('all six state lines are unique approved content and optional combo neither charges nor gates',()=>{
 expect(Object.keys(chapterContent)).toHaveLength(6);expect(Object.values(chapterContent).flatMap(c=>c.states)).toHaveLength(18);const s=chapterQaFixture('ending',at),before=structuredClone(s.game);const after=reduceChapter(s,{type:'chapter',kind:'try',id:'combo'},at).state;expect(after.game).toEqual(before);expect(after.chapter.endingWorldMs).toBe(s.chapter.endingWorldMs);
});
test('instant clean original charge once, upgrade original duration survives refresh and stops no clocks',()=>{
 let s=chapterQaFixture('ending',at);for(const id of Object.keys(chapterContent)){const before=s.game.resources,a=id==='receipt'?{type:'paper' as const,kind:'clean' as const}:{type:'curio' as const,id,kind:'clean' as const};s=reduceChapter(s,a,s.game.lastAt).state;expect(s.game.resources).toBe(before-({receipt:40,tape:30,nested:50,stamp:45,'cosmic-parcel':60,bell:35} as Record<string,number>)[id]);expect((id==='receipt'?s.receipt:s.curios[id]).condition).toBe('clean');const duplicate=reduceChapter(s,a,s.game.lastAt);expect(duplicate.result.ok).toBe(false);expect(duplicate.state.game.resources).toBe(s.game.resources);}
 s=reduceChapter(s,{type:'curio',id:'bell',kind:'repair'},s.game.lastAt).state;const restored=restoreChapter(JSON.stringify(s),s.game.lastAt+1000);expect(restored.curios.bell.condition).toBe('clean');expect(advanceChapter(restored,restored.game.lastAt+2000).curios.bell.condition).toBe('stabilized');
});
test('clock rollback leaves timeline intact; telemetry can be disabled, does not log after',()=>{
 let s=chapterQaFixture('ending',at);expect(advanceChapter(s,at-1)).toBe(s);s=reduceChapter(s,{type:'chapter',kind:'telemetry',id:'logs',enabled:false},at).state;s=reduceChapter(s,{type:'chapter',kind:'open',id:'reveal'},at).state;expect(s.chapter.logs).toEqual([]);
});

test('return priorities distinguish real curios, occurred chapter, associations, residents, records and routine',()=>{
 let s=chapterQaFixture('ending',at);s.game.collection=s.game.collection.filter(id=>!['mouse','bell','return-request'].includes(id));s.game.pendingReturn={id:'r',seconds:32,resources:20,discoveries:['mouse']};expect(chapterReturnView(s)?.kind).toBe('reveal');s=reduceChapter(s,{type:'chapter',kind:'read',id:'reveal'},at).state;expect(chapterReturnView(s)?.kind).toBe('ending');s=reduceChapter(s,{type:'chapter',kind:'read',id:'ending'},at).state;expect(chapterReturnView(s)?.kind).toBe('link');s=reduceChapter(s,{type:'chapter',kind:'read',id:'link/stamp'},at).state;expect(chapterReturnView(s)?.kind).toBe('resident');s.game.pendingReturn!.discoveries=['return-request'];expect(chapterReturnView(s)?.kind).toBe('record');s.game.pendingReturn!.discoveries=[];expect(chapterReturnView(s)?.kind).toBe('daily');s.game.pendingReturn!.discoveries=['bell','mouse'];expect(chapterReturnView(s)?.kind).toBe('curio');
});
test('many real return views never evict permanent first-discovery and ending reading marks on restore',()=>{
 let s=chapterQaFixture('ending',at);const ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'].map(id=>'curio/'+id).concat(['reveal','ending','link/stamp']);for(const id of ids)s=reduceChapter(s,{type:'chapter',kind:'read',id},at).state;
 for(let i=0;i<100;i++){s.game.pendingReturn={id:'return-'+i,seconds:32,resources:0,discoveries:[]};s=reduceChapter(s,{type:'chapter',kind:'read',id:'return/'+s.game.pendingReturn.id},at).state;}
 s=restoreChapter(JSON.stringify(s),at);for(const id of ids)expect(s.chapter.read).toContain(id);expect(s.chapter.read.filter(id=>id.startsWith('return/'))).toHaveLength(8);s.game.pendingReturn=null;expect(chapterSummary(s).kind).toBe('complete');
});

test('old owned baseline and duplicate manifest items are not advertised as newly acquired again',()=>{
 let s=attachChapter(firstPlanetFixture(at,3,'stabilized').state);expect(chapterSummary(s).kind).toBe('daily');expect(s.chapter.baselineOwned).toEqual(s.game.collection);s.game.pendingReturn={id:'old-manifest',seconds:32,resources:0,discoveries:['receipt']};s=reduceChapter(s,{type:'chapter',kind:'read',id:'link/stamp'},s.game.lastAt).state;expect(chapterReturnView(s)?.kind).toBe('daily');const r=restoreChapter(JSON.stringify(s),s.game.lastAt);expect(r.chapter.baselineOwned).toEqual(s.chapter.baselineOwned);expect(r.receipt.condition).toBe('stabilized');
});
