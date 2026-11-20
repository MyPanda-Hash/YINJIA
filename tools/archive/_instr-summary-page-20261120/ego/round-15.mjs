// 菜单第三级取证:测试记录卡片列表里应能看到「实验室使用记录表」分组 → 其下含「仪器使用汇总表」
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(2600);
await page.click('loc=css:.nav-group:has-text("研发管理")', { label: '打开研发管理' });
await page.waitForTimeout(900);
const visibleCards = () => page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('.card-item')].filter((el) => el.offsetParent !== null).map(t);
});
console.log('卡片初始:', JSON.stringify(await visibleCards()));
await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  [...document.querySelectorAll('.nav-module')].find((el) => t(el).includes('测试记录'))?.click();
});
await page.waitForTimeout(1200);
console.log('点测试记录后:', JSON.stringify(await visibleCards()));
const labCard = await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const card = [...document.querySelectorAll('.card-item')].find((el) => t(el).includes('实验室使用记录表'));
  if (card) card.click();
  return !!card;
});
await page.waitForTimeout(1200);
const after = await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    cards: [...document.querySelectorAll('.card-item')].filter((el) => el.offsetParent !== null).map(t),
    hasSummary: [...document.querySelectorAll('.card-item')].some((el) => t(el).includes('仪器使用汇总表')),
  };
});
console.log('点实验室使用记录表后:', JSON.stringify(after, null, 2), 'labCard:', labCard);
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-15-menu.png' });
console.log({ screenshot: shot });
