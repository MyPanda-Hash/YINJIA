// 界面取证(2026-11-12):送料暂收单列表页 —— 「现存量」列是否真的显示出来
// 用 5173(vite,源码即时生效),登录工厂 YJ = 正式库
const outDir = 'C:/Users/Lenovo/ego/qc-recv-stock-visible-20261112';
const task = await taskSpace('qc-recv-stock-visible-20261112');
const page = task.page('p1');

await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 30000 });
await page.waitForTimeout(3000);

// 会话过期就自动登录(YJ = 正式库)
const needLogin = await page.evaluate(() => !localStorage.getItem('mes_token') || location.hash.includes('login'));
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin');
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456');
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(4000);
  console.log('自动登录已触发');
}

await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 30000 });
await page.waitForTimeout(5000);

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
  const rows = [...document.querySelectorAll('tbody tr')].slice(0, 3).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()));
  return { hash: location.hash, heads, rows };
});
console.log(JSON.stringify(info, null, 2));

await page.screenshot({ path: `${outDir}/round-01.png`, fullPage: false });
console.log('截图:', `${outDir}/round-01.png`);
