import {SAVE_KEY} from '../game/engine';
import {advanceFusion, createFusion, reduceFusion, restoreFusion} from './domain';
import type {FusionAction, FusionController, FusionResult, FusionSave} from './contracts';

export const FUSION_DATABASE = 'loststar.fusion.v1';
const objectStore = 'archive';
const recordKey = 'current';
const retryIntervalMs = 5000;
type StoredSave = FusionSave & {storageRevision?: number};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false;
    const request = indexedDB.open(FUSION_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(objectStore);
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {rejected = true; reject(request.error);};
    request.onblocked = () => {rejected = true; reject(new Error('请关闭另一个旧版窗口后重试'));};
  });
}

function revisionOf(value: StoredSave) {
  return Number.isSafeInteger(value.storageRevision) && value.storageRevision! >= 0 ? value.storageRevision! : 0;
}

function paidAction(action: FusionAction) {
  return !['tap', 'observe'].includes(action.type) &&
    !(action.type === 'paper' && ['excavate', 'identify', 'try'].includes(action.kind));
}

/** One IndexedDB read/write transaction serializes changes across tabs and WebViews. */
export async function openFusionStore(): Promise<FusionController> {
  let database: IDBDatabase | undefined;
  let legacy: string | null = null;
  try {legacy = localStorage.getItem(SAVE_KEY);} catch { /* An existing fusion archive remains readable through IDB. */ }
  const listeners = new Set<() => void>();
  let current = createFusion(Date.now(), legacy);
  let currentRevision = 0;
  let persisted = false;
  let retryAt = 0;
  let reconnecting = false;
  let lastBroadcastAt = 0;
  let channel: BroadcastChannel | undefined;
  try {channel = new BroadcastChannel(FUSION_DATABASE);} catch { /* IDB provides atomic writes without a channel. */ }

  const controller: FusionController = {
    get state() {return current;},
    get persisted() {return persisted;},
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

  function transact(action?: FusionAction): Promise<FusionResult> {
    if (!database) {
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
      let next = current;
      let nextRevision = currentRevision;
      let result: FusionResult = {ok: false, message: '档案暂未保存'};
      let settled = false;
      request.onsuccess = () => {
        // Compute time after acquiring the serialized transaction, not before waiting for it.
        const now = Date.now();
        try {
          const saved = request.result as StoredSave | undefined;
          const latest = saved ? restoreFusion(JSON.stringify(saved), saved.game.lastAt) : current;
          const mutation = action ? reduceFusion(latest, action, now)
            : {state: advanceFusion(latest, now, now - latest.game.lastAt >= 30000), result: {ok: true}};
          next = mutation.state;
          result = mutation.result;
          nextRevision = Math.max(currentRevision, saved ? revisionOf(saved) : 0) + 1;
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
      database = await openDatabase();
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
          current = restoreFusion(JSON.stringify(saved), saved.game.lastAt);
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
