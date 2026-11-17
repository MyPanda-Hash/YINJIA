// round-01:「打印缓存(离线补打)」界面验证 —— 打开自动打印页,登录,抓取卡片文案与截图
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/sys/printStation', { timeout: 30000 });
await page.waitForTimeout(3500);

// 会话可能过期 → 在登录页自动登录(账号/密码见 skill)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'));
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
  await page.waitForTimeout(6000);
  await page.goto('http://127.0.0.1:8091/#/sys/printStation', { timeout: 30000 });
  await page.waitForTimeout(4000);
}

// 截图前把窗口恢复正常,避免最小化时截图失败
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const cards = [...document.querySelectorAll('.ps-card')];
  return {
    hash: location.hash,
    title: txt(document.querySelector('.ps-title')),
    cardTitles: cards.map((c) => txt(c.querySelector('.ps-sec'))),
    cacheCard: cards.map((c) => txt(c)).find((t) => t.includes('打印缓存')) || '',
    switches: document.querySelectorAll('.ps-card .el-switch').length,
    localeSelectors: [...document.querySelectorAll('select, .el-select')].length,
  };
});
console.log(JSON.stringify(info, null, 2));

await page.screenshot({ path: shot + '/round-01-print-station.png', fullPage: true });
console.log('screenshot -> round-01-print-station.png');
