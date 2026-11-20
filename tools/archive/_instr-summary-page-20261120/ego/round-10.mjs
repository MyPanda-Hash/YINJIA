// 第 10 轮:走侧栏导航 研发管理 → 测试记录 → 实验室使用记录表,确认「仪器使用汇总表」入口
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3000);
const dump = () => page.evaluate(() => ({
  groups: [...document.querySelectorAll('.nav-group')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  modules: [...document.querySelectorAll('.nav-module')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}));
console.log('初始:', JSON.stringify(await dump()));
await page.click('loc=css:.nav-group:not(.active)', { label: '打开研发管理导航' }).catch(async () => {
  await page.click('text=研发管理', { label: '打开研发管理导航' });
});
await page.waitForTimeout(1200);
console.log('打开研发管理:', JSON.stringify(await dump()));
await page.click('text=测试记录', { label: '展开测试记录' }).catch((e) => console.log('测试记录:', e.message));
await page.waitForTimeout(1000);
await page.click('text=实验室使用记录表', { label: '展开实验室使用记录表' }).catch((e) => console.log('实验室:', e.message));
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => {
  const texts = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0).map((el) => (el.textContent || '').trim());
  return { hits: texts.filter((s) => s === '仪器使用汇总表'), tail: texts.filter((s) => s.includes('汇总表')) };
});
console.log('菜单命中:', JSON.stringify(fin));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-10-menu.png' });
console.log({ screenshot: shot });
