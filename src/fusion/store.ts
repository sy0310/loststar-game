import {SAVE_KEY} from '../game/engine';
import {advanceFusion, createFusion, reduceFusion, restoreFusion} from './domain';
import type {FusionAction, FusionBackupStatus, FusionController, FusionResult, FusionSave} from './contracts';

export const FUSION_DATABASE = 'loststar.fusion.v1';
export const FUSION_REVIEW_DATABASE = 'loststar.fusion.review.v035';
export const FUSION_JOURNEY_DATABASE = 'loststar.fusion.firstplanet.v037';
const objectStore = 'archive';
const recordKey = 'current';
const retryIntervalMs = 5000;
type StoredSave = FusionSave & {storageRevision?: number};
type PreviousArchive = {status: 'ready'; state: FusionSave} | {status: 'missing' | 'failed'};
interface SourceBackup {
  kind: 'source-backup';
  source: {kind: 'indexeddb' | 'localStorage'; database?: string; objectStore?: string; key: IDBValidKey | string};
  capturedAt: number;
  status: 'accessible' | 'missing' | 'failed';
  raw?: string;
  value?: unknown;
}
interface JourneyBackups {entries: SourceBackup[]; status: FusionBackupStatus}

/** Read the entire prior archive without upgrading, creating or writing its database. */
function archiveBackups(name: string): Promise<SourceBackup[]> {
  return new Promise(resolve => {
    const capturedAt = Date.now();
    const source = {kind: 'indexeddb' as const, database: name, objectStore, key: recordKey};
    let missing = false;
    let settled = false;
    let request: IDBOpenDBRequest;
    const finish = (entries: SourceBackup[]) => {if (!settled) {settled = true; resolve(entries);}};
    const unavailable = () => finish([{kind: 'source-backup', source, capturedAt, status: missing ? 'missing' : 'failed'}]);
    try {request = indexedDB.open(name);}
    catch {unavailable(); return;}
    request.onupgradeneeded = () => {missing = true; request.transaction?.abort();};
    request.onerror = request.onblocked = unavailable;
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {database.close(); return;}
      if (!database.objectStoreNames.contains(objectStore)) {database.close(); unavailable(); return;}
      try {
        const transaction = database.transaction(objectStore, 'readonly');
        const store = transaction.objectStore(objectStore);
        const values = store.getAll();
        const keys = store.getAllKeys();
        transaction.oncomplete = () => {
          database.close();
          if (!values.result.length) {missing = true; unavailable(); return;}
          finish(values.result.map((value: unknown, index) => {
            let raw: string | undefined;
            try {raw = typeof value === 'string' ? value : JSON.stringify(value);}
            catch { /* Structured IDB values can contain cycles. The original value is still copied intact. */ }
            return {kind: 'source-backup', source: {...source, key: keys.result[index]}, capturedAt,
              status: 'accessible', value, ...(raw === undefined ? {} : {raw})};
          }));
        };
        transaction.onerror = transaction.onabort = () => {database.close(); unavailable();};
      } catch {database.close(); unavailable();}
    };
  });
}

async function captureJourneyBackups(): Promise<JourneyBackups> {
  const archives = await Promise.all([archiveBackups(FUSION_REVIEW_DATABASE), archiveBackups(FUSION_DATABASE)]);
  const source = {kind: 'localStorage' as const, key: SAVE_KEY};
  let legacy: SourceBackup;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    legacy = {kind: 'source-backup', source, capturedAt: Date.now(), status: raw === null ? 'missing' : 'accessible',
      ...(raw === null ? {} : {raw, value: raw})};
  } catch {legacy = {kind: 'source-backup', source, capturedAt: Date.now(), status: 'failed'};}
  const entries = [...archives.flat(), legacy];
  const accessibleSources = new Set(entries.filter(entry => entry.status === 'accessible')
    .map(entry => entry.source.database ?? entry.source.key)).size;
  const failedSources = entries.filter(entry => entry.status === 'failed').length;
  return {entries, status: {status: 'pending', accessibleSources, failedSources}};
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false;
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(objectStore);
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {rejected = true; reject(request.error);};
    request.onblocked = () => {rejected = true; reject(new Error('请关闭另一个旧版窗口后重试'));};
  });
}

function restoreReviewArchive(saved: StoredSave): FusionSave {
  const game = saved?.game;
  if (!game || !Number.isFinite(game.lastAt)
    || !createFusion(game.lastAt + 1, JSON.stringify(game)).importedLegacy) throw new Error('审阅档案结构无法读取');
  return restoreFusion(JSON.stringify(saved), game.lastAt);
}

