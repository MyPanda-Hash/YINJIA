const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.waitForTimeout(800);

// 退出
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((el) => /^退出$/.test((el.innerText || '').trim()));
  if (items.length) items[items.length - 1].click();
});
await page.waitForTimeout(6000);
console.log('退出后 hash:', await page.evaluate(() => location.hash));

// 登录页:工厂下拉选 YINJIA-MES(非测试库)
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')];
  const el = sels.find((s) => /YINJIA/.test(s.innerText || ''));
  if (el) el.click();
});
await page.waitForTimeout(1200);
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el, i) => ({ i, t: (el.innerText || '').trim() })));
console.log('工厂选项:', JSON.stringify(opts.filter((o) => /YINJIA/.test(o.t))));
const want = opts.find((o) => o.t.trim() === 'YINJIA-MES');
if (want) {
  await page.evaluate((i) => { [...document.querySelectorAll('.el-select-dropdown__item')][i].click(); }, want.i);
  await page.waitForTimeout(700);
}
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ins = [...document.querySelectorAll('input')];
  const u = ins.find((i) => (i.placeholder || '').includes('账号'));
  const p = ins.find((i) => (i.placeholder || '').includes('密码'));
  if (u) setVal(u, 'admin');
  if (p) setVal(p, '123456');
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(9000);
console.log('登录后:', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: [...document.querySelectorAll('span.factory-name')].map((x) => (x.innerText || '').trim()),
}))));
