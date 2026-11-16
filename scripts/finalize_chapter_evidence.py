"""Attach proven chapter sandbox evidence to the one existing canonical requirements inventory."""
from pathlib import Path
import json
root=Path('artifacts/chapter-one-followup');m=json.loads((root/'package.json').read_text());v=json.loads((root/'verification.json').read_text());tap=json.loads((root/'taptap-receipt.json').read_text())
assert v['sourceCommit']==tap['sourceCommit']==m['sourceCommit'] and all(x['passed'] for x in v['checks'])
p=Path('design/visual-renewal/ASSET_REGISTRY.json');r=json.loads(p.read_text());a=r['acceptance'];original=[x['id'] for x in a['requirements'] if not x['id'].startswith('CH01-')];assert len(original)==181
common=['artifacts/chapter-one-followup/verification.json','artifacts/chapter-one-followup/independent-review.md','artifacts/chapter-one-followup/checks/chapter-browser.json']
extra={
'IMAGEWORDS':['screens/qa-receipt-clean.png','screens/qa-stamp-found.png','screens/qa-cosmic-parcel-clean.png'],
'HELLO':['videos/qa-resident-greetings.mp4','screens/qa-mouse-heart.png','screens/qa-hermit-heart.png','screens/qa-tagbird-heart.png'],
'BASELINE':['screens/qa-chromium-360-home.png','screens/qa-webkit-390-home.png'],
'SIX':['content-mapping.json','qa-evidence.json'],
'LINKS':['screens/natural-receipt-association.png','screens/natural-stamp-association.png','screens/natural-cosmic-parcel-association.png','natural-segments.json'],
'NIGHT':['screens/natural-night-slip.png','videos/natural-night-reveal.mp4','videos/qa-legal-night.mp4',f"walls/{m['sourceCommit'][:7]}-night-contact.png"],
'COMBO':['screens/qa-optional-combo.png','videos/qa-curio-tape.mp4'],
'ENDING':['screens/natural-ending-letter.png','screens/natural-ending-room.png','videos/natural-ending-and-real-return.mp4'],
'RETURN':['screens/natural-real-return.png','screens/natural-return-claimed.png','videos/qa-resident-return.mp4','videos/qa-chapter-return.mp4','videos/qa-multi-return.mp4'],
'SAVE':['natural-evidence.json','checks/save-isolation.json'],
'LEGACY':['checks/save-isolation.json','checks/long-offline.json'],
'LOGS':['natural-evidence.json','qa-evidence.json'],
'VERIFY':['checks/chapter-browser-ci.json','checks/reference-browser.json','checks/unit-442.log','checks/long-offline.json','performance.json'],
'DELIVER':['index.html','package.json','taptap-receipt.json','natural-segments.json','performance.json']}
code={
'IMAGEWORDS':['src/chapter/visual-clues.ts','src/chapter/ui.ts','src/chapter/style.css'],
'HELLO':['src/fusion/habitat.ts','src/chapter/chapter.spec.ts'],
'BASELINE':['src/fusion/habitat.ts','prototypes/ref-ui/ui.ts','prototypes/ref-ui/light-treatment.ts','src/chapter/entry.ts'],
'SIX':['src/chapter/content.ts','src/chapter/ui.ts','src/chapter/visual-clues.ts','prototypes/ref-ui/light-treatment.ts'],
'LINKS':['src/chapter/model.ts','src/chapter/ui.ts'],
'NIGHT':['src/chapter/model.ts','src/chapter/scene.ts','src/chapter/entry.ts'],
'COMBO':['src/chapter/ui.ts','src/chapter/style.css'],
'ENDING':['src/chapter/ui.ts','src/chapter/model.ts','src/chapter/style.css'],
'RETURN':['src/chapter/model.ts','src/chapter/ui.ts'],
'SAVE':['src/chapter/entry.ts','src/chapter/model.ts','src/fusion/store.ts'],
'LEGACY':['src/chapter/model.ts','src/chapter/entry.ts','scripts/verify_chapter_saves.mjs'],
'LOGS':['src/chapter/model.ts','src/chapter/ui.ts'],
'VERIFY':['tests/chapter-model.test.ts','src/chapter/chapter.spec.ts','scripts/verify_chapter_delivery.py','scripts/verify_chapter_long_offline.mjs'],
'DELIVER':['scripts/package_chapter.py','vite.chapter.config.ts','design/first-planet-story/PHONE_FOLLOWUP.md']}
for x in a['requirements']:
 if not x['id'].startswith('CH01-'):continue
 key=x['id'].removeprefix('CH01-');x.update(implementation='IMPLEMENTED',evidence='CURRENT_VERIFIED',visual='INTERNAL_PASS',phone='NOT_TESTED',code=code[key],proofs=common+['artifacts/chapter-one-followup/'+f for f in extra[key]],reviewBasis='Second task-vs-actual-frame internal audit; scoped playable chapter sandbox. Not user visual or physical-phone acceptance.',gap='可保存首章初版已接入；物理手机与用户视觉待审。组合为气泡/胶带条，信为既有动态房间内的轻量纸签；正式v037未自动迁移。',nextAction=f"用户扫码TapTap{tap['taptapVersion']}，审核新章关联/同球纸条/信与真实锁屏，记录机型/系统；不自动扩星或发布。")
 for f in x['proofs']:assert Path(f).exists(),f
 x['sandboxBinding']={'sourceCommit':m['sourceCommit'],'zipSha256':m['sha256'],'database':m['database'],'taptapVersion':tap['taptapVersion'],'formalIntegration':False}
a['chapterDelivery']={'status':'PLAYABLE_DEVELOPMENT_SELF_TEST_PENDING_USER_AND_PHONE','proof':'artifacts/chapter-one-followup/verification.json','sourceCommit':m['sourceCommit'],'taptapVersion':tap['taptapVersion'],'formalStorageOpened':False,'scope':'Explicitly authorized persistent chapter entry; not an automatic formal-v037 migration.'}
a['sourceCoverage']['independentAudit']='保留原181项，追加本章14项，共195项；880ffbc原文、冻结包画面、普通/QA来源及原档隔离二次核对，真机/用户待审。'
assert [x['id'] for x in a['requirements'] if not x['id'].startswith('CH01-')]==original
p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('Retained181 + proven chapter14; user/phone and formal integration remain distinct.')
