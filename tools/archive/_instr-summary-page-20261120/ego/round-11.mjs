// 第 11 轮:研发管理已默认展开 → 点「测试记录」→ 点「实验室使用记录表」→ 找「仪器使用汇总表」
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3000);
const dump = () => page.evaluate(() => ({
  modules: [...document.querySelectorAll('.nav-module')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  leaves: [...document.querySelectorAll('.nav-leaf, .nav-item, .nav-sub-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
}));
console.log('初始:', JSON.stringify(await dump()));
await page.click('text=测试记录', { label: '展开测试记录' });
await page.waitForTimeout(800);
console.log('点测试记录后:', JSON.stringify(await dump()));
await page.click('text=实验室使用记录表', { label: '展开实验室使用记录表' });
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const hit = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '仪器使用汇总表' && !el.className.includes('isu-title'));
  return {
    found: !!hit,
    cls: hit ? { tag: hit.tagName, cls: hit.className, parent: hit.parentElement?.className } : null,
    leafTexts: [...document.querySelectorAll('[class*="nav-"]')].map(t).filter((s) => s.includes('仪器')).slice(0, 10),
  };
});
console.log('菜单命中:', JSON.stringify(fin, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-11-menu.png' });
console.log({ screenshot: shot });
