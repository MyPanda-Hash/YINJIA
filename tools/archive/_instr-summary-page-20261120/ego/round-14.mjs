// 菜单取证(一次点击 + DOM 逐级展开):研发管理 → 测试记录 → 实验室使用记录表 → 仪器使用汇总表
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(2600);
await page.click('loc=css:.nav-group:has-text("研发管理")', { label: '打开研发管理导航' });
await page.waitForTimeout(1000);
const step = (label) => page.evaluate((wire) => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const box = t(document.querySelector('.nav-modules')) === wire ? document.querySelector('.nav-modules')?.parentElement : null;
  const all = [...document.querySelectorAll('.nav-module')];
  const target = all.find((el) => t(el).includes(wire) && el.offsetParent !== null) || all.find((el) => t(el).includes(wire));
  if (target) { target.click(); return { clicked: wire, ok: true }; }
  return { clicked: wire, ok: false, visible: all.filter((el) => el.offsetParent !== null).map(t) };
}, label);
console.log(JSON.stringify(await step('测试记录')));
await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.nav-module')].filter((el) => el.offsetParent !== null).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))));
console.log(JSON.stringify(await step('实验室使用记录表')));
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const nodes = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && t(el) === '仪器使用汇总表');
  const visible = nodes.filter((el) => el.offsetParent !== null);
  return {
    hits: nodes.map((el) => ({ cls: el.className, parentCls: el.parentElement?.className })),
    visibleHit: visible.length,
    panelText: [...document.querySelectorAll('.nav-module, .nav-item, [class*="nav-"]')].filter((el) => el.offsetParent !== null).map(t).filter((s) => s.includes('记录表')).slice(0, 10),
  };
});
console.log('命中:', JSON.stringify(fin, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-14-menu.png' });
console.log({ screenshot: shot });
