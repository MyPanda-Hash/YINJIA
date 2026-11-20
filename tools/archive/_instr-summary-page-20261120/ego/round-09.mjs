// 第 9 轮:展开侧栏 研发管理 › 测试记录 › 实验室使用记录表,确认「仪器使用汇总表」入口在菜单里
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3500);
await page.click('text=测试记录', { label: '展开测试记录' });
await page.waitForTimeout(900);
await page.click('text=实验室使用记录表', { label: '展开实验室使用记录表' });
await page.waitForTimeout(1200);
const items = await page.evaluate(() => [...document.querySelectorAll('.el-menu-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('可见菜单项:', JSON.stringify(items));
const hit = await page.evaluate(() => [...document.querySelectorAll('.el-menu-item')].some((el) => (el.textContent || '').includes('仪器使用汇总表')));
console.log('菜单含仪器使用汇总表:', hit);
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-09-menu.png' });
console.log({ screenshot: shot });
