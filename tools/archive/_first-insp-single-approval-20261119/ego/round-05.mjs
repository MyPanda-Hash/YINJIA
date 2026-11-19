const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 });
await page.waitForTimeout(3000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

// 1) 打开账套下拉
await page.click('.t-left .factory');
await page.waitForTimeout(900);
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
  .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('factories:', JSON.stringify(items));

// 2) 选「测试库」
const target = items.find((t) => /测试/.test(t));
if (!target) throw new Error('下拉里找不到测试库：' + JSON.stringify(items));
await page.evaluate((label) => {
  const el = [...document.querySelectorAll('.el-dropdown-menu__item')]
    .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === label);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, target);
await page.waitForTimeout(1200);

// 3) 填密码并确认
const dlgInfo = await page.evaluate(() => ({
  dialog: !!document.querySelector('.factory-switch-dialog'),
  inputs: [...document.querySelectorAll('.factory-switch-dialog input')].map((i) => i.type),
  btns: [...document.querySelectorAll('.factory-switch-dialog button')].map((b) => (b.textContent || '').trim()),
}));
console.log('dialog:', JSON.stringify(dlgInfo));
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inp = document.querySelector('.factory-switch-dialog input');
  setVal(inp, '123456');
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.factory-switch-dialog button')]
    .find((b) => (b.textContent || '').includes('切换并重新登录'));
  btn.click();
});
await page.waitForTimeout(7000);

const after = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
}));
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-05-switch-test-ledger.png' });
