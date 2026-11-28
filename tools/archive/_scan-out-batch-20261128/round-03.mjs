const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

// 清掉上一会话的登录态(只清本应用的键,不动浏览器 cookie)
await page.evaluate(() => {
  ['mes_token', 'mes_user', 'mes_factory'].forEach((k) => localStorage.removeItem(k));
});
await page.goto('http://localhost:5173/#/login', { timeout: 30000 });
await page.reload();
await page.waitForTimeout(3000);

const fill = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ins = [...document.querySelectorAll('input')];
  const user = ins.find((i) => (i.placeholder || '').includes('账号') || (i.placeholder || '').includes('用户'));
  const pass = ins.find((i) => (i.placeholder || '').includes('密码'));
  if (user) setVal(user, 'admin');
  if (pass) setVal(pass, '123456');
  return { user: !!user, pass: !!pass, inputs: ins.map((i) => i.placeholder) };
});
console.log(JSON.stringify(fill, null, 2));

// 打开「登录工厂」下拉,选测试库
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.el-form-item')]
    .find((el) => (el.textContent || '').includes('登录工厂'));
  const sel = item && item.querySelector('.el-select');
  if (sel) sel.click();
});
await page.waitForTimeout(800);
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .map((el) => (el.textContent || '').trim()));
console.log('options: ' + JSON.stringify(opts));
await page.evaluate(() => {
  const o = [...document.querySelectorAll('.el-select-dropdown__item')]
    .find((el) => (el.textContent || '').includes('测试'));
  if (o) o.click();
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(4000);

const after = await page.evaluate(() => ({
  hash: location.hash,
  factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || '{}'); } catch { return {}; } })(),
  head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
}));
console.log(JSON.stringify(after, null, 2));

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 30000 });
await page.waitForTimeout(2500);

// 扫码枪输入:物料码(只有编码,不带批号)YJ-XH-001
const scanned = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const input = document.querySelector('.mo-scanbar input');
  if (!input) return { ok: false };
  setVal(input, 'YJ-XH-001');
  const btn = [...document.querySelectorAll('.mo-scanbar button')].find((b) => (b.textContent || '').includes('查询'));
  if (btn) btn.click();
  return { ok: true };
});
console.log('scan=' + JSON.stringify(scanned));
await page.waitForTimeout(2500);

const snap = await page.evaluate(() => ({
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
  rows: [...document.querySelectorAll('.mo-batch-row')].map((el) => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: !!el.querySelector('.el-checkbox.is-checked'),
  })),
  qty: (document.querySelector('.mo-qty input') || {}).value,
}));
console.log(JSON.stringify(snap, null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-out-batch-20261128/round-03.png' });
