const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

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
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(9000);
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  bodyHead: (document.body.innerText || '').slice(0, 300),
})), null, 2));
