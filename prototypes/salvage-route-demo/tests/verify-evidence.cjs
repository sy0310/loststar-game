/* Frozen evidence binds source, package bytes and recorded checks separately.
 * Historical 0.1.1 evidence remains checked when 0.2.0 supersedes the runtime.
 * Neither a desktop browser pass nor unfinished delivery is phone acceptance. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const demo='prototypes/salvage-route-demo/',oldFolder='artifacts/salvage-route/';
const upgradeFolder='artifacts/salvage-route-upgrade/';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const json=name=>JSON.parse(fs.readFileSync(local(name),'utf8'));
const sourceCache=new Map();

function local(name){
 assert.equal(typeof name,'string','evidence path must be a repository-relative string');
 assert(name&&!name.includes('\\')&&!name.includes('\0')&&!path.posix.isAbsolute(name));
 assert.equal(path.posix.normalize(name),name,'noncanonical evidence path: '+name);
 assert(!name.split('/').includes('..'),'evidence path escapes repository: '+name);
 return path.join(root,name);
}
function source(sha,name){
 const key=sha+':'+name;
 if(!sourceCache.has(key))sourceCache.set(key,git(['show',key]));
 return sourceCache.get(key);
}
function ancestor(sha){
 assert(/^[a-f0-9]{40}$/.test(sha),'invalid runtimeSourceSha');
 git(['merge-base','--is-ancestor',sha,'HEAD']);
}
function records(items,label){
 assert(Array.isArray(items)&&items.length,label+' must contain file records');
 const result=new Map();
 for(const item of items){
  local(item.path);assert(!result.has(item.path),'duplicate '+label+' path: '+item.path);
  assert(Number.isSafeInteger(item.bytes)&&item.bytes>0,'invalid bytes: '+item.path);
  assert(/^[a-f0-9]{64}$/.test(item.sha256),'invalid SHA256: '+item.path);
  result.set(item.path,item);
 }
 return result;
}
function verifyEvidence(items,label){
 const index=records(items,label);
 for(const [name,item]of index){
  assert(fs.lstatSync(local(name)).isFile(),'evidence must be a regular file: '+name);
  const raw=fs.readFileSync(local(name));
  assert.equal(raw.length,item.bytes,'evidence bytes: '+name);
  assert.equal(hash(raw),item.sha256,'evidence hash: '+name);
 }
 return index;
}
function boundJSON(name,evidence){
 assert(evidence.has(name),'referenced report is not hash-bound: '+name);
 return json(name);
}
function packagedSourceNames(sha){
 return git(['ls-tree','-r','--name-only','-z',sha,'--',demo+'src',demo+'assets',demo+'index.html'])
  .toString().split('\0').filter(Boolean).sort();
}
function runtimeNames(sha){return [...packagedSourceNames(sha),demo+'build.py','design/star-salvage/BALANCE_V01.json'].sort();}
function diskFiles(folder){
 return fs.readdirSync(local(folder),{withFileTypes:true}).flatMap(entry=>{
  const name=folder+'/'+entry.name;
  if(entry.isDirectory())return diskFiles(name);
  assert(entry.isFile(),'runtime must contain regular files: '+name);
  return [name];
 });
}
function assertCurrentRuntime(sha){
 const expected=runtimeNames(sha);
 const actual=[...diskFiles(demo+'src'),...diskFiles(demo+'assets'),demo+'index.html',demo+'build.py','design/star-salvage/BALANCE_V01.json'].sort();
 assert.deepEqual(actual,expected,'runtime file set changed; refresh frozen package proof');
 for(const name of expected){
  assert.equal(hash(fs.readFileSync(local(name))),hash(source(sha,name)),
   'runtime changed; refresh frozen package proof: '+name);
 }
}
// build.py uses Python's JSON spacing for the two metadata objects in index.html.
function spacedJSON(value){return JSON.stringify(value).replace(/("(?:\\.|[^"\\])*")|([,:])/g,(all,string,punctuation)=>string||punctuation+' ');}
function expectedPackage(sha){
 const names=packagedSourceNames(sha),result=new Map();
 const version=/\bVERSION='([^']+)'/.exec(source(sha,demo+'src/engine.js').toString())?.[1];
 assert(version,'frozen engine version missing');
 const art={ship:'./assets/ship.webp'};
 for(const name of ['ship','port','wreck','harbor'])if(names.includes(demo+'assets/'+name+'.webp'))art[name]='./assets/'+name+'.webp';
 const build={version,commit:sha,dirty:false,blindTest:true};
 for(const name of names){
  let raw=source(sha,name);
  if(name===demo+'src/balance.js'){
   raw=Buffer.from('globalThis.LostCargoBalance='+JSON.stringify(JSON.parse(source(sha,'design/star-salvage/BALANCE_V01.json')))+';\n');
  }else if(name===demo+'index.html'){
   const html=raw.toString(),marker="const ART={ship:'./assets/ship.webp'};";
   assert.equal(html.split(marker).length,2,'frozen build HTML injection marker');
   raw=Buffer.from(html.replace(marker,'const ART='+spacedJSON(art)+';window.LostCargoBuild='+spacedJSON(build)+';'));
  }
  result.set('loststar-salvage/'+name.slice(demo.length),{bytes:raw.length,sha256:hash(raw)});
 }
 return {files:result,build};
}
function comparePackageFiles(items,expected,label){
 const actual=records(items,label);
 assert.deepEqual([...actual.keys()].sort(),[...expected.keys()].sort(),label+' complete file set');
 for(const [name,value]of expected){
  assert.equal(actual.get(name).bytes,value.bytes,label+' bytes: '+name);
  assert.equal(actual.get(name).sha256,value.sha256,label+' SHA256: '+name);
 }
 return actual;
}
function verifyBuild(p,build){
 assert.equal(build.kind,'frozen_build');assert.equal(build.dirtySource,false);
 assert.equal(build.sourceCommit,p.runtimeSourceSha);assert.equal(build.sha256,p.zip.sha256);
 assert.equal(build.bytes,p.zip.bytes);assert.equal(build.archive,p.zip.filename);
 assert.equal(build.files,p.zip.files);assert.equal(build.entry,'loststar-salvage/index.html');
 assert.equal(build.storageDatabase,'lostcargo.route-demo.v1');assert.equal(build.physicalPhoneTested,false);
 assert.equal(build.blindTest,true);assert.equal(p.zip.dirty,false);
}
function verifyBrowser(report,expected){
 assert.equal(report.stats.expected,expected);assert.equal(report.stats.unexpected,0);
 assert.equal(report.stats.skipped,0);assert.equal(report.stats.flaky,0);
 assert.deepEqual(report.errors,[],'browser report global errors');
 const projects=['chromium360','chromium390','webkit360','webkit390'];
 assert.deepEqual(report.config.projects.map(x=>x.name).sort(),projects);
 for(const project of report.config.projects){assert.equal(project.retries,0);assert.equal(project.repeatEach,1);}
 const tests=[],identities=new Set(),perProject=Object.fromEntries(projects.map(name=>[name,0]));
 function visit(suites){for(const suite of suites){
  for(const spec of suite.specs||[]){
   assert.equal(spec.ok,true,'browser spec failed: '+spec.title);
   for(const test of spec.tests){
    const key=JSON.stringify([spec.file,spec.title,test.projectName]);
    assert(!identities.has(key),'duplicate browser test: '+key);identities.add(key);
    assert(projects.includes(test.projectName),'unexpected browser project');
    assert.equal(test.expectedStatus,'passed');assert.equal(test.status,'expected');
    assert.equal(test.results.length,1,'browser result must not hide retries: '+key);
    const run=test.results[0];assert.equal(run.status,'passed');assert.equal(run.retry,0);
    assert.deepEqual(run.errors,[],'browser result errors: '+key);assert(!run.error);
    perProject[test.projectName]++;tests.push(test);
   }
  }
  visit(suite.suites||[]);
 }}
 visit(report.suites);assert.equal(tests.length,expected,'browser actual executed test count');
 for(const project of projects)assert.equal(perProject[project],expected/projects.length,project+' actual passed count');
 return report.stats;
}
function verifyHistorical(p){
 ancestor(p.runtimeSourceSha);assert.equal(p.schema,1);assert.equal(p.zip.files,7);
 const evidence=verifyEvidence(p.evidenceFiles,'historical evidence');
 const build=boundJSON(oldFolder+'build-info.json',evidence);
 const tap=boundJSON(oldFolder+'taptap-receipt.json',evidence);
 const http=boundJSON(oldFolder+'package-http.json',evidence);
 verifyBuild(p,build);
 assert.equal(tap.zipSha256,build.sha256);assert.equal(tap.taptap.package_id,p.taptap.version);
 assert.equal(tap.taptap.file_size,build.bytes);assert.equal(tap.taptap.original_file_name,build.archive);
 assert.equal(tap.mainModuleUnchanged,true);assert.equal(tap.boundMainPackage,false);
 assert.equal(tap.taptap.is_releasing,false);assert.equal(p.taptap.formalBound,false);assert.equal(p.taptap.releasing,false);
 assert.equal(http.sourceCommit,p.runtimeSourceSha);assert.equal(http.zipSha256,p.zip.sha256);
 assert.equal(http.allHttpBytesMatchZip,true);assert.equal(http.files.length,build.files);
 for(const file of http.files)assert.equal(file.status,200);
 // Historical runtime is compared to its own HTTP file hashes, not today's files.
 comparePackageFiles(http.files,expectedPackage(p.runtimeSourceSha).files,'historical package/source');
 assert.equal(p.fixedPackageBrowser.expected,56);
 for(const name of ['fixed-http-browser.json','ci-http-browser.json']){
  verifyBrowser(boundJSON(oldFolder+'checks/'+name,evidence),56);
 }
 assert.equal(p.ci.sameZipSha256,p.zip.sha256);assert.equal(p.physicalPhone,'NOT_TESTED');
}
function readZipFiles(name){
 // Inspect in memory; never extract untrusted paths or depend on an ignored dist/.
 const result=cp.execFileSync('python3',['-c',
  'import hashlib,json,stat,sys,zipfile\n'+
  'with zipfile.ZipFile(sys.argv[1]) as z:\n'+
  ' entries=z.infolist()\n'+
  ' assert len(entries)==13, "expected all 13 package files"\n'+
  ' assert sum(i.file_size for i in entries)<32*1024*1024, "unexpected package expansion"\n'+
  ' result=[]\n'+
  ' for i in entries:\n'+
  '  assert not i.is_dir() and not stat.S_ISLNK(i.external_attr>>16), "nonregular ZIP entry"\n'+
  '  raw=z.read(i)\n'+
  '  result.append({"path":i.filename,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})\n'+
  ' print(json.dumps(result))\n',local(name)],{encoding:'utf8',maxBuffer:1024*1024});
 return JSON.parse(result);
}
function verifyCapture(p,manifest,evidence,packageFiles,stats,build,folder=upgradeFolder){
 assert.equal(manifest.runtimeSourceSha,p.runtimeSourceSha);assert.equal(manifest.zipSha256,p.zip.sha256);
 assert.equal(manifest.completed,true);assert.deepEqual(manifest.build,build);
 assert.deepEqual(manifest.browserStats,stats);assert.equal(manifest.scope.physicalPhoneTested,false);
 assert.equal(manifest.scope.humanEnjoymentTested,false);
 assert.equal(manifest.archive.sha256,p.zip.sha256);assert.equal(manifest.archive.bytes,p.zip.bytes);
 assert.equal(manifest.archive.files,13);assert.equal(manifest.archive.sourceCommit,p.runtimeSourceSha);
 assert.equal(manifest.archive.dirtySource,false);
 assert.deepEqual(manifest.packageFiles,Object.fromEntries([...packageFiles].map(([name,item])=>[name,item.sha256])),
  'capture must bind the same complete package file set');
 const media=verifyEvidence(manifest.files,'capture evidence');
 for(const [name,item]of media){
  assert(evidence.has(name),'capture file is missing from top-level evidence: '+name);
  assert.deepEqual(item,evidence.get(name),'capture evidence disagrees with top-level manifest: '+name);
 }
 const report=boundJSON(manifest.report,media);
 assert.equal(report.completed,true);assert.deepEqual(report.errors,[]);assert.deepEqual(report.build,build);
 for(const name of ['imported','seedOverridden','clockOverridden'])assert.equal(report.natural[name],false);
 assert.equal(report.qa.imported,true);
 const E=require('./legacy-engine.cjs')(p.runtimeSourceSha);
 function checkpoints(list){
  const result=new Map();
  for(const point of list){assert(!result.has(point.name),'duplicate capture checkpoint');E.assertState(point.state);result.set(point.name,point.state);}
  return result;
 }
 const natural=checkpoints(report.natural.checkpoints),qa=checkpoints(report.qa.checkpoints);
 assert.equal(natural.size,13);assert.equal(qa.size,4);
 assert.equal(manifest.checkpoints.natural,natural.size);assert.equal(manifest.checkpoints.qa,qa.size);
 for(const run of [1,2]){
  assert.equal(natural.get('before-voyage-'+run)?.phase,'port');
  for(const step of [1,2,3]){
   const point=natural.get(`voyage-${run}-event-${step}`);
   assert.equal(point?.phase,'event');assert.equal(point.runNo,run);assert.equal(point.depth,step);
  }
  const returned=natural.get('returned-voyage-'+run),saved=natural.get('saved-after-voyage-'+run);
  assert.equal(returned?.phase,'summary');assert.equal(returned.runNo,run);
  assert.equal(saved?.phase,'port');assert.equal(saved.runNo,run);
 }
 assert.deepEqual(natural.get('saved-after-voyage-1'),natural.get('reopened-before-second-voyage'));
 assert.deepEqual(natural.get('reopened-before-second-voyage'),natural.get('before-voyage-2'));
 for(const name of ['generic-cargo-before','tap-rotated-and-saved','dragged-and-saved','reload-preserved'])assert(qa.has(name),'missing QA checkpoint: '+name);
 assert.notDeepEqual(qa.get('generic-cargo-before').cargoGrid,qa.get('tap-rotated-and-saved').cargoGrid);
 assert.notDeepEqual(qa.get('tap-rotated-and-saved').cargoGrid,qa.get('dragged-and-saved').cargoGrid);
 assert.deepEqual(qa.get('dragged-and-saved'),qa.get('reload-preserved'));
 for(const name of ['natural-voyage-1.webm','natural-voyage-2.webm','qa-rotate-drag-persist.webm']){
  const file=folder+'developer/capture/'+name;assert(media.has(file),'missing completed recording: '+name);
  assert.equal(fs.readFileSync(local(file)).subarray(0,4).toString('hex'),'1a45dfa3','recording is not WebM: '+name);
 }
}
function verifyPlatform(platform,evidence,zip){
 assert.equal(platform.formalBound,false);assert.equal(platform.releasing,false);
 const pending=['IN_PROGRESS','PENDING_LOCAL_CODEX_DELIVERY','NOT_UPLOADED_DOWNLOAD_PERMISSION_DENIED'];
 if(pending.includes(platform.status)){
  assert.equal(platform.previousPackageId,453037,'preserve the historical development-package identity');
  assert.equal(platform.currentPackageId??null,null,'pending delivery must not claim a new TapTap package');
  assert(typeof platform.handoffReason==='string'&&platform.handoffReason.trim(),'pending delivery needs an honest reason');
 }else{
  assert.equal(platform.status,'UPLOADED_DEVELOPMENT_SELF_TEST','unknown platform delivery state');
  const receipt=boundJSON(platform.receipt,evidence);
  // zipSha256 identifies the local uploaded file. A rounded console display is
  // useful readback, but must never be fabricated into exact remote byte/hash data.
  assert.equal(receipt.zipSha256,zip.sha256);
  if(receipt.taptap.file_size===null){
   assert.equal(receipt.sizeVerification,'DISPLAY_ROUNDED_ONLY');
   assert(typeof receipt.displayedFileSize==='string'&&receipt.displayedFileSize.trim());
  }else{
   assert.equal(receipt.taptap.file_size,zip.bytes);
   assert.notEqual(receipt.sizeVerification,'DISPLAY_ROUNDED_ONLY');
  }
  assert.equal(typeof receipt.remoteZipDigestProvided,'boolean');
  if(receipt.remoteZipDigestProvided)assert.equal(receipt.remoteZipSha256,zip.sha256);
  else assert.equal(receipt.remoteZipSha256??null,null,'local package hash is not a recomputed platform hash');
  assert.equal(receipt.taptap.original_file_name,zip.filename);
  assert.equal(receipt.taptap.package_id,platform.currentPackageId);
  assert(Number.isSafeInteger(platform.currentPackageId)&&platform.currentPackageId>0);
  assert.equal(receipt.mainModuleUnchanged,true);assert.equal(receipt.boundMainPackage,false);
  assert.equal(receipt.taptap.is_releasing,false);
 }
}
function verifyUpgrade(p,requireCurrent=true){
 assert.equal(p.schema,2);ancestor(p.runtimeSourceSha);if(requireCurrent)assertCurrentRuntime(p.runtimeSourceSha);
 assert.equal(p.zip.files,13);assert.equal(p.zip.filename,'loststar-salvage-'+p.runtimeSourceSha.slice(0,7)+'.zip');
 const evidence=verifyEvidence(p.evidenceFiles,'upgrade evidence');
 const build=boundJSON(p.buildInfo,evidence);verifyBuild(p,build);
 assert(evidence.has(p.zip.path),'actual ZIP must be committed and hash-bound');
 const raw=fs.readFileSync(local(p.zip.path));assert.equal(raw.length,p.zip.bytes);assert.equal(hash(raw),p.zip.sha256);
 const expected=expectedPackage(p.runtimeSourceSha);
 const actual=comparePackageFiles(readZipFiles(p.zip.path),expected.files,'actual ZIP/frozen source');
 comparePackageFiles(p.packageFiles,actual,'declared package manifest');
 const browser=p.fixedPackageBrowser;
 assert.equal(browser.runtimeSourceSha,p.runtimeSourceSha);assert.equal(browser.zipSha256,p.zip.sha256);
 assert.equal(browser.expected,96);
 for(const name of ['unexpected','skipped','flaky','retries'])assert.equal(browser[name],0);
 const stats=verifyBrowser(boundJSON(browser.report,evidence),96);
 assert.equal(p.capture.runtimeSourceSha,p.runtimeSourceSha);assert.equal(p.capture.zipSha256,p.zip.sha256);
 verifyCapture(p,boundJSON(p.capture.manifest,evidence),evidence,actual,stats,expected.build);
 assert.equal(p.physicalPhone,'NOT_TESTED');verifyPlatform(p.platform,evidence,p.zip);
 console.log('PASS upgrade frozen runtime, actual ZIP and all 13 files, 96 browser checks without skips/retries/errors, and completed same-build capture; platform '+p.platform.status+'; phone remains NOT_TESTED');
}

const historical=json(oldFolder+'verification.json');
verifyHistorical(historical);
const upgrade=upgradeFolder+'verification.json';
if(fs.existsSync(local(upgrade))){
 verifyUpgrade(json(upgrade),!fs.existsSync(local('artifacts/salvage-mobile-v03/verification.json')));
 console.log('PASS historical salvage evidence preserved: original source/HTTP hashes, all evidence bytes, 56+56 browser results and unbound TapTap receipt');
}else{
 // Before the upgrade proof lands, keep the original fail-closed runtime gate.
 assertCurrentRuntime(historical.runtimeSourceSha);
 console.log('PASS frozen salvage runtime, original package/source hashes, all evidence bytes, independent HTTP/CI results and unbound TapTap receipt; phone remains NOT_TESTED');
}

const mobile='artifacts/salvage-mobile-v03/verification.json';
if(fs.existsSync(local(mobile))){
 const p=json(mobile),folder='artifacts/salvage-mobile-v03/';
 assert.equal(p.schema,3);ancestor(p.runtimeSourceSha);assertCurrentRuntime(p.runtimeSourceSha);
 const evidence=verifyEvidence(p.evidenceFiles,'mobile evidence'),build=boundJSON(p.buildInfo,evidence);verifyBuild(p,build);
 git(['ls-files','--error-unmatch','--',p.zip.path]);const raw=fs.readFileSync(local(p.zip.path));assert(evidence.has(p.zip.path));assert.equal(raw.length,p.zip.bytes);assert.equal(hash(raw),p.zip.sha256);
 const expected=expectedPackage(p.runtimeSourceSha),actual=comparePackageFiles(readZipFiles(p.zip.path),expected.files,'mobile actual ZIP/source');comparePackageFiles(p.packageFiles,actual,'mobile package manifest');
 const b=p.fixedPackageBrowser;assert.equal(b.expected,128);assert.equal(b.runtimeSourceSha,p.runtimeSourceSha);assert.equal(b.zipSha256,p.zip.sha256);
 const stats=verifyBrowser(boundJSON(b.report,evidence),128);verifyCapture(p,boundJSON(p.capture.manifest,evidence),evidence,actual,stats,expected.build,folder);
 assert.equal(boundJSON(folder+'developer/mobile-model.json',evidence).passed,21);assert.equal(boundJSON(folder+'developer/engine-results.json',evidence).testsPassed,30);assert.equal(boundJSON(folder+'developer/regression-results.json',evidence).passed,18);
 const economy=boundJSON(folder+'developer/mobile-policy-comparison.json',evidence);assert.equal(economy.baseline,'b26455ada31fe1ab780905cdb1c26f1387c082bb');assert.equal(economy.currentSchema,4);assert.equal(economy.seeds,32);assert.equal(economy.voyagesPerSeed,12);for(const name of ['engine.js','cargo-layout.js','balance.js'])assert.equal(economy.currentSources[name],hash(source(p.runtimeSourceSha,demo+'src/'+name)),'economy source binding: '+name);
 for(const policy of Object.values(economy.policies))for(const version of ['baseline','current'])assert.equal(policy[version].voyages,384);
 const compat=boundJSON(folder+'developer/mobile-compatibility.json',evidence);assert.equal(compat.passed,8);assert.equal(compat.cases.length,8);assert.deepEqual(compat.errors,[]);assert.equal(new Set(compat.cases.map(c=>[c.engine,c.width,c.height,c.syntheticSafeArea].join(':'))).size,8);for(const c of compat.cases){assert.equal(c.build.commit,p.runtimeSourceSha);assert.equal(c.keyboardLayoutSavedAndReloaded,true);assert.equal(c.textPx,18);}
 const http=boundJSON(folder+'package-http.json',evidence);assert.equal(http.sourceCommit,p.runtimeSourceSha);assert.equal(http.zipSha256,p.zip.sha256);assert.equal(http.allHttpBytesMatchZip,true);comparePackageFiles(http.files,actual,'mobile real HTTP payload');
 assert.equal(p.physicalPhone,'NOT_TESTED');verifyPlatform(p.platform,evidence,p.zip);
 const localCheck=boundJSON(folder+'delivery/local-browser-check.json',evidence);assert.equal(localCheck.runtimeSourceSha,p.runtimeSourceSha);assert.equal(localCheck.matchesFrozenMigration,true);assert.equal(localCheck.refreshPreserves,true);assert.equal(localCheck.gameplayActionsTaken,false);
 console.log('PASS mobile frozen runtime, 13 ZIP/HTTP payloads, 128 real browser checks, schema4 tests, two natural voyages, economy comparison and preserved actual user save; phone remains NOT_TESTED');
}
