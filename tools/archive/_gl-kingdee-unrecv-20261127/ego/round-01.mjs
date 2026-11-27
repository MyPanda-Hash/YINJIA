const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 });
await page.waitForTimeout(4000);

// 登录(admin/123456,工厂 YINJIA-MES)
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
await page.waitForTimeout(600);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(9000);
console.log('登录后:', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: [...document.querySelectorAll('span.factory-name')].map((x) => (x.innerText || '').trim()),
}))));
