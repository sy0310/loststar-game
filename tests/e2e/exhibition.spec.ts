import {test,expect} from '@playwright/test';
test('收藏室实景：六个独立玻璃展位与三个居民生态区有连续动画',async({page})=>{
  await page.goto('/exhibition-lab.html');
  await expect(page.getByRole('heading',{name:'失物收藏室'})).toBeVisible();
  const room=page.locator('#museum-canvas');await expect(room).toHaveAttribute('data-ready','true');
  await expect(page.locator('[data-exhibit]')).toHaveCount(6);
  await expect(page.locator('[data-habitat] canvas')).toHaveCount(3);
  const first=await room.screenshot();await page.waitForTimeout(550);expect(await room.screenshot()).not.toEqual(first);
  for(const button of await page.locator('[data-exhibit]').all()){const r=await button.boundingBox();expect(r!.width).toBeGreaterThanOrEqual(44);expect(r!.height).toBeGreaterThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
