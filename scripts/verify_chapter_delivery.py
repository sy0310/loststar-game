"""Verify actual fixed chapter media, money identities, persistence and unchanged approved art."""
from pathlib import Path
import json,hashlib,zipfile,subprocess
root=Path('artifacts/chapter-one-followup');m=json.loads(Path('releases/chapter-package.json').read_text());n=json.loads((root/'natural-evidence.json').read_text());q=json.loads((root/'qa-evidence.json').read_text());checks=[]
def check(name,valid,detail=None):
 if not valid:raise AssertionError((name,detail))
 checks.append(dict(name=name,passed=True,detail=detail))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
check('actual-ZIP',sha(Path(m['archive']))==m['sha256'])
with zipfile.ZipFile(m['archive']) as z:
 check('single-folder-190-files',len(z.namelist())==m['files'] and all(x.startswith('loststar-parcel-story/') for x in z.namelist()))
 check('every-extracted-byte',all(Path('releases/chapter-static',x).read_bytes()==z.read(x) for x in z.namelist()))
for kind,e in [('natural',n),('qa',q)]:
 check(kind+'/source',e['sourceCommit']==m['sourceCommit'] and e['package']==m)
 check(kind+'/no-clock-or-speedup',not e['clockOverrides'] and e['speed']==1)

 if kind=='natural' and e['errors']:
  diagnostic=json.loads((root/'checks/recorder-navigation-diagnostic.json').read_text())
  check('recorder-error-reproduced-outside-game',len(e['errors'])==1 and diagnostic['errors'][0]['message']==e['errors'][0] and diagnostic['document']['url']=='about:blank' and not diagnostic['document']['gamePresent'],e['errors'])
 else:check(kind+'/errors',not e['errors'])
 for s in e['screens']:check('screen/'+s['file'],sha(root/s['file'])==s['sha256'])
 videos=[e['video']] if kind=='natural' else e['videos']
 for v in videos:check('video/'+v['file'],sha(root/v['file'])==v['sha256'])
start=n['initial']['state'];end=n['final']['state']
check('ordinary-new-120-empty',start['game']['resources']==120 and not start['game']['collection'] and not n['qa'])
check('ordinary-no-paid-treatment',not end['receipt']['transactions'] and all(c['condition']=='found' for c in end['curios'].values()) and not any(end['game']['upgrades'].values()) and not end['projects'])
check('original12-not13',len(end['game']['collection'])==12 and len(set(end['game']['collection']))==12 and 'last-recipient'in end['game']['collection'])
check('real-reveal-and-ending',end['chapter']['revealWorldMs'] is not None and end['chapter']['endingWorldMs'] is not None and end['chapter']['endingWorldMs']>=end['chapter']['revealWorldMs'])
check('two-unique-chapter-events',len([l for l in end['chapter']['logs'] if l['event']=='chapter-occurred'])==2)
check('unpaid-money-identity',end['game']['resources']==120+end['game']['station']['grossIncome']-end['game']['station']['repairSpent'],{k:end['game'][k] for k in ['resources']})
check('real-away-at-least32s',n['awayWallMs']>=32000,n['awayWallMs'])
check('pending-then-claim-refresh',n['beforeClaim']['game']['pendingReturn'] is not None and end['game']['pendingReturn'] is None)
check('natural-only-sandbox-opened',all(x=='loststar.review.parcel-story.v1' for x in n['final']['audit']['opens']))
check('original-signature-not-invented',end['receipt']['verifiedEvidenceIds']==start['receipt']['verifiedEvidenceIds'])
prices={'receipt':160,'tape':130,'nested':190,'stamp':225,'cosmic-parcel':280,'bell':155}
for item,price in prices.items():
 v=next(v for v in q['videos'] if v['name']=='curio-'+item);a=v['initial']['state'];b=v['final']['state'];x=a['game'];y=b['game']
 paid=x['resources']+(y['station']['grossIncome']-x['station']['grossIncome'])-(y['station']['repairSpent']-x['station']['repairSpent'])-y['resources']
 check('original-fee-total/'+item,paid==price,dict(actual=paid,expected=price))
 check('actual-C/'+item,(b['receipt'] if item=='receipt' else b['curios'][item])['condition']=='stabilized')
 check('one-representative-trial/'+item,len(v['final']['treatment']['trials'])==1)
 check('no-signature-from-fiction/'+item,a['receipt']['verifiedEvidenceIds']==b['receipt']['verifiedEvidenceIds'])
 for stage in ['found','clean','stabilized']:
  s=next(s for s in q['screens'] if s['name']==item+'-'+stage)
  check('actual-image-map/'+item+'/'+stage,s['audit']['treatment']['rendered']==item+'/'+stage)
