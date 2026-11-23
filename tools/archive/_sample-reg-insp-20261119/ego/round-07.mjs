const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.evaluate(() => { [...document.querySelectorAll('.el-select')][1].click(); });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')];
  const t = opts.find((x) => (x.textContent || '').includes('测试库'));
  if (t) t.click();
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ins = [...document.querySelectorAll('input')];
  setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'yyt');
  setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456');
  [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click();
});
await page.waitForTimeout(4500);
await page.goto('http://127.0.0.1:8090/#/panelx/list/SAMPLE_REG', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) {}
const info = await page.evaluate(() => {
  const u = JSON.parse(localStorage.getItem('mes_user') || '{}');
  const tabs = [...document.querySelectorAll('.dt-tab')].map((x) => (x.textContent || '').trim());
  const addBtn = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('新增数据'));
  return {
    hash: location.hash, user: u.userName, isAdmin: u.isAdmin,
    panelPerms: u.panelPerms, tabs,
    addDataButtons: addBtn.length,
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 250),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-sample-insp-1119/round-07-no-add.png' });
console.log({ screenshot: shot });
