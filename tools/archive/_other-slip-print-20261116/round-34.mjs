const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(8000);
await restore();

// ① 渲染纸面(真实 pickSlipHtml,载荷来自 /px/slip/rows):应**没有二维码**
const out = await page.evaluate(`(async () => {
  const token = localStorage.getItem('mes_token') || '';
  const r = await fetch('/api/px/slip/rows', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 面板: 'OTHER_OUT', 单据编号: 'OO-2026-11-0005' }),
  });
  const data = (await r.json())?.data || {};
  const { buildSlipPayload } = await import('/src/business/slipPrint.js');
  const { pickSlipHtml } = await import('/src/business/print-formats.js');
  const payload = buildSlipPayload({ kind: 'OTHER_PICK', docNo: 'OO-2026-11-0005', data });
  const html = pickSlipHtml(payload, '');
  const probe = { payloadKeys: Object.keys(payload), hasQrContent: '二维码内容' in payload,
                  htmlHasQrDiv: html.includes('class="qr"'), htmlHasImg: html.includes('<img') };
  document.open();
  document.write('<!doctype html><html><head><meta charset="utf-8"><style>body{background:#f5f5f5;margin:0;padding:12px}</style></head><body>' + html + '</body></html>');
  document.close();
  return probe;
})()`);
console.log('SLIP_PROBE ' + JSON.stringify(out, null, 2));
await page.waitForTimeout(1500);
await restore();
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-34-slip-no-qr.png" });
console.log('DONE');
