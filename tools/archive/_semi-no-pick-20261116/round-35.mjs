const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_PICK", { timeout: 40000 });
await page.waitForTimeout(9000);
await restore();

const list = await page.evaluate(`(() => ({
  docs: [...document.querySelectorAll('.mp-doc')].slice(0, 8).map((d) => ({
    no: (d.querySelector('.mp-doc-no')?.textContent || '').trim(),
    wo: (d.querySelector('.mp-doc-wo')?.textContent || '').replace(/\\s+/g, ' ').trim(),
    prog: (d.querySelector('.mp-doc-prog')?.textContent || '').trim(),
  })),
}))()`);
console.log('LIST ' + JSON.stringify(list, null, 2));

// 点一张含半成品的未完成单(LL-2026-11-0013 / GD-2026-11-0013)
const opened = await page.evaluate(`(() => {
  const docs = [...document.querySelectorAll('.mp-doc')];
  const t = docs.find((d) => (d.textContent || '').includes('LL-2026-11-0013')) || docs[0];
  if (!t) return 'none';
  t.click();
  return 'clicked:' + (t.querySelector('.mp-doc-no')?.textContent || '').trim();
})()`);
console.log('OPEN ' + opened);
await page.waitForTimeout(7000);
await restore();

const doc = await page.evaluate(`(() => ({
  hash: location.hash,
  head: [...document.querySelectorAll('.mp-kv')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lines: [...document.querySelectorAll('.mp-line')].map((n) => ({
    text: (n.textContent || '').replace(/\\s+/g, ' ').trim(),
    semiTag: (n.querySelector('.mp-semi')?.textContent || '').trim(),
    isSemi: !!n.querySelector('.mp-semi'),
  })),
  submitBtn: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ t: (b.textContent || '').trim(), disabled: b.disabled })),
}))()`);
console.log('DOC ' + JSON.stringify(doc, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-35-semi-doc.png" });

// 点半成品那一行 ⇒ 应给说明,不进入填数
const hit = await page.evaluate(`(() => {
  const semi = [...document.querySelectorAll('.mp-line')].find((n) => n.querySelector('.mp-semi'));
  if (!semi) return 'no-semi-row';
  semi.click();
  return 'clicked';
})()`);
await page.waitForTimeout(1500);
const msg = await page.evaluate(`(() => ({
  alerts: [...document.querySelectorAll('.mp-err, .el-alert__title, .el-message__content')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean),
  qtyEditor: !!document.querySelector('.mp-qty'),
}))()`);
console.log('SEMI_CLICK ' + hit + ' ' + JSON.stringify(msg, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-35-semi-click.png" });
console.log('DONE');
