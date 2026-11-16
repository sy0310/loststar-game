import {describe, expect, it} from 'vitest';
import {advance, newGame, restore, tuning} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
import {growthCatalog} from '../src/game/growth';
import {
  legacyRestorationLedger, purchaseRestoration, researchAvailability,
  restorationPrices, startCandidateStudy,
} from '../src/review/v034-budget';

const start = 1800000000000;

describe('V0.3.4 isolated candidate budgets', () => {
  it('keeps all 27049-part legacy rights and treats owned objects as stabilized', () => {
    const save = newGame(start);
    save.resources = 27049;
    save.collection = discoveries.map(record => record.id);
    save.seenDiscoveries = [...save.collection];
    save.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
    const input = JSON.stringify(save);
    const restored = restore(input, start);
    expect(restored.resources).toBe(27049);
    expect(restored.growth).toEqual(save.growth);
    const ledger = legacyRestorationLedger(restored.collection);
    for (const id of Object.keys(restorationPrices) as (keyof typeof restorationPrices)[]) {
      expect(ledger.conditions[id]).toBe('stabilized');
      expect(purchaseRestoration(restored, ledger, id, 'found').save).toBe(restored);
    }
    expect(JSON.stringify(save)).toBe(input);
    expect(ledger.cleaning + ledger.stabilization).toBe(0);
  });

  it('charges each physical restoration once and leaves evidence and paid cabinet levels unchanged', () => {
    const save = newGame(start);
    save.resources = 500;
    save.collection = ['receipt'];
    save.growth = {'case-0': 3};
    const clean = purchaseRestoration(save, legacyRestorationLedger([]), 'receipt', 'found');
    expect(clean.save.resources).toBe(460);
    expect(purchaseRestoration(clean.save, clean.ledger, 'receipt', 'found')).toEqual(clean);
    const stable = purchaseRestoration(clean.save, clean.ledger, 'receipt', 'clean');
    expect(stable.save.resources).toBe(340);
    expect(purchaseRestoration(stable.save, stable.ledger, 'receipt', 'clean')).toEqual(stable);
    expect(stable.save.collection).toEqual(['receipt']);
    expect(stable.save.growth).toEqual({'case-0': 3});
    expect(stable.save.research).toEqual(save.research);
    expect(stable.ledger.transactions).toEqual(['receipt/clean', 'receipt/stabilize']);
  });

  it('allows free ownership when parts are insufficient and refuses unknown or unowned objects', () => {
    const save = newGame(start);
    save.resources = 7;
    save.collection = ['receipt'];
    const ledger = legacyRestorationLedger([]);
    expect(purchaseRestoration(save, ledger, 'receipt', 'found').save).toBe(save);
    expect(purchaseRestoration(save, ledger, 'tape', 'found').save).toBe(save);
    expect(save.collection).toEqual(['receipt']);
  });

  it('uses actual task time and boost with candidate prices, without duplicate funding', () => {
    const save = newGame(start);
    save.resources = 5000;
    save.collection = ['receipt'];
    for (const [id, price, minutes] of [['field', 180, 5], ['study', 900, 15], ['deep', 2400, 30]] as const) {
      const funded = startCandidateStudy(save, id, null);
      expect(funded.resources).toBe(5000 - price);
      expect(funded.research.spent).toBe(price);
      expect(funded.research.active!.end).toBe(minutes * 60000);
      expect(startCandidateStudy(funded, id, null)).toBe(funded);
      const done = advance(funded, start + minutes * 60000);
      expect(done.research.completed).toBe(1);
      expect(done.research.active).toBeNull();
      const duplicate = advance(done, done.lastAt);
      expect(duplicate).toBe(done);
      expect(done.cycles).toBeGreaterThan(advance(save, start + minutes * 60000).cycles);
    }
  });

  it('explains exhausted content and counts only actual discovered records', () => {
    const save = newGame(start);
    expect(researchAvailability(save).observedRecords).toBe(0);
    save.collection = discoveries.map(record => record.id);
    expect(researchAvailability(save)).toMatchObject({observedRecords: 12, undiscoveredRecords: 0, mode: '复核与增效'});
    expect(researchAvailability(save).output).toContain('首星已收齐');
  });

  it('caps long offline maintenance and income and refuses a second claim of elapsed time', () => {
    const save = newGame(start);
    save.resources = 27049;
    const eight = advance(save, start + 8 * 3600000, true);
    const day = advance(save, start + 24 * 3600000, true);
    expect(tuning(save).cargo).toBe(7200);
    expect(day.station.grossIncome).toBe(eight.station.grossIncome);
    expect(day.station.repairSpent).toBe(eight.station.repairSpent);
    expect(advance(day, day.lastAt, true)).toBe(day);
    expect(day.station.repairSpent).toBeLessThanOrEqual(day.station.grossIncome * .3);
    expect(day.resources + (day.pendingReturn?.resources ?? 0)).toBeGreaterThan(27049);
  });
});
