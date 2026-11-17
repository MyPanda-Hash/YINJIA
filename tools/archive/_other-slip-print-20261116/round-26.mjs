const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

// ① 页面 UI(含新增的「补打印」区)
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();
const ui = await page.evaluate(`(() => ({
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 420),
  hasReprint: !!document.querySelector('.mo-reprint'),
  reprintText: (document.querySelector('.mo-reprint')?.textContent || '').replace(/\\s+/g, ' ').trim(),
  placeholder: document.querySelector('.mo-reprint input')?.placeholder || '',
}))()`);
console.log('UI ' + JSON.stringify(ui, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-26-reprint-ui.png" });

// ② 补打印的失败路径(单号不存在 ⇒ 可读报错,不弹打印框)
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-reprint input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, 'OO-NOT-EXIST');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(400);
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mo-reprint button')].find((x) => (x.textContent || '').includes('补打印'));
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(3500);
await restore();
const err = await page.evaluate(`(() => ({
  alerts: [...document.querySelectorAll('.el-alert__title, .el-message__content')].map((n) => (n.textContent || '').trim()),
}))()`);
console.log('BAD_NO ' + JSON.stringify(err, null, 2));

// ③ 用**真实的** pickSlipHtml 渲染纸面(走 dev server 的模块,不调 window.print)
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(6000);
await restore();
const rendered = await page.evaluate(`(async () => {
  const token = localStorage.getItem('mes_token') || '';
  const r = await fetch('/api/px/slip/rows', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 面板: 'OTHER_OUT', 单据编号: 'OO-2026-11-0005' }),
  });
  const j = await r.json();
  const data = j?.data || {};
  const { buildSlipPayload } = await import('/src/business/slipPrint.js');
  const { pickSlipHtml } = await import('/src/business/print-formats.js');
  const { qrDataUrl } = await import('/src/business/printStation.js');
  const payload = buildSlipPayload({ kind: 'OTHER_PICK', docNo: 'OO-2026-11-0005', data });
  const qr = await qrDataUrl(payload['二维码内容']);
  const html = pickSlipHtml(payload, qr);
  window.__slipProbe = { payload, qrLen: qr.length, htmlLen: html.length };
  document.open();
  document.write('<!doctype html><html><head><meta charset="utf-8"><style>body{background:#f5f5f5;margin:0;padding:12px}</style></head><body>' + html + '</body></html>');
  document.close();
  return { payload, qrLen: qr.length, htmlLen: html.length };
})()`);
console.log('SLIP ' + JSON.stringify(rendered, null, 2));
await page.waitForTimeout(1500);
await restore();
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-26-slip.png", fullPage: true });
console.log('DONE');
