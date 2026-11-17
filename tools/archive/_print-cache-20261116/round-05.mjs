// round-05:把界面语言切回「简体中文」(不留英文给用户),并确认缓存卡片已清空
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/sys/printStation', { timeout: 30000 });
await page.waitForTimeout(5000);

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('li, .el-dropdown-menu__item, .el-select-dropdown__item')];
  const zh = items.find((e) => (e.textContent || '').trim() === '简体中文');
  if (!zh) return 'not-found';
  zh.click();
  return '简体中文';
});
console.log('picked: ' + picked);
await page.waitForTimeout(2000);

const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  return { title: txt(document.querySelector('.ps-title')), cardText: txt(card) };
});
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: shot + '/round-05-back-to-zh.png' });
console.log('screenshot -> round-05-back-to-zh.png');
