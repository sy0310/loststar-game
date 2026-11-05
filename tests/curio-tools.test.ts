import {afterEach, expect, test, vi} from 'vitest';

afterEach(() => {vi.unstubAllGlobals();vi.resetModules();});

test('五件奇物共用工具图片解码失败后，下次准备可重试且成功结果共用', async () => {
  let failNext = true;
  let decoded = 0;
  class TestImage {
    src = '';
    decode() {
      decoded++;
      if (failNext) {failNext = false;return Promise.reject(new Error('temporary-image-failure'));}
      return Promise.resolve();
    }
  }
  vi.stubGlobal('Image', TestImage);
  const {prepareCurioTools} = await import('../src/fusion/curio-condition');
  await expect(prepareCurioTools()).rejects.toThrow('temporary-image-failure');
  const firstAttempt = decoded;
  await expect(prepareCurioTools()).resolves.toBeUndefined();
  expect(decoded).toBeGreaterThan(firstAttempt);
  const success = decoded;
  await Promise.all([prepareCurioTools(), prepareCurioTools()]);
  expect(decoded).toBe(success);
});
