// 第 8 轮:① InspSummary 连刷 3 次无 500;② 仪器使用汇总表点「全部」= 4 条;③ 侧栏菜单能找到入口
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');

// ① 样品检验汇总表连续刷新(复核"首屏 500"是否可复现)
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(3000);
const errs = [];
for (let i = 0; i < 3; i++) {
  await page.reload();
  await page.waitForTimeout(3500);
  const one = await page.evaluate(() => ({
    msgs: [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    stats: [...document.querySelectorAll('.iss-stat')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())[0] || '',
  }));
  errs.push(one);
}
console.log('InspSummary 刷新 3 次:', JSON.stringify(errs));

// ② 仪器使用汇总表:全部区间
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.reload();
await page.waitForTimeout(4000);
await page.click('loc=css:.isu-quick .el-radio-button:nth-child(5) .el-radio-button__inner', { label: '点全部区间' });
await page.waitForTimeout(2500);
const all = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    dates: [...document.querySelectorAll('.isu-range input')].map((i) => i.value),
    stats: [...document.querySelectorAll('.isu-stat')].map(t),
    rows: [...document.querySelectorAll('.isu-table .el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(t).filter(Boolean).join(' | ')),
  };
});
console.log('全部区间:', JSON.stringify(all, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-08-all.png' });

// ③ 侧栏菜单:研发管理 › 测试记录 › 实验室使用记录表 › 仪器使用汇总表
const menu = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
  return { hasInstrSummary: items.some((s) => s.includes('仪器使用汇总表')), hits: items.filter((s) => s.includes('仪器') || s.includes('实验室')) };
});
console.log('侧栏:', JSON.stringify(menu));
const shot2 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-08-menu.png' });
console.log({ screenshots: [shot, shot2] });
