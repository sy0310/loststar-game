/* This store owns only the survivor namespace. Old games are never opened. */
(function (root) {
  "use strict";
  const B = root.SurvivorBalance;
  const initialProfile = () => ({
    credits: 0,
    best: 0,
    runs: 0,
    hull: 0,
    gun: 0,
  });

  function validateProfile(profile) {
    if (!profile || typeof profile !== "object")
      throw Error("强化档案损坏，原始数据已保留");
    for (const field of ["credits", "best", "runs", "hull", "gun"]) {
      const maximum = ["hull", "gun"].includes(field)
        ? B.permanentMaxLevel
        : 100000000;
      if (
        !Number.isSafeInteger(profile[field]) ||
        profile[field] < 0 ||
        profile[field] > maximum
      ) {
        throw Error("强化档案字段无效，原始数据已保留");
      }
    }
    return profile;
  }

  function validateRecord(record) {
    if (
      !record ||
      record.schema !== 1 ||
      !Number.isSafeInteger(record.revision) ||
      record.revision < 0
    ) {
      throw Error("试玩存档格式无效，未覆盖原始数据");
    }
    validateProfile(record.profile);
    if (
      !Array.isArray(record.receipts) ||
      record.receipts.length > 64 ||
      new Set(record.receipts.map((r) => r.id)).size !== record.receipts.length
    ) {
      throw Error("结算记录无效");
    }
    if (
      record.active &&
      (typeof record.active.id !== "string" ||
        !Number.isSafeInteger(record.active.revision) ||
        !record.active.snapshot)
    ) {
      throw Error("未结束对局无效");
    }
    return record;
  }

  async function create({ qa = false } = {}) {
    const name = B.database + (qa ? ".qa" : "");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || Error("无法读取本地试玩档"));
      request.onblocked = () => reject(Error("请关闭其他旧试玩窗口后重试"));
    });
    let channel;
    const listeners = new Set();
    if (typeof BroadcastChannel === "function") {
      channel = new BroadcastChannel(name);
      channel.onmessage = () => listeners.forEach((listener) => listener());
    }

    function transaction(change) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const request = store.get("current");
        let result,
          failure,
          changed = false;
        request.onsuccess = () => {
          try {
            let record = request.result;
            if (!record) {
              let profile = initialProfile();
              if (!qa) {
                const legacy = localStorage.getItem(B.profileKey);
                if (legacy !== null) {
                  const parsed = JSON.parse(legacy);
                  profile = Object.fromEntries(
                    Object.keys(profile).map((key) => [key, parsed[key]]),
                  );
                  validateProfile(profile);
                  store.put(legacy, "backup/prototype-v01");
                }
              }
              record = {
                schema: 1,
                revision: 0,
                profile,
                active: null,
                receipts: [],
                lastResult: null,
              };
              store.put(record, "current");
            }
            validateRecord(record);
            result = change(record);
            if (result.write) {
              record.revision++;
              validateRecord(record);
              store.put(record, "current");
              changed = true;
            }
            result.record = structuredClone(record);
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
        tx.oncomplete = () => {
          if (changed) channel?.postMessage({ changed: true });
          resolve(result);
        };
        tx.onerror = () => {};
        tx.onabort = () =>
          reject(failure || tx.error || Error("保存失败，当前对局仍在画面中"));
      });
    }

    return {
      name,
      read: () => transaction(() => ({ write: false })),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      begin(id, snapshot) {
        return transaction((record) => {
          if (record.active) throw Error("还有未结束的一局，请先继续或结算");
          record.active = {
            id,
            revision: 0,
            snapshot: structuredClone(snapshot),
          };
          record.lastResult = null;
          return { write: true, runRevision: 0 };
        });
      },
      resume() {
        return transaction((record) => {
          if (!record.active) throw Error("这局已经结算");
          record.active.revision++;
          return { write: true, runRevision: record.active.revision };
        });
      },
      checkpoint(id, revision, snapshot) {
        return transaction((record) => {
          if (record.active?.id !== id || record.active.revision !== revision) {
            throw Error("另一窗口已继续或结束本局，请重新载入");
          }
          record.active.snapshot = structuredClone(snapshot);
          record.active.revision++;
          return { write: true, runRevision: record.active.revision };
        });
      },
      settle(id, revision, summary) {
        return transaction((record) => {
          const existing = record.receipts.find((receipt) => receipt.id === id);
          if (existing)
            return { write: false, alreadySettled: true, receipt: existing };
          if (record.active?.id !== id || record.active.revision !== revision) {
            throw Error("另一窗口已更新本局，未重复结算");
          }
          if (
            !Number.isSafeInteger(summary.credits) ||
            summary.credits < 0 ||
            summary.credits > 1000000 ||
            !Number.isSafeInteger(summary.kills) ||
            summary.kills < 0
          ) {
            throw Error("结算数值无效");
          }
          const receipt = { id, ...structuredClone(summary) };
          record.profile.credits += receipt.credits;
          record.profile.best = Math.max(record.profile.best, receipt.kills);
          record.profile.runs++;
          record.receipts.push(receipt);
          record.receipts = record.receipts.slice(-64);
          record.lastResult = receipt;
          record.active = null;
          return { write: true, receipt };
        });
      },
      buy(kind, expectedLevel) {
        return transaction((record) => {
          if (record.active) throw Error("请在本局结算后强化");
          if (
            !["hull", "gun"].includes(kind) ||
            record.profile[kind] !== expectedLevel
          )
            throw Error("强化已变化，请按当前界面重试");
          const level = record.profile[kind];
          const cost =
            (kind === "hull" ? B.hullUpgradeBase : B.gunUpgradeBase) *
            (level + 1);
          if (level >= B.permanentMaxLevel || record.profile.credits < cost)
            throw Error("当前零件不足或已满级");
          record.profile.credits -= cost;
          record.profile[kind]++;
          return { write: true, cost };
        });
      },
      close() {
        channel?.close();
        db.close();
      },
    };
  }

  root.SurvivorPersistence = { create, validateProfile, validateRecord };
})(window);
