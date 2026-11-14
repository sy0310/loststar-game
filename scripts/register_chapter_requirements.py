"""Append chapter requirements to the existing canonical inventory, retaining all original IDs."""
import json
from pathlib import Path
p=Path('design/visual-renewal/ASSET_REGISTRY.json')
r=json.loads(p.read_text());a=r['acceptance'];src='design/first-planet-story/CHAPTER_01_CODEX_HANDOFF.md'
rows=[
('BASELINE',11,14,'Preserve sample6 theme, safe sky, three tabs, whole images, instant clean and 550ms guard.'),
('SIX',24,41,'All six approved18 material-state lines and representative free interactions use actual saved conditions.'),
('LINKS',43,57,'Three ownership-gated relations handle shuffled order and unclaimed cargo without spoilers.'),
('NIGHT',59,73,'Eligibility is not occurrence; real night event uses same globe/sorter/robot, stores conclusion, free read-only replay.'),
('COMBO',75,79,'One optional free receipt/tape joke, no rewards or chapter gate; disclose bubble fallback.'),
('ENDING',81,94,'Reuse last-recipient among original12, letter front/back, room/robot/resident/light, honest first-round completion.'),
('RETURN',96,104,'Single actual return card prioritizes new finds, then chapter, then parts/maintenance; viewing differs from claim.'),
('SAVE',106,116,'Independent persistent atomic IDB chapter save;120 only first creation, no automatic v037/backups reads or writes.'),
('LEGACY',112,117,'Explicit QA JSON copy preserves27049 and purchased rights, grants eligibility but no historical new ending.'),
('LOGS',121,127,'Local minimal behavior records, off switch and JSON/CSV, actual visibility/manual/automatic/replay/QA distinguished.'),
('VERIFY',129,144,'Natural, shuffled, offline, concurrent, payment/replay/refresh, two browser engines and safe-area validation.'),
('DELIVER',146,160,'Persistent playable self-test, fixed source/ZIP/Tap/media/performance and honest phone limitations; Draft only.')]
for key,start,end,text in rows:
 id='CH01-'+key
 if id in a['requiredIds']:continue
 a['requiredIds'].append(id)
 a['requirements'].append(dict(id=id,parent=None,requirement=text,acceptanceCriteria=text,sourceRefs=[dict(path=src,startLine=start,endLine=end)],scope='IN_SCOPE',implementation='IN_PROGRESS',evidence='MISSING',visual='NOT_REVIEWED',phone='NOT_TESTED',code=['src/chapter/model.ts','src/chapter/ui.ts','src/chapter/scene.ts','src/chapter/entry.ts','src/fusion/store.ts','tests/chapter-model.test.ts','src/chapter/chapter.spec.ts'],assets=['assets/runtime/visual-renewal/whole-states-v043/registration.json'],entrypoints=[dict(route='src/chapter/entry.ts',label='Persistent chapter sandbox; QA has a separate database.')],checks=['chapter-model','chapter-browser','chapter-fixed-package'],proofs=[],gap='Fixed-package evidence in progress; user visual and physical-phone review pending.',nextAction='Verify ordinary route and real return, then deliver frozen chapter self-test.'))
if src not in a['sourceCoverage']['documents']:a['sourceCoverage']['documents'].append(src)
p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
