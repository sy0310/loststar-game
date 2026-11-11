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
function portConfig(sha){return /require\('\.\.\/\.\.\/\.\.\/(design\/star-salvage\/v[^']+\/BALANCE_[^']+\.json)'\)/.exec(source(sha,demo+'src/engine.js').toString())?.[1]??null;}
function runtimeConfigs(sha){
 const config=portConfig(sha),version=/\bVERSION='([^']+)'/.exec(source(sha,demo+'src/engine.js').toString())?.[1];
 return ['design/star-salvage/BALANCE_V01.json',...(config?[config]:[]),...(version?.startsWith('0.5.')?['design/star-salvage/v05/BALANCE_V05.json','design/star-salvage/v05/ship-holds-approved.json']:[])];
}
function runtimeNames(sha){return [...packagedSourceNames(sha),demo+'build.py',...runtimeConfigs(sha)].sort();}
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
 const actual=[...diskFiles(demo+'src'),...diskFiles(demo+'assets'),demo+'index.html',demo+'build.py',...runtimeConfigs(sha)].sort();
 assert.deepEqual(actual,expected,'runtime file set changed; refresh frozen package proof');
 for(const name of expected){
  assert.equal(hash(fs.readFileSync(local(name))),hash(source(sha,name)),
   'runtime changed; refresh frozen package proof: '+name);
 }
}
// build.py uses Python's JSON spacing for the two metadata objects in index.html.
function spacedJSON(value){return JSON.stringify(value).replace(/("(?:\\.|[^"\\])*")|([,:])/g,(all,string,punctuation)=>string||punctuation+' ');}
function expectedPackage(sha){
 let names=packagedSourceNames(sha);const result=new Map();
 const version=/\bVERSION='([^']+)'/.exec(source(sha,demo+'src/engine.js').toString())?.[1];
 assert(version,'frozen engine version missing');
 if(version.startsWith('0.4.')||version.startsWith('0.5.'))names=names.filter(n=>!n.startsWith(demo+'assets/')||/assets\/(v04(?:1|2)?|v05)\/[^/]+@2x\.png$/.test(n));
 const art={ship:version.startsWith('0.4.')||version.startsWith('0.5.')?'./assets/v04/ship_starter@2x.png':'./assets/ship.webp'};
 for(const name of ['ship','port','wreck','harbor'])if(names.includes(demo+'assets/'+name+'.webp'))art[name]='./assets/'+name+'.webp';
 const build={version,commit:sha,dirty:false,blindTest:true};
 for(const name of names){
  let raw=source(sha,name);
  if(name===demo+'src/balance.js'){
   raw=Buffer.from('globalThis.LostCargoBalance='+JSON.stringify(JSON.parse(source(sha,'design/star-salvage/BALANCE_V01.json')))+';\n');
  }else if(name===demo+'src/port-balance.js'){
   raw=Buffer.from('globalThis.LostCargoPortBalance='+JSON.stringify(JSON.parse(source(sha,portConfig(sha))))+';\n');
  }else if(name===demo+'src/v05-balance.js'){
   raw=Buffer.from('globalThis.LostCargoV05Balance='+JSON.stringify(JSON.parse(source(sha,'design/star-salvage/v05/BALANCE_V05.json')))+';\n');
  }else if(name===demo+'src/hold-config.js'){
   raw=Buffer.from('globalThis.LostCargoHoldConfig='+JSON.stringify(JSON.parse(source(sha,'design/star-salvage/v05/ship-holds-approved.json')))+';\n');
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
function readZipFiles(name,count=13){
 // Inspect in memory; never extract untrusted paths or depend on an ignored dist/.
 const result=cp.execFileSync('python3',['-c',
  'import hashlib,json,stat,sys,zipfile\n'+
  'with zipfile.ZipFile(sys.argv[1]) as z:\n'+
  ' entries=z.infolist()\n'+
  ' assert len(entries)==int(sys.argv[2]), "unexpected package file count"\n'+
  ' assert sum(i.file_size for i in entries)<32*1024*1024, "unexpected package expansion"\n'+
  ' result=[]\n'+
  ' for i in entries:\n'+
  '  assert not i.is_dir() and not stat.S_ISLNK(i.external_attr>>16), "nonregular ZIP entry"\n'+
  '  raw=z.read(i)\n'+
  '  result.append({"path":i.filename,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})\n'+
  ' print(json.dumps(result))\n',local(name),String(count)],{encoding:'utf8',maxBuffer:1024*1024});
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
 assert.equal(p.schema,3);ancestor(p.runtimeSourceSha);if(!fs.existsSync(local('artifacts/salvage-port-v04/verification.json')))assertCurrentRuntime(p.runtimeSourceSha);
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

const portProof='artifacts/salvage-port-v04/verification.json';
if(fs.existsSync(local(portProof))){
 const p=json(portProof),folder='artifacts/salvage-port-v04/';assert.equal(p.schema,4);ancestor(p.runtimeSourceSha);if(!fs.existsSync(local('artifacts/salvage-ship-v041/verification.json')))assertCurrentRuntime(p.runtimeSourceSha);
 const evidence=verifyEvidence(p.evidenceFiles,'port04 evidence'),build=boundJSON(p.buildInfo,evidence);verifyBuild(p,build);assert.equal(build.missingOptionalArt.length,0);assert.equal(build.assets.length,14);
 git(['ls-files','--error-unmatch','--',p.zip.path]);const raw=fs.readFileSync(local(p.zip.path));assert(evidence.has(p.zip.path));assert.equal(raw.length,p.zip.bytes);assert.equal(hash(raw),p.zip.sha256);
 const expected=expectedPackage(p.runtimeSourceSha),actual=comparePackageFiles(readZipFiles(p.zip.path,p.zip.files),expected.files,'port04 ZIP/source');comparePackageFiles(p.packageFiles,actual,'port04 complete manifest');assert.equal(actual.size,29);
 const b=p.fixedPackageBrowser;assert.equal(b.runtimeSourceSha,p.runtimeSourceSha);assert.equal(b.zipSha256,p.zip.sha256);verifyBrowser(boundJSON(b.report,evidence),72);
 verifyBrowser(boundJSON(folder+'developer/old03-browser-results.json',evidence),128);
 const art=boundJSON(folder+'developer/port-art.json',evidence);assert.equal(art.passed,14);for(const row of art.assets){assert(row.exactNearest&&row.editableMergedMatches&&row.binaryAlpha&&row.paletteSubset);for(const f of row.files){assert.equal(hash(fs.readFileSync(local(f.path))),f.sha256);assert.equal(hash(source(p.runtimeSourceSha,f.path)),f.sha256);}}
 for(const [file,count]of [['port-model.json',18],['regression-results.json',18],['mobile-model.json',21]])assert.equal(boundJSON(folder+'developer/'+file,evidence).passed,count);
 const econ=boundJSON(folder+'developer/port-economy.json',evidence);assert.equal(econ.seeds,12);assert.equal(econ.voyagesPerSeed,12);assert.deepEqual(econ.config,JSON.parse(source(p.runtimeSourceSha,'design/star-salvage/v04/BALANCE_V04.json')));assert.equal(econ.oldWallet.remaining,11949);for(const v of Object.values(econ.policies)){assert.equal(v.runs.length,12);for(const r of v.runs)assert.equal(r.rows.length,12);}
 const compat=boundJSON(folder+'developer/port-compatibility.json',evidence);assert.equal(compat.passed,8);assert.deepEqual(compat.errors,[]);for(const c of compat.cases){assert.equal(c.build.commit,p.runtimeSourceSha);assert(c.keyboardAndReload);}
 const http=boundJSON(p.httpReport,evidence);assert.equal(http.sourceCommit,p.runtimeSourceSha);assert.equal(http.zipSha256,p.zip.sha256);assert(http.allHttpBytesMatchZip);comparePackageFiles(http.files,actual,'port04 HTTP payload');
 const cap=boundJSON(p.capture.manifest,evidence);assert.equal(cap.runtimeSourceSha,p.runtimeSourceSha);assert.equal(cap.zipSha256,p.zip.sha256);const media=verifyEvidence(cap.files,'port04 capture');for(const [n,r]of media)assert.deepEqual(evidence.get(n),r);const report=boundJSON(cap.report,media);assert(report.completed);assert.equal(report.build.commit,p.runtimeSourceSha);assert.deepEqual(report.errors,[]);for(const k of ['imported','clockOverridden','seedOverridden'])assert.equal(report.natural[k],false);assert.equal(report.qa.imported,true);assert.equal(report.natural.checkpoints.length,13);assert.equal(report.qa.checkpoints.length,4);const E=require('./legacy-engine.cjs')(p.runtimeSourceSha);for(const group of ['natural','qa'])for(const c of report[group].checkpoints)E.assertState(c.state);
 const points=new Map(report.natural.checkpoints.map(c=>[c.name,c.state]));for(const r of[1,2]){assert.equal(points.get('before-voyage-'+r).phase,'port');assert.equal(points.get('returned-voyage-'+r).phase,'summary');assert.equal(points.get('saved-after-voyage-'+r).phase,'port');}assert.deepEqual(points.get('saved-after-voyage-1'),points.get('reopened-before-second-voyage'));assert.equal(points.get('before-voyage-1').activeMissionId,null);assert.equal(points.get('before-voyage-2').missions[0].status,'accepted');
 for(const name of ['natural-voyage-1','natural-voyage-2','qa-buy-equip-expand-supply']){const file=folder+'developer/capture/'+name+'.webm';assert(media.has(file));assert.equal(fs.readFileSync(local(file)).subarray(0,4).toString('hex'),'1a45dfa3');}
 const localCheck=boundJSON(folder+'delivery/local-browser-check.json',evidence);assert.equal(localCheck.runtimeSourceSha,p.runtimeSourceSha);assert(localCheck.matchesFrozenMigration&&localCheck.refreshPreserves);assert.equal(localCheck.gameplayActionsTaken,false);assert.equal(p.physicalPhone,'NOT_TESTED');verifyPlatform(p.platform,evidence,p.zip);
 console.log('PASS port04:29 frozen ZIP/HTTP payloads,14 native/editable/2x/4x assets,72 current+128 historical browser checks,13 natural/4 QA checkpoints,864 economy voyages,actual Mac migration and unbound TapTap. Phone/art/enjoyment remain pending.');
}

const shipProof='artifacts/salvage-ship-v041/verification.json';
if(fs.existsSync(local(shipProof))){
 const p=json(shipProof),folder='artifacts/salvage-ship-v041/';
 assert.equal(p.schema,5);ancestor(p.runtimeSourceSha);if(!fs.existsSync(local('artifacts/salvage-polish-v042/verification.json')))assertCurrentRuntime(p.runtimeSourceSha);
 const evidence=verifyEvidence(p.evidenceFiles,'ship041 evidence');
 const build=boundJSON(p.buildInfo,evidence);verifyBuild(p,build);
 assert.equal(build.assets.length,29);assert.deepEqual(build.missingOptionalArt,[]);
 git(['ls-files','--error-unmatch','--',p.zip.path]);
 const raw=fs.readFileSync(local(p.zip.path));assert(evidence.has(p.zip.path));
 assert.equal(raw.length,p.zip.bytes);assert.equal(hash(raw),p.zip.sha256);assert.equal(p.zip.files,45);
 const expected=expectedPackage(p.runtimeSourceSha);
 const actual=comparePackageFiles(readZipFiles(p.zip.path,45),expected.files,'ship041 ZIP/source');
 comparePackageFiles(p.packageFiles,actual,'ship041 full manifest');
 const b=p.fixedPackageBrowser;assert.equal(b.runtimeSourceSha,p.runtimeSourceSha);assert.equal(b.zipSha256,p.zip.sha256);
 assert.equal(b.expected,108);for(const k of ['unexpected','skipped','flaky','retries'])assert.equal(b[k],0);
 verifyBrowser(boundJSON(b.report,evidence),108);
 verifyBrowser(boundJSON(folder+'developer/old04-browser-results.json',evidence),72);
 for(const [file,count]of [['port-model.json',18],['regression-results.json',18],['mobile-model.json',21],['ship-capacities.json',17]])assert.equal(boundJSON(folder+'developer/'+file,evidence).passed,count);
 assert.equal(boundJSON(folder+'developer/engine-results.json',evidence).testsPassed,30);
 for(const [name,count]of [['port-art.json',14],['art-v041.json',15]]){
  const art=boundJSON(folder+'developer/'+name,evidence);assert.equal(art.passed,count);
  if(name==='art-v041.json')assert.equal(art.physicalRotations,52);
  for(const row of art.assets){
   assert(row.exactNearest&&row.editableMergedMatches&&row.binaryAlpha&&row.paletteSubset);
   for(const f of row.files){assert.equal(hash(fs.readFileSync(local(f.path))),f.sha256);assert.equal(hash(source(p.runtimeSourceSha,f.path)),f.sha256);}
  }
 }
 const econ=boundJSON(folder+'developer/port-economy.json',evidence);
 assert.deepEqual(econ.config,JSON.parse(source(p.runtimeSourceSha,portConfig(p.runtimeSourceSha))));
 assert.equal(econ.seeds,12);assert.equal(econ.voyagesPerSeed,12);assert.equal(Object.keys(econ.policies).length,7);
 for(const v of Object.values(econ.policies)){assert.equal(v.runs.length,12);for(const r of v.runs)assert.equal(r.rows.length,12);}
 assert.equal(econ.paidFleetOldWallet.opening,27049);assert.equal(econ.paidFleetOldWallet.newEngineeringSpent,13350);
 assert.equal(econ.paidFleetOldWallet.remaining,13699);assert.equal(econ.paidFleetOldWallet.debt,12000);
 assert.equal(econ.policies.manualSurvey.meanNetCash,econ.policies.baseline03.meanNetCash);
 const compat=boundJSON(folder+'developer/port-compatibility.json',evidence);
 assert.equal(compat.passed,8);assert.equal(compat.cases.length,8);assert.deepEqual(compat.errors,[]);
 for(const c of compat.cases){assert.equal(c.build.commit,p.runtimeSourceSha);assert(c.keyboardAndReload);}
 const http=boundJSON(p.httpReport,evidence);
 assert.equal(http.sourceCommit,p.runtimeSourceSha);assert.equal(http.zipSha256,p.zip.sha256);assert(http.allHttpBytesMatchZip);
 comparePackageFiles(http.files,actual,'ship041 HTTP payload');
 const cap=boundJSON(p.capture.manifest,evidence),media=verifyEvidence(cap.files,'ship041 capture');
 assert.equal(cap.runtimeSourceSha,p.runtimeSourceSha);assert.equal(cap.zipSha256,p.zip.sha256);
 for(const [n,r]of media)assert.deepEqual(evidence.get(n),r);
 const report=boundJSON(cap.report,media);assert(report.completed);assert.deepEqual(report.errors,[]);assert.deepEqual(report.build,expected.build);
 for(const k of ['imported','clockOverridden','seedOverridden'])assert.equal(report.natural[k],false);
 const E=require('./legacy-engine.cjs')(p.runtimeSourceSha);
 for(const [group,count]of [['natural',13],['qa',4],['refinement',5]]){
  assert.equal(report[group].checkpoints.length,count);for(const c of report[group].checkpoints)E.assertState(c.state);
 }
 const natural=new Map(report.natural.checkpoints.map(x=>[x.name,x.state]));
 for(const r of[1,2]){assert.equal(natural.get('before-voyage-'+r).phase,'port');assert.equal(natural.get('returned-voyage-'+r).phase,'summary');assert.equal(natural.get('saved-after-voyage-'+r).phase,'port');}
 assert.deepEqual(natural.get('saved-after-voyage-1'),natural.get('reopened-before-second-voyage'));
 assert.equal(report.qa.imported,true);assert.equal(report.refinement.imported,true);
 const refine=new Map(report.refinement.checkpoints.map(x=>[x.name,x.state]));
 const before=refine.get('before-upgrades'),paid=refine.get('paid-upgraded-caps');
 assert.equal(before.money-paid.money,650);assert.equal(paid.fuel,before.fuel);
 assert.equal(paid.hull,before.hull+25);assert.equal(paid.fleet.fuelLevels.starter,1);assert.equal(paid.fleet.hullLevels.starter,1);
 assert.equal(refine.get('physical-cargo-saved').cargoGrid.placements.find(x=>x.uid===1).rotation,1);
 assert.deepEqual(refine.get('returned-to-original-ship'),refine.get('reload-preserved'));
 for(const name of ['natural-voyage-1','natural-voyage-2','qa-buy-equip-expand-supply','qa-ship-upgrades-and-physical-cargo']){
  const file=folder+'developer/capture/'+name+'.webm';assert(media.has(file));assert.equal(fs.readFileSync(local(file)).subarray(0,4).toString('hex'),'1a45dfa3');
 }
 const localCheck=boundJSON(folder+'delivery/local-browser-check.json',evidence);
 assert.equal(localCheck.runtimeSourceSha,p.runtimeSourceSha);assert(localCheck.matchesFrozenMigration&&localCheck.refreshPreserves);
 assert.equal(localCheck.gameplayActionsTaken,false);assert.equal(p.physicalPhone,'NOT_TESTED');verifyPlatform(p.platform,evidence,p.zip);
 console.log('PASS ship041:45 frozen ZIP/HTTP payloads,29 source assets,108 current+72 historical browser checks,17 capacity checks,1008 economy voyages,two natural voyages,paid upgrades/rotation/stocks and actual Mac migration. Phone/art/enjoyment pending.');
}

const polishProof='artifacts/salvage-polish-v042/verification.json';
if(fs.existsSync(local(polishProof))){
 const p=json(polishProof),folder='artifacts/salvage-polish-v042/';assert.equal(p.schema,6);ancestor(p.runtimeSourceSha);if(!fs.existsSync(local('artifacts/salvage-v05/verification.json')))assertCurrentRuntime(p.runtimeSourceSha);
 const evidence=verifyEvidence(p.evidenceFiles,'polish042 evidence'),build=boundJSON(p.buildInfo,evidence);verifyBuild(p,build);
 assert.equal(build.assets.length,40);assert.deepEqual(build.missingOptionalArt,[]);assert.equal(p.zip.files,57);
 git(['ls-files','--error-unmatch','--',p.zip.path]);const raw=fs.readFileSync(local(p.zip.path));assert(evidence.has(p.zip.path));assert.equal(raw.length,p.zip.bytes);assert.equal(hash(raw),p.zip.sha256);
 const expected=expectedPackage(p.runtimeSourceSha),actual=comparePackageFiles(readZipFiles(p.zip.path,57),expected.files,'polish042 ZIP/source');comparePackageFiles(p.packageFiles,actual,'polish042 manifest');
 const b=p.fixedPackageBrowser;assert.equal(b.runtimeSourceSha,p.runtimeSourceSha);assert.equal(b.zipSha256,p.zip.sha256);assert.equal(b.expected,128);for(const k of ['unexpected','skipped','flaky','retries'])assert.equal(b[k],0);verifyBrowser(boundJSON(b.report,evidence),128);
 verifyBrowser(boundJSON(folder+'developer/old041-browser-results.json',evidence),108);
 for(const [file,count]of [['port-model.json',18],['regression-results.json',18],['mobile-model.json',21],['ship-capacities.json',17],['cargo-identity.json',5]])assert.equal(boundJSON(folder+'developer/'+file,evidence).passed,count);
 const identity=boundJSON(folder+'developer/cargo-identity.json',evidence);assert.equal(identity.naturalMultiPairs,14);assert.equal(identity.newImages,11);assert(identity.schema6Unchanged&&identity.economicConfigUnchanged);
 for(const [name,count]of [['port-art.json',14],['art-v041.json',15],['art-v042.json',11]]){const art=boundJSON(folder+'developer/'+name,evidence);assert.equal(art.passed,count);if(name==='art-v042.json')assert.equal(art.physicalRotations,44);for(const row of art.assets){assert(row.exactNearest&&row.editableMergedMatches&&row.binaryAlpha&&row.paletteSubset);for(const f of row.files){assert.equal(hash(fs.readFileSync(local(f.path))),f.sha256);assert.equal(hash(source(p.runtimeSourceSha,f.path)),f.sha256);}}}
 const econ=boundJSON(folder+'developer/port-economy.json',evidence);assert.deepEqual(econ.config,JSON.parse(source(p.runtimeSourceSha,portConfig(p.runtimeSourceSha))));assert.equal(econ.seeds,12);assert.equal(econ.voyagesPerSeed,12);assert.equal(econ.paidFleetOldWallet.remaining,13699);
 const compat=boundJSON(folder+'developer/port-compatibility.json',evidence);assert.equal(compat.passed,8);assert.deepEqual(compat.errors,[]);for(const c of compat.cases){assert.equal(c.build.commit,p.runtimeSourceSha);assert(c.keyboardAndReload);}
 const http=boundJSON(p.httpReport,evidence);assert.equal(http.sourceCommit,p.runtimeSourceSha);assert.equal(http.zipSha256,p.zip.sha256);assert(http.allHttpBytesMatchZip);comparePackageFiles(http.files,actual,'polish042 HTTP');
 const cap=boundJSON(p.capture.manifest,evidence),media=verifyEvidence(cap.files,'polish042 capture');assert.equal(cap.runtimeSourceSha,p.runtimeSourceSha);assert.equal(cap.zipSha256,p.zip.sha256);for(const [n,r]of media)assert.deepEqual(evidence.get(n),r);
 const report=boundJSON(cap.report,media);assert(report.completed);assert.deepEqual(report.errors,[]);assert.deepEqual(report.build,expected.build);for(const k of ['imported','clockOverridden','seedOverridden'])assert.equal(report.natural[k],false);
 const E=require('./legacy-engine.cjs')(p.runtimeSourceSha);for(const [group,n]of [['natural',13],['qa',4],['refinement',5],['polish',4]]){assert.equal(report[group].checkpoints.length,n);for(const x of report[group].checkpoints)E.assertState(x.state);}
 assert(report.polish.imported);assert.equal(report.polish.images.length,5);assert.equal(new Set(report.polish.images.map(x=>x.src)).size,5);for(const x of report.polish.images){assert(x.decoded);assert.equal(x.shape,'line2');}
 const points=new Map(report.polish.checkpoints.map(x=>[x.name,x.state]));assert.deepEqual(points.get('454-wallet-before'),points.get('viewing-and-cancel-no-charge'));assert.equal(points.get('454-wallet-before').money,454);assert.deepEqual(points.get('identity-rotation-saved'),points.get('refresh-identities-and-rights'));assert.equal(points.get('identity-rotation-saved').cargoGrid.placements.find(x=>x.uid===5).rotation,1);
 const natural=new Map(report.natural.checkpoints.map(x=>[x.name,x.state]));for(const n of[1,2]){assert.equal(natural.get('before-voyage-'+n).phase,'port');assert.equal(natural.get('returned-voyage-'+n).phase,'summary');assert.equal(natural.get('saved-after-voyage-'+n).phase,'port');}assert.deepEqual(natural.get('saved-after-voyage-1'),natural.get('reopened-before-second-voyage'));
 for(const name of ['natural-voyage-1','natural-voyage-2','qa-buy-equip-expand-supply','qa-ship-upgrades-and-physical-cargo','qa-review-polish']){const f=folder+'developer/capture/'+name+'.webm';assert(media.has(f));assert.equal(fs.readFileSync(local(f)).subarray(0,4).toString('hex'),'1a45dfa3');}
 const localCheck=boundJSON(folder+'delivery/local-browser-check.json',evidence);assert.equal(localCheck.runtimeSourceSha,p.runtimeSourceSha);assert(localCheck.matchesFrozenMigration&&localCheck.refreshPreserves);assert.equal(localCheck.gameplayActionsTaken,false);assert.equal(p.physicalPhone,'NOT_TESTED');verifyPlatform(p.platform,evidence,p.zip);
 console.log('PASS polish042:57 exact ZIP/HTTP payloads,40 source assets,128 current+108 historical browser checks,14 actual multigrid identities,44 new rotations,unchanged prices/schema6,actual original Mac save. Phone/art pending.');
}

const v05Proof = 'artifacts/salvage-v05/verification.json';
if (fs.existsSync(local(v05Proof))) {
 const p = json(v05Proof), folder = 'artifacts/salvage-v05/';
 assert.equal(p.schema, 7);
 ancestor(p.runtimeSourceSha);
 assertCurrentRuntime(p.runtimeSourceSha);
 const evidence = verifyEvidence(p.evidenceFiles, 'v05 evidence');
 const build = boundJSON(p.buildInfo, evidence);
 verifyBuild(p, build);
 assert.equal(build.assets.length, 44);
 assert.deepEqual(build.missingOptionalArt, []);
 assert.equal(p.zip.files, 67);
 git(['ls-files', '--error-unmatch', '--', p.zip.path]);
 const zip = fs.readFileSync(local(p.zip.path));
 assert(evidence.has(p.zip.path));
 assert.equal(zip.length, p.zip.bytes);
 assert.equal(hash(zip), p.zip.sha256);
 const expected = expectedPackage(p.runtimeSourceSha);
 const actual = comparePackageFiles(readZipFiles(p.zip.path, 67), expected.files, 'v05 ZIP/source');
 comparePackageFiles(p.packageFiles, actual, 'v05 manifest');
 const browser = p.fixedPackageBrowser;
 assert.equal(browser.expected, 176);
 assert.equal(browser.runtimeSourceSha, p.runtimeSourceSha);
 assert.equal(browser.zipSha256, p.zip.sha256);
 verifyBrowser(boundJSON(browser.report, evidence), 176);
 for (const [name, count] of [['engine-results.json',30], ['regression-results.json',18],
   ['mobile-model.json',21], ['port-model.json',18], ['ship-capacities.json',17],
   ['cargo-identity.json',5], ['v05-model-results.json',37]]) {
  const result = boundJSON(folder+'developer/'+name, evidence);
  assert.equal(result.passed ?? result.testsPassed, count, name);
 }
 for (const [name, count] of [['port-art.json',14], ['art-v041.json',15], ['art-v042.json',11], ['art-v05.json',4]]) {
  const art = boundJSON(folder+'developer/'+name, evidence);
  assert.equal(art.passed, count);
  if (name === 'art-v05.json') assert.equal(art.physicalRotations, 16);
  for (const row of art.assets) {
   assert(row.exactNearest && row.editableMergedMatches && row.binaryAlpha && row.paletteSubset);
   for (const file of row.files) {
    assert.equal(hash(fs.readFileSync(local(file.path))), file.sha256);
    assert.equal(hash(source(p.runtimeSourceSha, file.path)), file.sha256);
   }
  }
 }
 const geometry = boundJSON(folder+'developer/v05-isolated-geometry.json', evidence);
 assert(geometry.isolatedOnly);
 assert.equal(geometry.casesPerLevel, 120);
 assert.equal(geometry.levels.length, 11);
 const E = require('./legacy-engine.cjs')(p.runtimeSourceSha);
 const O = require('./legacy-engine.cjs')('94e606fc773d1dc37341d29923e39e7ec7c3863b');
 const config = JSON.parse(source(p.runtimeSourceSha, 'design/star-salvage/v05/ship-holds-approved.json'));
 for (const row of geometry.levels) {
  assert.deepEqual(row.rows, config.ships[row.shipId].levels[row.level]);
  assert.equal(row.capacity, row.rows.join('').replaceAll('.', '').length);
  assert(row.bc.packed >= row.baseline.packed, 'frozen normal-set packing regressed');
 }
 const economy = boundJSON(folder+'developer/v05-economy.json', evidence);
 assert.equal(economy.seedCount, 24);
 assert.equal(economy.voyagesPerSeed, 16);
 assert.equal(Object.keys(economy.comparisons).length, 6);
 assert.equal(economy.naturalNewEventCoverage.length, 12);
 for (const file of economy.inputFiles) {
  assert.equal(hash(source(p.runtimeSourceSha,file.path)), file.sha256, 'economy frozen input '+file.path);
 }
 assert.equal(economy.inputFiles.length, 11);
 for (const policy of Object.values(economy.comparisons)) {
  for (const result of Object.values(policy)) {
   assert.equal(result.voyages, 384);
   assert.equal(result.rescues, 0);
  }
  assert.equal(policy.v05ordinary.firstStationIdentities, 6);
 }
 assert.equal(economy.oldWallet.opening, 27049);
 assert.equal(economy.oldWallet.afterMigration, 27049);
 assert(economy.oldWallet.oldLedgerPreserved && economy.oldWallet.purchasePricesPreserved);
 for (const result of Object.values(economy.marketLots)) assert.equal(result.seeds, 512);
 const compat = boundJSON(folder+'developer/port-compatibility.json', evidence);
 assert.equal(compat.passed,8);
 assert.deepEqual(compat.errors,[]);
 for (const row of compat.cases) {
  assert.deepEqual(row.build,expected.build);
  assert(row.keyboardAndReload);
 }
 const http = boundJSON(p.httpReport,evidence);
 assert.equal(http.sourceCommit,p.runtimeSourceSha);
 assert.equal(http.zipSha256,p.zip.sha256);
 assert(http.allHttpBytesMatchZip);
 comparePackageFiles(http.files,actual,'v05 real HTTP payloads');
 const cap = boundJSON(p.capture.manifest,evidence);
 assert.equal(cap.runtimeSourceSha,p.runtimeSourceSha);
 assert.equal(cap.zipSha256,p.zip.sha256);
 const media = verifyEvidence(cap.files,'v05 media');
 for(const [name,row] of media) assert.deepEqual(evidence.get(name),row);
 const report = boundJSON(cap.report,media);
 assert(report.completed);
 assert.equal(report.reviewOnly,false);
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.build,expected.build);
 assert.equal(report.physicalPhoneTested,false);
 for(const name of ['imported','seedOverridden','clockOverridden']) assert.equal(report.natural[name],false);
 const points = new Map(report.natural.checkpoints.map(point => {
  E.assertState(point.state);
  return [point.name,point.state];
 }));
 for(const voyage of [1,2]) {
  assert.equal(points.get('before-voyage-'+voyage).phase,'port');
  assert.equal(points.get('returned-voyage-'+voyage).phase,'summary');
  assert.equal(points.get('saved-voyage-'+voyage).phase,'port');
  assert.equal(points.get('returned-voyage-'+voyage).runNo,voyage);
 }
 assert.deepEqual(points.get('saved-voyage-1'),points.get('reopened-before-second-voyage'));
 assert.equal(report.holds.length,44);
 const identities = new Set();
 for(const row of report.holds) {
  const model = row.label === 'bc' ? E : O;
  model.assertState(row.state);
  assert.equal(model.capacityCells(row.state),row.capacity);
  const id=[row.label,row.width,row.shipId,row.level].join(':');
  assert(!identities.has(id)); identities.add(id);
  assert.equal(row.images.length,4);
  assert(row.images.every(image => image.decoded));
  if(row.label==='bc') {
   const old=report.holds.find(x=>x.label==='before042'&&x.width===row.width&&x.shipId===row.shipId&&x.level===row.level);
   assert(old);
   assert.deepEqual(row.state.cargo,old.state.cargo);
   assert.equal(row.state.money,old.state.money);
  }
 }
 for(const point of report.market.checkpoints) E.assertState(point.state);
 assert(report.market.imported);
 assert.deepEqual(report.market.checkpoints[2].state,report.market.checkpoints[3].state);
 for(const name of ['natural-voyage-1','natural-voyage-2','qa-four-ship-holds-and-real-upgrades','qa-black-market-offers-and-refresh']) {
  const file=folder+'developer/capture/'+name+'.webm';
  assert(media.has(file));
  assert.equal(fs.readFileSync(local(file)).subarray(0,4).toString('hex'),'1a45dfa3');
 }
 const localCheck = boundJSON(folder+'delivery/local-browser-check.json',evidence);
 assert.equal(localCheck.runtimeSourceSha,p.runtimeSourceSha);
 assert(localCheck.matchesFrozenMigration && localCheck.refreshPreserves);
 assert.equal(localCheck.gameplayActionsTaken,false);
 assert.equal(p.platform.previousPackageId,458870);
 verifyPlatform(p.platform,evidence,p.zip);
 assert.equal(p.physicalPhone,'NOT_TESTED');
 console.log('PASS v05 frozen67/HTTP,176 browser,8 compatibility,44 native assets,11 B+C levels/1320 sets,37 new model groups,real economic replay,two natural voyages,original Mac migration and new unbound TapTap self-test. Phone/art/enjoyment pending.');
}
