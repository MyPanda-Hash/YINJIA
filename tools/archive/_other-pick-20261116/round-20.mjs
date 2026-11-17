const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

const scanExpr = (code) => `(() => {
  const el = document.querySelector('.mo-scanbar input');
  if (!el) return 'no-input';
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, ${JSON.stringify(code)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  return 'ok';
})()`

const readExpr = `(() => ({
  lines: [...document.querySelectorAll('.mo-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  err: (document.querySelector('.el-alert__title')?.textContent || '').trim(),
  cand: [...document.querySelectorAll('.mo-cand')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  needWh: !!document.querySelector('.mo-wh'),
  whText: (document.querySelector('.mo-wh')?.textContent || '').replace(/\\s+/g, ' ').trim(),
  addDisabled: (() => { const b = [...document.querySelectorAll('.mo-qty button')].find((x) => (x.textContent || '').includes('加入清单')); return b ? b.disabled : null })(),
}))()`

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();

// 扫一个「没有库存」的物料:应走商品档案兜底 + 需要手选仓库
console.log('SCAN ' + await page.evaluate(scanExpr('C-53-02')));
await page.waitForTimeout(5000);
await restore();
console.log('CAND ' + JSON.stringify(await page.evaluate(readExpr), null, 2));

// 仓库下拉:先看加入按钮是否因为没选仓库而禁用
await page.click(".mo-wh .el-select__wrapper", { label: "open warehouse select", timeout: 15000 })
  .then(() => console.log('WH_OPEN ok')).catch((e) => console.log('WH_OPEN fail: ' + e.message));
await page.waitForTimeout(1500);
const opts = await page.evaluate(`(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((n) => (n.textContent || '').trim()).filter(Boolean).slice(0, 6))()`);
console.log('WH_OPTIONS ' + JSON.stringify(opts));
await page.click(".el-select-dropdown__item", { label: "pick first warehouse", timeout: 15000 })
  .then(() => console.log('WH_PICK ok')).catch((e) => console.log('WH_PICK fail: ' + e.message));
await page.waitForTimeout(1200);
await restore();
console.log('AFTER_WH ' + JSON.stringify(await page.evaluate(readExpr), null, 2));

// 数量 2 → 加入 → 提交
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-qty input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, '2');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
  return 'ok';
})()`);
await page.waitForTimeout(800);
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mo-qty button')].find((x) => (x.textContent || '').includes('加入清单'));
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(1800);
console.log('LIST ' + JSON.stringify(await page.evaluate(readExpr), null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-20-ret-fallback.png" });

await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mo-foot button')].find((x) => (x.textContent || '').trim() === '提交');
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(8000);
await restore();
console.log('AFTER ' + JSON.stringify(await page.evaluate(`(() => ({
  alerts: [...document.querySelectorAll('.el-alert__title, .el-message__content, .el-message')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lineCount: document.querySelectorAll('.mo-line').length,
}))()`), null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-20-after-submit.png" });
console.log('DONE');
