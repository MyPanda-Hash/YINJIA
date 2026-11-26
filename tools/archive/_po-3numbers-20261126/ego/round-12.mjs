const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.waitForTimeout(800);

// ① 打开「登录工厂」下拉（第 3 个 el-select，文本 YINJIA-MES）
const opened = await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')];
  const el = sels.find((s) => /YINJIA/.test((s.innerText || '')));
  if (!el) return { ok: false, n: sels.length };
  el.querySelector('.el-select__wrapper, .select-trigger, input')?.click?.();
  el.click();
  return { ok: true, text: (el.innerText || '').trim() };
});
console.log('开下拉:', JSON.stringify(opened));
await page.waitForTimeout(1200);

const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .map((el, i) => ({ i, text: (el.innerText || '').trim() })));
console.log('工厂选项:', JSON.stringify(opts));

const t = opts.find((o) => /测试库/.test(o.text));
if (t) {
  await page.evaluate((i) => { [...document.querySelectorAll('.el-select-dropdown__item')][i].click(); }, t.i);
  await page.waitForTimeout(800);
}
console.log('选后工厂框:', JSON.stringify(await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')].map((s) => (s.innerText || '').trim());
  return sels;
})));

// ② 填账号密码并进入
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
await page.waitForTimeout(400);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r12-login-filled.png' });

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(11000);
console.log('登录后:', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: [...document.querySelectorAll('span.factory-name')].map((x) => (x.innerText || '').trim()),
  bodyTop: (document.body.innerText || '').slice(0, 120),
}))));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r12-after-login.png' });
