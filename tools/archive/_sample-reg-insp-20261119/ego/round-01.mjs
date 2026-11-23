const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/SAMPLE_REG', { timeout: 30000 });
await page.waitForTimeout(3000);
// login if needed
const hasLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'));
if (hasLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin');
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456');
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(4000);
  await page.goto('http://127.0.0.1:8090/#/panelx/list/SAMPLE_REG', { timeout: 30000 });
  await page.waitForTimeout(3500);
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }
const info = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.dt-tab')].map((x) => (x.textContent || '').trim());
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()).slice(0, 5));
  const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ');
  return { hash: location.hash, tabs, rowCount: rows.length, firstRows: rows.slice(0, 3), lastRows: rows.slice(-3), totalText: bodyText.match(/共\s*\d+\s*条/)?.[0] || '', title: document.title };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-sample-insp-1119/round-01-sample-reg.png' });
console.log({ screenshot: shot });