/** Open the prior archive read-only. Aborting creation leaves an absent source absent. */
function previousFusion(): Promise<PreviousArchive> {
  return new Promise(resolve => {
    let settled = false;
    let missing = false;
    let request: IDBOpenDBRequest;
    try {request = indexedDB.open(FUSION_DATABASE);}
    catch {resolve({status: 'failed'}); return;}
    const finish = (result: PreviousArchive) => {if (!settled) {settled = true; resolve(result);}};
    request.onupgradeneeded = () => {missing = true; request.transaction?.abort();};
    request.onerror = () => finish({status: missing ? 'missing' : 'failed'});
    request.onblocked = () => finish({status: 'failed'});
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {database.close(); return;}
      if (!database.objectStoreNames.contains(objectStore)) {database.close(); finish({status: 'failed'}); return;}
      try {
        const transaction = database.transaction(objectStore, 'readonly');
        const read = transaction.objectStore(objectStore).get(recordKey);
        read.onsuccess = () => {
          try {
            const saved = read.result as StoredSave | undefined;
            finish(saved === undefined ? {status: 'missing'}
              : {status: 'ready', state: restoreReviewArchive(saved)});
          } catch {finish({status: 'failed'});}
        };
        transaction.onerror = () => finish({status: 'failed'});
        transaction.oncomplete = transaction.onabort = () => {database.close(); finish({status: 'failed'});};
      } catch {database.close(); finish({status: 'failed'});}
    };
  });
}

/** A damaged lower-priority source never becomes a newly initialized review archive. */
async function reviewSource(): Promise<PreviousArchive> {
  const previous = await previousFusion();
  if (previous.status !== 'missing') return previous;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {status: 'missing'};
    const now = Date.now();
    const state = createFusion(now, raw);
    if (!state.importedLegacy) return {status: 'failed'};
    // A decoder fallback can share the timestamp and120 balance of a damaged source.
    // A second timestamp distinguishes that fallback while keeping the real clock unchanged.
    if (JSON.parse(raw).lastAt === now && !createFusion(now + 1, raw).importedLegacy) return {status: 'failed'};
    return {status: 'ready', state};
  } catch {return {status: 'failed'};}
}

function revisionOf(value: StoredSave | null) {
  return value && Number.isSafeInteger(value.storageRevision) && value.storageRevision! >= 0 ? value.storageRevision! : 0;
}

function paidAction(action: FusionAction) {
  return !['tap', 'observe'].includes(action.type) &&
    !(action.type === 'sorting' && ['survey', 'work', 'compare', 'review'].includes(action.kind)) &&
    !(action.type === 'paper' && ['excavate', 'identify', 'try'].includes(action.kind));
}

