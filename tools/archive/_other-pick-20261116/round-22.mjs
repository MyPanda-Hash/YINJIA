const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

// ① 其他领料再走一单(验证经手人已带上登录人)
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-scanbar input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, 'HP-08');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(4500);
await restore();
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-qty input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, '1');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
  return 'ok';
})()`);
await page.waitForTimeout(700);
await page.evaluate(`(() => { const b=[...document.querySelectorAll('.mo-qty button')].find(x=>(x.textContent||'').includes('加入清单')); b&&b.click(); return 'ok'; })()`);
await page.waitForTimeout(1500);
await page.evaluate(`(() => { const b=[...document.querySelectorAll('.mo-foot button')].find(x=>(x.textContent||'').trim()==='提交'); b&&b.click(); return 'ok'; })()`);
await page.waitForTimeout(8000);
await restore();
const msg = await page.evaluate(`(() => [...document.querySelectorAll('.el-alert__title, .el-message__content')].map(n=>(n.textContent||'').trim()))()`);
console.log('PICK_SUBMIT ' + JSON.stringify(msg));

// ② 左导航:手机扫码 → 生产扫码登记 的叶子顺序
await page.evaluate(`(() => {
  const g = [...document.querySelectorAll('.nav-group')].find((n) => (n.textContent || '').includes('手机扫码'));
  if (g) g.click();
  return 'ok';
})()`);
await page.waitForTimeout(1500);
const mods = await page.evaluate(`(() => [...document.querySelectorAll('.nav-module')].map(n=>(n.textContent||'').trim()))()`);
console.log('MODULES ' + JSON.stringify(mods));
await page.evaluate(`(() => {
  const m = [...document.querySelectorAll('.nav-module')].find((n) => (n.textContent || '').includes('生产扫码登记'));
  if (m) m.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(1800);
await restore();
const leaves = await page.evaluate(`(() => {
  const g = document.querySelector('.fly-card .card-group');
  return g ? [...g.querySelectorAll('.card-item')].map((i) => (i.textContent || '').trim()) : [];
})()`);
console.log('LEAVES ' + JSON.stringify(leaves));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-22-nav.png" });

// ③ 英文走查
await page.evaluate(`(() => {
  const el = [...document.querySelectorAll('header *, [class*=lang]')].filter((n) => (n.textContent || '').trim() === '中' && n.children.length === 0)[0];
  if (el) (el.closest('div,button,span') || el).click();
  return 'ok';
})()`);
await page.waitForTimeout(1200);
await page.evaluate(`(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, li')].find((n) => /English/i.test(n.textContent || ''));
  if (it) it.click();
  return 'ok';
})()`);
await page.waitForTimeout(3000);
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(6000);
await restore();
const en = await page.evaluate(`(() => ({
  title: document.title,
  placeholder: document.querySelector('.mo-scanbar input')?.placeholder || '',
  text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 420),
}))()`);
console.log('EN ' + JSON.stringify(en, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-22-en.png" });

// 切回中文
await page.evaluate(`(() => {
  const el = [...document.querySelectorAll('header *, [class*=lang]')].filter((n) => (n.textContent || '').trim() === 'EN' && n.children.length === 0)[0];
  if (el) (el.closest('div,button,span') || el).click();
  return 'ok';
})()`);
await page.waitForTimeout(1200);
await page.evaluate(`(() => { const it=[...document.querySelectorAll('.el-dropdown-menu__item, li')].find(n=>/简体中文/.test(n.textContent||'')); if(it) it.click(); return 'ok'; })()`);
await page.waitForTimeout(2000);
console.log('DONE');
