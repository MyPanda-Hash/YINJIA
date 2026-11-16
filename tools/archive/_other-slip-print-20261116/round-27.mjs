const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(6000);
await restore();

// 渲染「其他退料单」和「生产退料单」两张纸面(同一份 HTML 生成器,只是 kind 不同)
const out = await page.evaluate(`(async () => {
  const token = localStorage.getItem('mes_token') || '';
  const { buildSlipPayload } = await import('/src/business/slipPrint.js');
  const { pickSlipHtml } = await import('/src/business/print-formats.js');
  const { qrDataUrl } = await import('/src/business/printStation.js');
  const grab = async (panel, no) => {
    const r = await fetch('/api/px/slip/rows', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 面板: panel, 单据编号: no }),
    });
    return (await r.json())?.data || {};
  };
  const made = [];
  for (const [kind, panel, no] of [
    ['OTHER_RET', 'MATERIAL_RET', 'TL-2026-11-0007'],
    ['MAT_RET', 'MATERIAL_RET', 'TL-2026-11-0008'],
  ]) {
    const data = await grab(panel, no);
    const payload = buildSlipPayload({ kind, docNo: no, data });
    const qr = await qrDataUrl(payload['二维码内容']);
    made.push({ kind, 标题: payload.标题, 领料单号: payload.领料单号, 部门: payload.领料部门, qr: payload['二维码内容'], html: pickSlipHtml(payload, qr) });
  }
  document.open();
  document.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#f5f5f5;margin:0;padding:10px">'
    + made.map((m) => m.html).join('<hr style="margin:14px 0;border:0;border-top:2px dashed #bbb">') + '</body></html>');
  document.close();
  return made.map((m) => ({ kind: m.kind, 标题: m.标题, 单号: m.领料单号, 部门: m.部门, qr: m.qr }));
})()`);
console.log(JSON.stringify(out, null, 2));
await page.waitForTimeout(1500);
await restore();
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-27-slips-ret.png", fullPage: true });
console.log('DONE');
