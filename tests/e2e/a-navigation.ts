import {expect, type Locator, type Page} from '@playwright/test';

type Input = 'click' | 'tap';
type BaseFacility = 'upgrades' | 'build' | 'research' | 'station' | 'map' | 'wallet' | 'settings';

export async function closeADetail(page: Page, input: Input = 'click') {
  if (await page.locator('#fusion-drawer').isVisible()) await page.locator('#fusion-close')[input]();
}

export async function openACollection(page: Page, input: Input = 'click') {
  await closeADetail(page, input);
  await page.locator('#fusion-app > .fu-nav [data-tab="collection"]')[input]();
  const index = page.locator('#fusion-collection-index');
  if (!await index.evaluate(node => (node as HTMLDetailsElement).open)) await index.locator(':scope > summary')[input]();
}

export async function openACurio(page: Page, id: string, input: Input = 'click') {
  await openACollection(page, input);
  await page.locator(`#fusion-collection-list [data-detail="${id}"]`)[input]();
}

export async function openABaseFacility(page: Page, facility: BaseFacility, input: Input = 'click') {
  await closeADetail(page, input);
  await page.locator('#fusion-app > .fu-nav [data-tab="base"]')[input]();
  if (facility === 'upgrades') {
    await page.locator('#fusion-base .fu-base-grow')[input]();
    return;
  }
  const more = page.locator('#fusion-base-more');
  if (!await more.evaluate(node => (node as HTMLDetailsElement).open)) await more.locator(':scope > summary')[input]();
  const selector = ['map', 'wallet', 'settings'].includes(facility) ? `#fusion-${facility}` : `[data-drawer="${facility}"]`;
  await more.locator(selector)[input]();
}

/** Reveal the same paid/owned control through its approved collapsed section. */
export async function revealAControl(control: Locator, input: Input = 'click') {
  const section = control.locator('xpath=ancestor::details[1]');
  if (await section.count() && !await section.evaluate(node => (node as HTMLDetailsElement).open)) await section.locator(':scope > summary')[input]();
  return control;
}

export async function openAProject(page: Page, id: string, owned = false, input: Input = 'click') {
  await openABaseFacility(page, 'build', input);
  const control = page.locator(`#fusion-drawer [data-${owned ? 'open-project' : 'project'}="${id}"]`);
  await revealAControl(control, input);
  await control[input]();
}

export async function openAAbility(page: Page, id: 'receipt' | 'tape', input: Input = 'click') {
  await openABaseFacility(page, 'build', input);
  const control = page.locator(`[data-base-ability="${id}"]`);
  await revealAControl(control, input);
  return control;
}

export async function openAFlow(page: Page, input: Input = 'click') {
  await closeADetail(page, input);
  await page.locator('#fusion-app > .fu-nav [data-tab="explore"]')[input]();
  if (!await page.locator('#fusion-field-drawer').isVisible()) await page.locator('#fusion-observe')[input]();
  await expect(page.locator('#fusion-field-drawer')).toBeVisible();
}

export async function openACloseup(page: Page, input: Input = 'click') {
  await openAFlow(page, input);
  const closeup = page.locator('#fusion-closeup');
  if (!await closeup.evaluate(node => (node as HTMLDetailsElement).open)) await closeup.locator(':scope > summary')[input]();
}