/** One IndexedDB read/write transaction serializes changes across tabs and WebViews. */
export async function openFusionStore(options: {review?: boolean; journey?: boolean} = {}): Promise<FusionController> {
  const databaseName = options.journey ? FUSION_JOURNEY_DATABASE : options.review ? FUSION_REVIEW_DATABASE : FUSION_DATABASE;
  let database: IDBDatabase | undefined;
  let legacy: string | null = null;
  try {legacy = localStorage.getItem(SAVE_KEY);} catch { /* An existing fusion archive remains readable through IDB. */ }
  const listeners = new Set<() => void>();
  let current = createFusion(Date.now(), legacy, {journey: options.journey});
  const journeyBackups = options.journey ? await captureJourneyBackups() : undefined;
  let backupStatus = journeyBackups?.status;
  let migrationBlocked = false;
  let canInitialize = true;
  if (options.review && !options.journey) {
    try {
      const previous = await reviewSource();
      migrationBlocked = previous.status === 'failed';
      canInitialize = !migrationBlocked;
      if (previous.status === 'ready') current = advanceFusion(previous.state, Date.now(), Date.now() - previous.state.game.lastAt >= 30000);
    } catch {migrationBlocked = true; canInitialize = false;}
  }
  let currentRevision = 0;
  let persisted = false;
  let retryAt = 0;
  let reconnecting = false;
  let lastBroadcastAt = 0;
  let channel: BroadcastChannel | undefined;
  try {channel = new BroadcastChannel(databaseName);} catch { /* IDB provides atomic writes without a channel. */ }

  const controller: FusionController = {
    get state() {return current;},
    get persisted() {return persisted;},
    get migrationBlocked() {return migrationBlocked;},
    get backupStatus() {return backupStatus;},
    act: action => transact(action),
    subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
  };
  const notify = () => {
    for (const listener of listeners) {
      try {listener();} catch (error) {console.error('收藏室界面更新失败', error);}
    }
  };
  const disconnect = () => {
    database?.close();
    database = undefined;
    persisted = false;
    retryAt = Date.now() + retryIntervalMs;
  };

  function decodeStored(saved: StoredSave) {
    if (!options.review && !options.journey) return restoreFusion(JSON.stringify(saved), saved.game.lastAt);
    try {
      const restored = restoreReviewArchive(saved);
      if (options.journey && !restored.journey) throw new Error('首星周目记录无法读取');
      return restored;
    }
    catch (error) {migrationBlocked = true; throw error;}
  }

  function transact(action?: FusionAction): Promise<FusionResult> {
    if (!database) {
      if (migrationBlocked) return Promise.resolve({ok: false,
        message: options.journey ? '首星档案无法读取，原档已保留' : '旧档迁移未完成，原档已保留'});
      if (action && paidAction(action)) return Promise.resolve({ok: false, message: '档案未保存，暂缓付费操作'});
      const now = Date.now();
      const next = action ? reduceFusion(current, action, now)
        : {state: advanceFusion(current, now, now - current.game.lastAt >= 30000), result: {ok: true}};
      current = next.state;
      persisted = false;
      notify();
      return Promise.resolve(next.result);
    }
    return new Promise(resolve => {
      let transaction: IDBTransaction;
      try {transaction = database!.transaction(objectStore, 'readwrite');}
      catch {disconnect(); notify(); resolve({ok: false, message: '档案暂未保存，请稍后重试'}); return;}
      const store = transaction.objectStore(objectStore);
      const request = store.get(recordKey);
      const backupRequest = options.journey ? store.get('meta/backup') : undefined;
      let next = current;
      let recovered: FusionSave | undefined;
      let recoveredRevision = currentRevision;
      let nextRevision = currentRevision;
      let result: FusionResult = {ok: false, message: '档案暂未保存'};
      let settled = false;
      request.onsuccess = () => {
        // Compute time after acquiring the serialized transaction, not before waiting for it.
        const now = Date.now();
        try {
          const saved = request.result as StoredSave | undefined;
          if (saved === undefined && !canInitialize) {migrationBlocked = true; transaction.abort(); return;}
          const hasSaved = options.review || options.journey ? saved !== undefined : Boolean(saved);
          const latest = hasSaved ? decodeStored(saved!) : current;
          if (saved) {
            recovered = latest; recoveredRevision = revisionOf(saved);
            migrationBlocked = false;
          }
          const mutation = action ? reduceFusion(latest, action, now)
            : {state: advanceFusion(latest, now, now - latest.game.lastAt >= 30000), result: {ok: true}};
          next = mutation.state;
          result = mutation.result;
          nextRevision = Math.max(currentRevision, saved ? revisionOf(saved) : 0) + 1;
          if (!hasSaved && journeyBackups) {
            // The fresh campaign and every source snapshot either commit together or abort together.
            journeyBackups.entries.forEach((entry, index) => store.put(entry, `backup/${index}`));
            const status: FusionBackupStatus = {...journeyBackups.status,
              status: journeyBackups.status.accessibleSources > 0 ? 'saved' : 'unavailable'};
            store.put(status, 'meta/backup');
          }
          store.put({...next, storageRevision: nextRevision}, recordKey);
        } catch {
          // Failed decoding leaves the original archive intact for recovery.
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        current = next;
        currentRevision = nextRevision;
        persisted = true;
        migrationBlocked = false;
        if (options.journey) {
          const savedStatus = backupRequest?.result as FusionBackupStatus | undefined;
          backupStatus = savedStatus ?? (journeyBackups ? {...journeyBackups.status,
            status: journeyBackups.status.accessibleSources > 0 ? 'saved' : 'unavailable'} : undefined);
        }
        notify();
        const now = Date.now();
        if ((action && result.ok && action.type !== 'observe') || now - lastBroadcastAt >= 1000) {
          try {channel?.postMessage({revision: currentRevision});} catch { /* Data was already committed. */ }
          lastBroadcastAt = now;
        }
        resolve(result);
      };
      transaction.onabort = transaction.onerror = () => {
        if (settled) return;
        settled = true;
        if (recovered) {current = recovered; currentRevision = recoveredRevision;}
        disconnect();
        notify();
        resolve({ok: false, message: '档案暂未保存，请稍后重试'});
      };
    });
  }

  async function reconnect() {
    if (database || reconnecting || Date.now() < retryAt) return;
    reconnecting = true;
    try {
      if (options.review && !options.journey && migrationBlocked) {
        const previous = await reviewSource();
        canInitialize = previous.status !== 'failed';
        if (previous.status === 'ready') current = advanceFusion(previous.state, Date.now(), Date.now() - previous.state.game.lastAt >= 30000);
      }
      database = await openDatabase(databaseName);
      database.onversionchange = () => {disconnect(); notify();};
      await transact();
    } catch {disconnect();}
    finally {reconnecting = false;}
  }
  await reconnect();

  if (channel) channel.onmessage = event => {
    if (!database || (typeof event.data?.revision === 'number' && event.data.revision <= currentRevision)) return;
    try {
      const transaction = database.transaction(objectStore, 'readonly');
      const request = transaction.objectStore(objectStore).get(recordKey);
      request.onsuccess = () => {
        const saved = request.result as StoredSave | undefined;
        if (!saved || revisionOf(saved) <= currentRevision) return;
        try {
          current = decodeStored(saved);
          migrationBlocked = false;
          currentRevision = revisionOf(saved);
          notify();
        } catch {persisted = false; notify();}
      };
    } catch {disconnect(); notify();}
  };
  let busy = false;
  async function tick() {
    if (busy || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      if (!database) await reconnect();
      await transact();
    } finally {busy = false;}
  }
  setInterval(() => void tick(), 250);
  document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') void tick();});
  return controller;
}
