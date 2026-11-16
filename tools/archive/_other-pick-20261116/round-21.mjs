const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();

await page.evaluate(`(() => {
  const el = document.querySelector('.mo-scanbar input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, 'C-53-02');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(5000);
await restore();

// 打开仓库下拉并点「华北工控仓」(明确的仓名,避开 10 个同选择器元素)
await page.click(".mo-wh .el-select__wrapper", { label: "open wh", timeout: 15000 }).catch((e) => console.log('open: ' + e.message));
await page.waitForTimeout(1200);
const picked = await page.evaluate(`(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')];
  const t = items.find((n) => (n.textContent || '').trim() === '华北工控仓') || items[0];
  if (!t) return 'none';
  t.click();
  return 'ok:' + (t.textContent || '').trim();
})()`);
console.log('WH_PICK ' + picked);
await page.waitForTimeout(1200);

const st = await page.evaluate(`(() => ({
  cand: [...document.querySelectorAll('.mo-cand')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  whText: (document.querySelector('.mo-wh')?.textContent || '').replace(/\\s+/g, ' ').trim(),
  addDisabled: (() => { const b = [...document.querySelectorAll('.mo-qty button')].find((x) => (x.textContent || '').includes('加入清单')); return b ? b.disabled : null })(),
}))()`);
console.log('AFTER_WH ' + JSON.stringify(st, null, 2));

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
const list = await page.evaluate(`(() => ({
  lines: [...document.querySelectorAll('.mo-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  err: (document.querySelector('.el-alert__title')?.textContent || '').trim(),
}))()`);
console.log('LIST ' + JSON.stringify(list, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-21-ret-fallback-list.png" });

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
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-21-after-submit.png" });
console.log('DONE');
