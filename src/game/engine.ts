import {createWorld,restoreWorld,advanceWorld,dayTimeBetween,wallForDayTime} from './world';
import type {GuardState} from '../prototype/guard-engine';
import { discoveries, planets } from '../content/catalog';
import { parcelSignals } from '../content/parcel';
import { parcelJournal, journalShift } from '../content/parcel-journal';
import {cleanGrowth,growthEffects} from './growth';
import {initialChart,stepStarChart,cleanChart,readyPlanet,type StarChart} from './star-chart';
import { emptyInterstellar, interstellarView, radarPolicy, type InterstellarScan } from './radar';

export type UpgradeId = 'radar' | 'scanner' | 'recycler' | 'cargo';
export interface ReturnCargo { id: string; seconds: number; resources: number; discoveries: string[]; }
export interface SaveData {
  version: 2;
  lastAt: number;
  resources: number;
  cycles: number;
  cycleMs: number;
  radarMs: number;
  surveyCount: number;
  surveyNotice: string | null;
  planets: string[];
  collection: string[];
  seenDiscoveries: string[];
  discoveryAt: Record<string, number>;
  upgrades: Record<UpgradeId, number>;
  pendingReturn: ReturnCargo | null;
  journal: {entries:string[];shift:number};
  interstellar: InterstellarScan;
  growth: Record<string,number>;
  chart: StarChart;
  world: GuardState;
}
// Keep the original key so the review build can migrate existing player progress.
export const SAVE_KEY = 'loststar.save.v1';
export const upgradeIds: UpgradeId[] = ['radar', 'scanner', 'recycler', 'cargo'];
export const MAX_LEVEL = 5;
export const SURVEY_DURATION = 90000;
export function newGame(now = Date.now()): SaveData {
  return {
    version: 2, lastAt: now, resources: 120, cycles: 0, cycleMs: 0,
    radarMs: 0, surveyCount: 0, surveyNotice: null, planets: ['parcel'],
    collection: [], seenDiscoveries: [], discoveryAt: {},
    upgrades: { radar: 0, scanner: 0, recycler: 0, cargo: 0 }, pendingReturn: null,
    journal:{entries:[],shift:0}, interstellar:emptyInterstellar(),growth:{},chart:initialChart(now),world:createWorld(now),
  };
}
export function tuning(s: SaveData) {
  return { radar: 1 + s.upgrades.radar * .25, scanner: 12000 / (1 + s.upgrades.scanner * .22), recycler: 8 + s.upgrades.recycler * 3, cargo: 7200 + s.upgrades.cargo * 3600 + growthEffects(s).cargoSeconds };
}
export function cost(s: SaveData, id: UpgradeId) { return Math.round(45 * 1.7 ** s.upgrades[id]); }
export function upgrade(s: SaveData, id: UpgradeId, expected=s.upgrades[id]): SaveData {
  if (expected!==s.upgrades[id] || s.upgrades[id] >= MAX_LEVEL || s.resources < cost(s, id)) return s;
  const next = structuredClone(s);
  next.resources -= cost(s, id); next.upgrades[id]++;
  next.cycleMs = s.cycleMs / tuning(s).scanner * tuning(next).scanner;
  return next;
}
export function publicPlanets(s: SaveData) {
  return planets.filter(p => s.planets.includes(p.id));
}
export function advance(s: SaveData, now: number, offline = false): SaveData {
  if (!Number.isFinite(now) || now <= s.lastAt) return s;
  const next = structuredClone(s), values = tuning(s);
  const ms = Math.min(now - s.lastAt, values.cargo * 1000);
  next.lastAt = now;next.world=advanceWorld(s,now);
  next.chart=stepStarChart(s.chart,ms*growthEffects(s).interstellarSpeed,s.planets,planets,now);next.interstellar=next.chart.scan;
  next.planets=[...new Set([...s.planets,...next.chart.records.map(r=>r.id)])];
  const totalRadar = s.radarMs + ms * values.radar;
  const surveys = Math.floor(totalRadar / SURVEY_DURATION);
  next.radarMs = totalRadar % SURVEY_DURATION;
  next.surveyCount += surveys;
  if (surveys > 0) next.surveyNotice = parcelSignals[(next.surveyCount - 1) % parcelSignals.length].id;
  const totalCycle = s.cycleMs + dayTimeBetween(s.world.elapsedMs,ms);
  const earned = Math.floor(totalCycle / values.scanner);
  next.cycles += earned; next.cycleMs = totalCycle % values.scanner;
  const known = new Set([...s.collection, ...(s.pendingReturn?.discoveries ?? [])]);
  const found = discoveries.filter(d => d.milestone <= next.cycles && !known.has(d.id));
  for (const d of found) {
    next.discoveryAt[d.id] = s.lastAt + wallForDayTime(s.world.elapsedMs,Math.max(0,(d.milestone-s.cycles)*values.scanner-s.cycleMs),ms);
  }
  const resources = earned * values.recycler + surveys * 6;
  const observed=new Set([...known,...found.map(d=>d.id)]);
  next.journal.entries=[...new Set([...s.journal.entries,...parcelJournal.filter(note=>note.cycle<=next.cycles&&note.requires.every(id=>observed.has(id))).map(note=>note.id)])];
  next.journal.shift=journalShift(next.cycles);
  if (offline && ms >= 30000) {
    const old = s.pendingReturn;
    next.pendingReturn = {
      id: old?.id ?? `return-${s.lastAt}`, seconds: (old?.seconds ?? 0) + Math.floor(ms / 1000),
      resources: (old?.resources ?? 0) + resources, discoveries: [...(old?.discoveries ?? []), ...found.map(d => d.id)],
    };
  } else {
    next.resources += resources;
    next.collection.push(...found.map(d => d.id));
  }
  next.world.owned=next.collection.filter((id):id is 'tape'|'bell'=>id==='tape'||id==='bell');
  return next;
}
export function pendingPresentations(s: SaveData) { return s.collection.filter(id => !s.seenDiscoveries.includes(id)); }
export function markPresented(s: SaveData, id: string): SaveData {
  if (!s.collection.includes(id) || s.seenDiscoveries.includes(id)) return s;
  return { ...s, seenDiscoveries: [...s.seenDiscoveries, id] };
}
export function claimReturn(s: SaveData): SaveData {
  if (!s.pendingReturn) return s;
  const next = structuredClone(s), cargo = s.pendingReturn;
  next.resources += cargo.resources;
  next.collection = [...new Set([...next.collection, ...cargo.discoveries])];
  // The return manifest itself presents the bulk discoveries; avoid a popup queue afterward.
  next.seenDiscoveries = [...new Set([...next.seenDiscoveries, ...cargo.discoveries])];
  next.pendingReturn = null;next.world.owned=next.collection.filter((id):id is 'tape'|'bell'=>id==='tape'||id==='bell');
  return next;
}
export function dismissSurvey(s: SaveData): SaveData { return { ...s, surveyNotice: null }; }
function localRadar(s: SaveData) {
  if (s.surveyNotice) return { stage: 'surveyed' as const, progress: 100, signal: parcelSignals.find(r => r.id === s.surveyNotice)! };
  const phase = s.radarMs / SURVEY_DURATION;
  const stage: 'searching' | 'anomaly' | 'locking' = phase < .5 ? 'searching' : phase < .78 ? 'anomaly' : 'locking';
  return { stage, progress: Math.floor(phase * 100) };
}
export function publicRadar(s:SaveData):ReturnType<typeof localRadar>;
export function publicRadar(s:SaveData,mode:'local'):ReturnType<typeof localRadar>;
export function publicRadar(s:SaveData,mode:'interstellar'):ReturnType<typeof interstellarView>;
export function publicRadar(s:SaveData,mode:'local'|'interstellar'='local') {
  return mode==='local'?localRadar(s):interstellarView(s.chart.scan,radarPolicy.interstellar);
}
const finite = (x: unknown, max = 1e12): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
const ids = (x: unknown, valid: string[]): x is string[] => Array.isArray(x) && x.every(id => typeof id === 'string' && valid.includes(id)) && new Set(x).size === x.length;
export function restore(raw: string | null, now = Date.now()): SaveData {
  if (!raw) return newGame(now);
  try {
    const input = JSON.parse(raw);
    const validIds = discoveries.map(d => d.id);
    if (![1, 2].includes(input.version) || !finite(input.lastAt, 1e15) || !finite(input.resources, 1e9) || !finite(input.cycles, 1e9) || !finite(input.cycleMs, 12000) || !finite(input.radarMs, 120000) ||
      !ids(input.planets, planets.map(p => p.id)) || !input.planets.includes('parcel') || !ids(input.collection, validIds) || !input.upgrades ||
      !upgradeIds.every(id => finite(input.upgrades[id], 5) && Number.isInteger(input.upgrades[id]))) return newGame(now);
    const cargo = input.pendingReturn;
    if (cargo !== null && (!cargo || !finite(cargo.resources, 1e9) || !finite(cargo.seconds, 1e9) || typeof cargo.id !== 'string' || cargo.id.length > 128 || !ids(cargo.discoveries, validIds))) return newGame(now);
    let s: SaveData;
    if (input.version === 1) {
      s = { ...newGame(input.lastAt), resources: input.resources, cycles: input.cycles, cycleMs: input.cycleMs, planets: input.planets,
        collection: input.collection, upgrades: input.upgrades, pendingReturn: cargo, seenDiscoveries: [...input.collection],
        discoveryAt: Object.fromEntries(input.collection.map((id: string) => [id, input.lastAt])) };
    } else {
      if (!finite(input.surveyCount, 1e9) || !Number.isInteger(input.surveyCount) || input.radarMs >= SURVEY_DURATION ||
        (input.surveyNotice !== null && !parcelSignals.some(r => r.id === input.surveyNotice)) || !ids(input.seenDiscoveries, input.collection) ||
        !input.discoveryAt || typeof input.discoveryAt !== 'object' || Array.isArray(input.discoveryAt) ||
        !Object.entries(input.discoveryAt).every(([id, time]) => validIds.includes(id) && finite(time, 1e15))) return newGame(now);
      s = input as SaveData;
      if(input.journal!==undefined&&(!input.journal||!ids(input.journal.entries,parcelJournal.map(note=>note.id))||!finite(input.journal.shift,1e9)||!Number.isInteger(input.journal.shift)))return newGame(now);
      if(input.interstellar!==undefined&&(!input.interstellar||!finite(input.interstellar.elapsed,90000)||
        (input.interstellar.resolved!==null&&(input.interstellar.elapsed<90000||!planets.some(p=>p.id===input.interstellar.resolved?.id&&p.name===input.interstellar.resolved?.name)))))return newGame(now);
      s={...s,journal:input.journal??{entries:[],shift:0},interstellar:input.interstellar??emptyInterstellar()};
    }
    s={...s,growth:cleanGrowth(input.growth),chart:cleanChart(input.chart,s.interstellar,s.planets,input.lastAt)};s.interstellar=s.chart.scan;
    s={...s,world:restoreWorld(input.world,input.lastAt,s.collection,growthEffects(s).guard)};
    return advance(s, now, now - s.lastAt >= 30000);
  } catch { return newGame(now); }
}