for s in q['screens']:check('layout/'+s['name'],not s['audit']['overflow'] and s['audit']['build']['commit']==m['sourceCommit'] and not s['audit']['build']['dirty'])
isolation=json.loads((root/'checks/save-isolation.json').read_text());check('old-archives-two-engines',isolation['sourceCommit']==m['sourceCommit'] and len(isolation['rows'])==2 and all(r['allOriginalKeysUnchanged'] and r['newRevelation'] is None and r['seededBalance']==27049 and len(r['projects'])==3 for r in isolation['rows']))
long=json.loads((root/'checks/long-offline.json').read_text());check('long-offline-new-and27049',long['sourceCommit']==m['sourceCommit'] and len(long['rows'])==8 and all(r['threeIdenticalReloads'] and r['repeatClaimRejected'] and r['rightsAndEvidenceRetained'] for r in long['rows']))
for path in ['assets/runtime','assets/source']:
 changed=subprocess.check_output(['git','diff','--name-only','bb4b221',m['sourceCommit'],'--',path],text=True);check('approved-art-unchanged/'+path,not changed)
for name,count in [('chapter-browser',52),('reference-browser',80)]:
 stats=json.loads((root/('checks/'+name+'.json')).read_text())['stats'];check(name,stats['expected']==count and stats['unexpected']==stats['skipped']==stats['flaky']==0,stats)
segments=json.loads((root/'natural-segments.json').read_text());check('ordinary-excerpts-bound-source',segments['sourceCommit']==m['sourceCommit'] and len(segments['segments'])==5)
for v in segments['segments']:check('ordinary-excerpt/'+v['file'],sha(root/v['file'])==v['sha256'] and v['sourceSha256']==n['video']['sha256'] and not v['qa'] and v['speed']==1 and v['continuousSource'])
perf=json.loads((root/'performance.json').read_text());check('desktop-performance-actual8-builds',perf['sourceCommit']==m['sourceCommit'] and not perf['physicalPhone'] and len(perf['rows'])==8 and all(r['build']['commit']==m['sourceCommit'] and not r['build']['dirty'] and r['cadence']['wallMs']>=6000 for r in perf['rows']))
tap=json.loads((root/'taptap-receipt.json').read_text());check('actual-taptap-developer-only',tap['sourceCommit']==m['sourceCommit'] and tap['localZipSha256']==m['sha256'] and tap['mainModuleUnchanged'] and not tap['boundMainPackage'] and not tap['submittedForReview'] and not tap['formallyPublished'] and tap['serverReadback']['file_size']==m['bytes'] and not tap['serverReadback']['is_releasing'])
g=next(v for v in q['videos'] if v['name']=='resident-greetings');ga=g['initial']['state']['game'];gb=g['final']['state']['game'];check('greetings-no-price-or-reward-in-real-film',gb['resources']==ga['resources']+gb['station']['grossIncome']-ga['station']['grossIncome']-gb['station']['repairSpent']+ga['station']['repairSpent'] and gb['collection']==ga['collection'])
changed=subprocess.check_output(['git','diff','--name-only','8dfdd06',m['sourceCommit'],'--','src/chapter/model.ts','src/chapter/content.ts','src/fusion/store.ts','src/fusion/domain.ts'],text=True);check('phone-followup-model-content-store-unchanged',not changed)
(root/'verification.json').write_text(json.dumps(dict(sourceCommit=m['sourceCommit'],zipSha256=m['sha256'],checks=checks,physicalPhone='NOT_TESTED',userVisual='PENDING',scope='Playable persistent chapter sandbox, not formal integration or final art acceptance'),ensure_ascii=False,indent=2)+'\n');print('Chapter fixed checks:',len(checks))
