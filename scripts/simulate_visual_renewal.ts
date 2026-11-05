import {mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {newGame, cost, MAX_LEVEL, tuning, type UpgradeId} from '../src/game/engine';
import {growthCatalog, growthLevel} from '../src/game/growth';
import {discoveries} from '../src/content/catalog';
import {advanceFusion, createFusion, curioPrices, projectAvailable, reduceFusion, restoreFusion} from '../src/fusion/domain';
import {fusionProjects, fusionTargets, type FusionAction, type FusionSave} from '../src/fusion/contracts';
import {refinementView} from '../src/fusion/progression';
import {surfaceView} from '../src/fusion/surface';
import {receiptRestorationMainAction} from '../src/review/receipt-restoration';
import {restorationPrices} from '../src/review/v034-budget';

const epoch = 1800000000000;
const times = [0, 5, 15, 30, 60, 120];
const reserve = 54;
type Cohort = 'fresh' | 'restart-27049' | 'legacy-27049' | 'legacy-50000';
type Strategy = 'idle' | 'assist';
const cohorts: Cohort[] = ['fresh', 'restart-27049', 'legacy-27049', 'legacy-50000'];
const checks = {negative: 0, accounting: 0, quotedPrice: 0, categoryTotal: 0, duplicateCharge: 0, falseSignature: 0,
  shuffledFog: 0, duplicateClaim: 0, archiveRights: 0, directTapIncome: 0, offlineCap: 0, completedStudies: 0};
const rows: Record<string, unknown>[] = [];
const offline: Record<string, unknown>[] = [];

function opening(cohort: Cohort) {
  if (cohort === 'fresh') return createFusion(epoch, null, {journey: true, seed: 3701});
  const old = newGame(epoch);
  old.resources = cohort === 'legacy-50000' ? 50000 : 27049;
  old.collection = discoveries.map(entry => entry.id);
  old.seenDiscoveries = [...old.collection];
  old.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
  old.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
  const source = JSON.stringify(old);
  const state = createFusion(epoch, source, {journey: cohort === 'restart-27049', seed: 3701});
  if (JSON.stringify(old) !== source) checks.archiveRights++;
  if (cohort === 'restart-27049' && (state.game.resources !== 120 || state.game.collection.length
    || Object.values(state.game.upgrades).some(level => level !== 0) || Object.keys(state.game.growth).length)) checks.archiveRights++;
  if (cohort.startsWith('legacy') && (state.game.resources !== old.resources
    || JSON.stringify(state.game.collection) !== JSON.stringify(old.collection)
    || JSON.stringify(state.game.upgrades) !== JSON.stringify(old.upgrades)
    || JSON.stringify(state.game.growth) !== JSON.stringify(old.growth)
    || state.receipt.condition !== 'stabilized'
    || Object.values(state.curios).some(curio => curio.condition !== 'stabilized'))) checks.archiveRights++;
  return state;
}

function actionPrice(state: FusionSave, action: FusionAction) {
  if (action.type === 'upgrade') return cost(state.game, action.id);
  if (action.type === 'growth') return growthCatalog.find(entry => entry.id === action.id)!.costs[action.expected];
  if (action.type === 'paper') return action.kind === 'clean' ? restorationPrices.receipt.clean
    : action.kind === 'repair' ? restorationPrices.receipt.stabilize : 0;
  if (action.type === 'curio') return curioPrices[action.id][action.kind];
  if (action.type === 'project') return fusionProjects.find(entry => entry.id === action.id)!.price;
  if (action.type === 'task') return fusionTargets.find(entry => entry.id === action.target)!.price;
  const view = refinementView(state);
  if (action.type === 'ability') return view.abilities[action.id].nextPrice ?? 0;
  if (action.type === 'sorting') return action.kind === 'build' ? view.mainAction.price : action.kind === 'research' ? view.researchAction.price : 0;
  return 0;
}

/** A finite, disclosed spending policy chooses real available actions. */
function nextAction(state: FusionSave): FusionAction | undefined {
  const game = state.game;
  const available = (price: number) => game.resources >= price + reserve;
  if (game.pendingReturn) return {type: 'claim'};
  if (game.collection.includes('receipt') && !state.receipt.activeAction) {
    const paper = receiptRestorationMainAction(state.receipt);
    const newEvidence = state.receipt.evidenceIds.some(id => !state.receipt.verifiedEvidenceIds.includes(id));
    if (['excavate', 'clean', 'repair'].includes(paper.kind) || (paper.kind === 'identify' && newEvidence)) {
      const action = {type: 'paper', kind: paper.kind} as FusionAction;
      if (actionPrice(state, action) === 0 || available(actionPrice(state, action))) return action;
    }
  }
  const core = (['scanner', 'recycler'] as UpgradeId[]).find(id => game.upgrades[id] < 1 && available(cost(game, id)));
  if (core) return {type: 'upgrade', id: core, expected: game.upgrades[core]};
  const security = ['guard-0', 'guard-1', 'repair-bay'].find(id => growthLevel(game, id) < 1 && available(growthCatalog.find(entry => entry.id === id)!.costs[0]));
  if (security) return {type: 'growth', id: security, expected: 0};
  for (const [id, prices] of Object.entries(curioPrices)) {
    const curio = state.curios[id];
    if (!game.collection.includes(id) || !curio || curio.action || curio.condition === 'stabilized') continue;
    const kind = curio.condition === 'found' ? 'clean' : 'repair';
    if (available(prices[kind])) return {type: 'curio', id, kind};
  }
  const view = refinementView(state);
  const ability = Object.values(view.abilities).find(entry => entry.enabled && entry.level < 1 && available(entry.nextPrice ?? Infinity));
  if (ability) return ability.action;
  if (view.sorting.phase !== 'cleared' && view.mainAction.enabled
    && (view.mainAction.price === 0 || available(view.mainAction.price))) return view.mainAction.action;
  if (view.compareAction.enabled) return view.compareAction.action;
  if (view.sorting.phase === 'cleared' && view.researchAction.enabled && view.researchAction.price > 0 && available(view.researchAction.price)) return view.researchAction.action;
  const upgrade = (['scanner', 'recycler', 'cargo', 'radar'] as UpgradeId[]).find(id => game.upgrades[id] < Math.min(3, MAX_LEVEL) && available(cost(game, id)));
  if (upgrade) return {type: 'upgrade', id: upgrade, expected: game.upgrades[upgrade]};
  const cabinet = growthCatalog.find(entry => entry.id.startsWith('case-') && entry.requires && game.collection.includes(entry.requires)
    && growthLevel(game, entry.id) < entry.costs.length && available(entry.costs[growthLevel(game, entry.id)]));
  if (cabinet) return {type: 'growth', id: cabinet.id, expected: growthLevel(game, cabinet.id)};
  const project = fusionProjects.find(entry => projectAvailable(state, entry.id).available && available(entry.price));
  if (project) return {type: 'project', id: project.id};
  return undefined;
}

for (const cohort of cohorts) for (const strategy of ['idle', 'assist'] as Strategy[]) {
  let state = opening(cohort);
  const start = state.game.resources;
  const layout = JSON.stringify(state.journey?.sites.map(site => ({id: site.id, anchor: site.anchor, variant: site.variant})) ?? []);
  let spent = 0;
  const categories: Record<string, number> = {};
  const take = (minute: number) => {
    const held = state.game.pendingReturn?.resources ?? 0;
    const expected = start + state.game.station.grossIncome - state.game.station.repairSpent - spent;
    if (state.game.resources < 0 || held < 0) checks.negative++;
    if (Math.abs(state.game.resources + held - expected) > 1e-6) checks.accounting++;
    if (Object.values(categories).reduce((total, price) => total + price, 0) !== spent) checks.categoryTotal++;
    if (state.receipt.verifiedEvidenceIds.includes('signature')) checks.falseSignature++;
    const current = JSON.stringify(state.journey?.sites.map(site => ({id: site.id, anchor: site.anchor, variant: site.variant})) ?? []);
    if (current !== layout) checks.shuffledFog++;
    rows.push({cohort, strategy, minute, archivedParts: cohort === 'restart-27049' ? 27049 : 0, initial: start,
      gross: state.game.station.grossIncome, maintenance: state.game.station.repairSpent, spent, balance: state.game.resources,
      held, discoveries: state.game.collection.length, revealedSites: surfaceView(state).filter(site => site.revealed).length,
      offlineCapHours: tuning(state.game).cargo / 3600, sortingPhase: state.progression.sorting.phase,
      completedStudies: state.progression.sorting.facts.filter(fact => fact.kind === 'study').length,
      acceptedTaps: state.game.assist?.actionSeq ?? 0, appliedAssistMs: state.game.assist?.appliedWorkMs ?? 0,
      upgrades: categories.upgrade ?? 0, security: categories.security ?? 0, restoration: categories.restoration ?? 0,
      cabinets: categories.cabinets ?? 0, abilities: categories.ability ?? 0, region: categories.sorting ?? 0, projects: categories.project ?? 0});
  };
  take(0);
  for (let seconds = 1; seconds <= 7200; seconds++) {
    state = advanceFusion(state, epoch + seconds * 1000);
    if (strategy === 'assist') {
      const before = state.game.resources;
      state = reduceFusion(state, {type: 'tap'}, state.game.lastAt).state;
      if (state.game.resources !== before) checks.directTapIncome++;
    }
    const action = nextAction(state);
    if (action) {
      const before = state.game.resources;
      const quoted = actionPrice(state, action);
      const result = reduceFusion(state, action, state.game.lastAt);
      state = result.state;
      if (result.result.ok) {
        const price = before - state.game.resources;
        if (action.type !== 'claim' && price !== quoted) checks.quotedPrice++;
        if (price > 0) {
          spent += price;
          const category = action.type === 'paper' || action.type === 'curio' ? 'restoration'
            : action.type === 'growth' ? action.id.startsWith('case-') ? 'cabinets' : 'security' : action.type;
          categories[category] = (categories[category] ?? 0) + price;
          const duplicate = reduceFusion(state, action, state.game.lastAt);
          if (duplicate.result.ok || duplicate.state.game.resources !== state.game.resources) checks.duplicateCharge++;
        }
      }
    }
    if (times.includes(seconds / 60)) take(seconds / 60);
  }
  if (cohort.startsWith('legacy') && (state.progression.sorting.phase !== 'cleared'
    || state.progression.sorting.facts.filter(fact => fact.kind === 'study').length !== 3)) checks.completedStudies++;
}

for (const cohort of cohorts) for (const hours of [8, 24, 72]) {
  const state = opening(cohort);
  const initial = state.game.resources;
  const capSeconds = tuning(state.game).cargo;
  const later = restoreFusion(JSON.stringify(state), epoch + hours * 3600000);
  const held = later.game.pendingReturn?.resources ?? 0;
  const claimed = reduceFusion(later, {type: 'claim'}, later.game.lastAt);
  const twice = reduceFusion(claimed.state, {type: 'claim'}, claimed.state.game.lastAt);
  if (twice.result.ok || twice.state.game.resources !== claimed.state.game.resources) checks.duplicateClaim++;
  const expected = initial + later.game.station.grossIncome - later.game.station.repairSpent;
  if (Math.abs(expected - claimed.state.game.resources) > 1e-6) checks.accounting++;
  if (claimed.state.game.resources < 0) checks.negative++;
  if (later.game.pendingReturn?.seconds !== Math.min(hours * 3600, capSeconds)) checks.offlineCap++;
  offline.push({cohort, hours, initial, gross: later.game.station.grossIncome, maintenance: later.game.station.repairSpent,
    offlineCapHours: capSeconds / 3600, settledHours: (later.game.pendingReturn?.seconds ?? 0) / 3600,
    held, claimed: claimed.state.game.resources, discoveries: claimed.state.game.collection.length,
    revealedSites: surfaceView(claimed.state).filter(site => site.revealed).length, duplicateClaimRejected: !twice.result.ok});
}

const output = 'artifacts/visual-renewal';
mkdirSync(output, {recursive: true});
function csv(values: Record<string, unknown>[]) {
  const keys = Object.keys(values[0]);
  return [keys.join(','), ...values.map(row => keys.map(key => JSON.stringify(row[key] ?? '')).join(','))].join('\n') + '\n';
}
writeFileSync(`${output}/economy.json`, JSON.stringify({sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  sourceState: execFileSync('git', ['status', '--porcelain', '--', 'src', 'assets/runtime', 'package.json', 'package-lock.json'], {encoding: 'utf8'}).trim() ? 'Working tree has pending runtime changes; sourceCommit identifies its base HEAD.' : 'Frozen runtime source; sourceCommit identifies the unchanged runtime.',
  policy: 'Each second chooses at most one real action. Optional purchases leave54 before automatic maintenance. Receipt restoration, scanner/recycler1, security1, other curio restoration, abilities1, existing sorting work and three90-part studies, equipment up to3, cabinets, base projects. Idle uses automatic exploration and this purchase policy. Assist adds one tap attempt per second through the real daytime and queue limits.',
  archiveScope: 'Restart27049 passes a read-only27049 source into the real fresh-campaign model and begins120. Full original bytes and legacy ownership are checked here. IndexedDB source backup and atomic first-write are exercised separately by first-planet-store.spec.ts.',
  checks, rows, offline}, null, 2) + '\n');
writeFileSync(`${output}/economy.csv`, csv(rows));
writeFileSync(`${output}/offline.csv`, csv(offline));
console.log(JSON.stringify({rows: rows.length, offline: offline.length, checks}));
if (Object.values(checks).some(value => value !== 0)) process.exitCode = 1;
