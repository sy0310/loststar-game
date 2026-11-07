import {readFileSync} from 'node:fs';
import {test, expect} from '@playwright/test';

const source = JSON.parse(readFileSync(new URL('../../assets/runtime/d1-refinement/registration.json', import.meta.url), 'utf8'));
const floor = source.common.floorReceivers.basic.sourceRect;
const measuredCenter = {x: floor.x + floor.width / 2, y: floor.y + floor.height / 2};

test('收据玻璃以真实源图地板锚点对齐纸底和托盘，前后层落定一致', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?sample=art-v036&view=receipt');
  await expect(page.locator('.v036-stage canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(100);
  await page.clock.fastForward(29000);
  await page.clock.runFor(100);
  const result = await page.evaluate(() => (window as any).__V036__.metrics().study);
  expect(result.phase).toBe('complete');
  expect(result.glassSourceReceiver).toEqual(measuredCenter);
  expect(result.glassTextureSize).toEqual({width: 320, height: 320});
  const actual = {
    x: result.glassRect.x + measuredCenter.x / result.glassTextureSize.width * result.glassRect.width,
    y: result.glassRect.y + measuredCenter.y / result.glassTextureSize.height * result.glassRect.height,
  };
  expect(result.glassReceiver.x).toBeCloseTo(actual.x);
  expect(result.glassReceiver.y).toBeCloseTo(actual.y);
  expect(actual.x).toBeCloseTo(result.paperFoot.x);
  expect(actual.y).toBeCloseTo(result.paperFoot.y);
  expect(actual.x).toBeCloseTo(result.trayReceiver.x);
  expect(actual.y).toBeCloseTo(result.trayReceiver.y);
  expect(result.glassFrontReceiver.x).toBeCloseTo(actual.x);
  expect(result.glassFrontReceiver.y).toBeCloseTo(actual.y);
  expect(actual).toEqual({x: 320, y: 490});
});
